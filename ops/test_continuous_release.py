"""릴리스별 exact-slot 엔진 회귀. 실행은 부모 NAS guard가 담당한다."""
from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import tempfile
import tarfile
import unittest
from unittest import mock

import continuous_release as engine
core, adapter = engine.core, engine.adapter


class Crash(BaseException):
    pass


def tar_bytes(files):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, data in files.items():
            item = tarfile.TarInfo(name)
            item.size, item.mode = len(data), 0o644
            archive.addfile(item, io.BytesIO(data))
    return stream.getvalue()


class ContinuousReleaseTests(unittest.TestCase):
    def test_exchange_paths_share_live_parent_without_chmod_live(self):
        layout = engine.Layout.production()
        slot = layout.slot('a' * 32)
        self.assertEqual(slot.live.parent, slot.candidate.parent)
        self.assertEqual(slot.live.parent, slot.previous.parent)
        self.assertNotEqual(slot.previous, slot.candidate)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.old_umask = os.umask(0o022)
        self.addCleanup(os.umask, self.old_umask)
        self.root = Path(self.temp.name)
        self.layout = engine.Layout.fixture(self.root, trust_uid=os.getuid(), live_uid=os.getuid())
        for directory in [self.layout.base, self.layout.store, self.layout.live,
                          self.layout.base / 'intents', self.layout.web / '.publisher-releases']:
            directory.mkdir(parents=True, exist_ok=True)
        self.layout.lock.touch(mode=0o600)
        core.write_new(self.layout.live, 'index.html', b'initial')
        core.write_new(self.layout.live, 'assets/initial.js', b'initial-asset')
        self.config = {'schema': 1, 'auto_enabled': True, 'allow_enqueue': False,
                       'production': False, 'repo': adapter.REPO, 'target': str(self.layout.live),
                       'scope': 'rehearsal'}
        self.seal(self.layout.config, self.config)
        self.pointer = {'schema': 1, 'release_id': None, 'source_revision': '0' * 40,
                        'live_sha': core.tree_sha(self.layout.live), 'proof_release': None}
        self.seal(self.layout.current, self.pointer)
        self.counter = 100

    def seal(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, sort_keys=True))
        path.chmod(0o640)
        return core.digest(path.read_bytes())

    def current_files(self):
        return {name: core.read_tree_file(self.layout.live, name)
                for name in core.manifest(self.layout.live)}

    def make_release(self, letter, *, asset=None, extra_files=0):
        release_id = letter * 32
        slot = self.layout.slot(release_id)
        for directory in [slot.state, slot.inbox, slot.candidate.parent]:
            directory.mkdir(parents=True, exist_ok=True)
        slot.state.chmod(0o700)
        self.counter += 1
        profile = {'fixture': True, 'input': 'selected'}
        files = {'index.html': letter.encode(),
                 'version.json': b'{"phase":"prepared_only","deployed_at":null}',
                 'manifest.webmanifest': b'{}', 'sw-v3.js': ('sw-' + letter).encode(),
                 'firebase-messaging-sw.js': ('fcm-' + letter).encode(),
                 'assets/' + (asset or letter + '.js'): ('asset-' + letter).encode()}
        for number in range(extra_files):
            files['assets/extra-' + letter + '-' + str(number) + '.js'] = b'extra'
        raw = tar_bytes(files)
        receipt = json.dumps({'phase': 'prepared_only', 'target_root': core.TARGET,
                              'revision': letter * 40, 'run_id': str(self.counter),
                              'archive_sha256': core.digest(raw), 'production_changed': False,
                              'deployment_enabled': False,
                              'files': {k: core.digest(v) for k, v in files.items()},
                              'candidate_kind': 'production_candidate_unpublished',
                              'build_input_profile': profile}).encode()
        backup = tar_bytes(self.current_files())
        policy = {'schema': 1, 'enabled': True, 'target': str(self.layout.live),
                  'policy_id': letter * 32,
                  'approved_until': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
                  'source_revision': letter * 40, 'ci_run': self.counter, 'ci_attempt': 1,
                  'current_main': letter * 40, 'archive_sha256': core.digest(raw),
                  'receipt_sha256': core.digest(receipt), 'backup_sha256': core.digest(backup),
                  'baseline_sha': core.tree_sha(self.layout.live),
                  'input_profile_digest': core.digest(json.dumps(profile, sort_keys=True).encode())}
        provenance = {'schema': 1, 'archive_sha256': policy['archive_sha256'],
                      'source_revision': letter * 40, 'build_mode': 'private-local-build',
                      'input_profile_digest': policy['input_profile_digest']}
        for name, data in [('candidate.tar', raw), ('receipt.json', receipt), ('backup.tar', backup),
                           ('provenance.json', json.dumps(provenance).encode())]:
            path = slot.inbox / name
            path.write_bytes(data)
            path.chmod(0o640)
        _, _, expected = adapter.audit_inputs(slot, policy)
        plan = {'schema': 1, 'release_id': release_id, 'parent_release': self.pointer['release_id'],
                'policy': policy, 'expected_state': expected}
        self.seal(self.layout.plan_path(release_id).parent / 'parent-current.json', self.pointer)
        fingerprint = self.seal(self.layout.plan_path(release_id), plan)
        self.intent(release_id, plan, fingerprint)
        return release_id, plan

    def intent(self, release_id, plan, fingerprint=None, phase='executing'):
        self.seal(self.layout.intent_path(release_id), {
            'schema': 1, 'release_id': release_id, 'parent_release': plan['parent_release'],
            'baseline_sha': plan['policy']['baseline_sha'],
            'plan_sha256': fingerprint or core.digest(self.layout.plan_path(release_id).read_bytes()),
            'phase': phase})

    def promote(self, release_id, result, plan):
        if result['ok'] and result['phase'] == 'active':
            self.pointer = {'schema': 1, 'release_id': release_id,
                            'source_revision': plan['policy']['source_revision'],
                            'live_sha': result['live_sha'], 'proof_release': release_id}
        else:
            self.pointer = dict(self.pointer, live_sha=result['live_sha'], proof_release=release_id)
        self.seal(self.layout.current, self.pointer)

    def run_good(self, letter):
        release_id, plan = self.make_release(letter)
        result = engine.execute_release(self.layout, release_id)
        self.assertTrue(result['ok'])
        self.promote(release_id, result, plan)
        return release_id, plan, result

    def test_a_b_c_keep_separate_states_and_immutable_assets(self):
        ids = []
        for letter in ['a', 'b', 'c']:
            release_id, plan, result = self.run_good(letter)
            ids.append(release_id)
            self.assertEqual((self.layout.live / 'index.html').read_bytes(), letter.encode())
            self.assertEqual(result['live_sha'], plan['expected_state']['candidate_sha'])
        for release_id in ids:
            self.assertTrue(self.layout.plan_path(release_id).exists())
            self.assertEqual(core.read_state(adapter.OperatingContext(self.layout.slot(release_id)))['phase'], 'active')
        for name in ['initial.js', 'a.js', 'b.js', 'c.js']:
            self.assertTrue((self.layout.live / 'assets' / name).is_file())

    def test_failed_c_restores_b_with_c_assets_and_d_uses_enriched_baseline(self):
        self.run_good('a')
        _, b_plan, _ = self.run_good('b')
        release_id, plan = self.make_release('c')
        result = engine.execute_release(self.layout, release_id,
                                        verify=lambda context, _: (context.tree('live') / 'index.html').read_bytes() != b'c')
        self.assertFalse(result['ok'])
        self.assertEqual(result['phase'], 'rolled_back')
        self.assertTrue(result['files_restored'])
        self.assertTrue(result['health_verified'])
        self.assertEqual((self.layout.live / 'index.html').read_bytes(), b'b')
        self.assertEqual(result['live_sha'], plan['expected_state']['rollback_sha'])
        self.assertNotEqual(result['live_sha'], b_plan['expected_state']['candidate_sha'])
        self.assertTrue((self.layout.live / 'assets/c.js').exists())
        self.promote(release_id, result, plan)
        self.assertEqual(self.pointer['release_id'], 'b' * 32)
        self.assertEqual(self.pointer['proof_release'], release_id)
        self.run_good('d')

    def test_failed_candidate_and_unhealthy_rollback_are_distinct(self):
        self.run_good('a')
        release_id, plan = self.make_release('b')
        result = engine.execute_release(self.layout, release_id, verify=lambda *_: False)
        self.assertFalse(result['ok'])
        self.assertEqual(result['phase'], 'rolled_back')
        self.assertTrue(result['files_restored'])
        self.assertFalse(result['health_verified'])
        self.assertEqual(result['live_sha'], plan['expected_state']['rollback_sha'])
        self.assertEqual((self.layout.live / 'index.html').read_bytes(), b'a')

    def test_duplicate_active_is_idempotent(self):
        release_id, _, _ = self.run_good('a')
        before = core.tree_sha(self.layout.live)
        result = engine.execute_release(self.layout, release_id)
        self.assertTrue(result['ok'])
        self.assertTrue(result['idempotent'])
        self.assertEqual(before, core.tree_sha(self.layout.live))

    def test_disabled_config_blocks_execute_and_recover_before_tree_write(self):
        release_id, _ = self.make_release('a')
        self.config['auto_enabled'] = False
        self.seal(self.layout.config, self.config)
        before = core.tree_sha(self.layout.live)
        for action in [engine.execute_release, engine.recover_release]:
            with self.assertRaises(PermissionError):
                action(self.layout, release_id)
        self.assertEqual(before, core.tree_sha(self.layout.live))
        self.assertFalse(self.layout.slot(release_id).candidate.exists())

    def test_expired_lease_blocks_new_exchange(self):
        release_id, plan = self.make_release('a')
        plan['policy']['approved_until'] = '2000-01-01T00:00:00+00:00'
        fingerprint = self.seal(self.layout.plan_path(release_id), plan)
        self.intent(release_id, plan, fingerprint)
        with self.assertRaises(PermissionError):
            engine.execute_release(self.layout, release_id)
        self.assertFalse(self.layout.slot(release_id).candidate.exists())

    def test_disabled_manual_root_recovering_capability_only(self):
        release_id, plan, _ = self.run_good('a')
        self.config['auto_enabled'] = False
        self.seal(self.layout.config, self.config)
        with self.assertRaises(PermissionError):
            engine.recover_release(self.layout, release_id)
        self.intent(release_id, plan, phase='recovering')
        result = engine.recover_release(self.layout, release_id)
        self.assertTrue(result['ok'])
        self.assertEqual(result['phase'], 'rolled_back')

    def test_maintenance_blocks_execution_and_offline_recovery(self):
        release_id, _, _ = self.run_good('a')
        before = core.tree_sha(self.layout.live)
        self.layout.markers[0].touch()
        for action in [engine.execute_release, engine.recover_release]:
            with self.assertRaises(PermissionError):
                action(self.layout, release_id)
        self.assertEqual(before, core.tree_sha(self.layout.live))

    def test_stale_parent_pointer_rejected(self):
        release_id, _ = self.make_release('a')
        self.pointer['release_id'] = 'f' * 32
        self.seal(self.layout.current, self.pointer)
        with self.assertRaises(PermissionError):
            engine.execute_release(self.layout, release_id)
        self.assertFalse(self.layout.slot(release_id).candidate.exists())

    def test_baseline_drift_preserved_without_exchange(self):
        release_id, _ = self.make_release('a')
        (self.layout.live / 'index.html').write_bytes(b'changed-by-owner')
        result = engine.execute_release(self.layout, release_id)
        self.assertFalse(result['ok'])
        self.assertEqual((self.layout.live / 'index.html').read_bytes(), b'changed-by-owner')
        self.assertFalse(self.layout.slot(release_id).candidate.exists())

    def test_pending_before_exchange_recovers_without_replacement(self):
        release_id, plan = self.make_release('a')
        def crash(stage):
            if stage == 'before_exchange':
                raise Crash()
        with self.assertRaises(Crash):
            engine.execute_release(self.layout, release_id, fault=crash)
        self.intent(release_id, plan, phase='recovering')
        result = engine.recover_release(self.layout, release_id)
        self.assertTrue(result['ok'])
        self.assertEqual(result['phase'], 'prepared')
        self.assertEqual(result['live_sha'], plan['expected_state']['baseline_sha'])

    def test_pending_after_exchange_offline_expired_lease_restores_previous(self):
        release_id, plan = self.make_release('a')
        def crash(stage):
            if stage == 'after_exchange':
                raise Crash()
        with self.assertRaises(Crash):
            engine.execute_release(self.layout, release_id, fault=crash)
        plan['policy']['approved_until'] = '2000-01-01T00:00:00+00:00'
        fingerprint = self.seal(self.layout.plan_path(release_id), plan)
        self.intent(release_id, plan, fingerprint, 'recovering')
        result = engine.recover_release(self.layout, release_id)
        self.assertTrue(result['ok'])
        self.assertEqual(result['phase'], 'rolled_back')
        self.assertEqual(result['live_sha'], plan['expected_state']['rollback_sha'])

    def test_root_expected_manifest_tampering_rejected(self):
        release_id, plan = self.make_release('a')
        plan['expected_state']['candidate_sha'] = 'f' * 64
        fingerprint = self.seal(self.layout.plan_path(release_id), plan)
        self.intent(release_id, plan, fingerprint)
        with self.assertRaises(PermissionError):
            engine.execute_release(self.layout, release_id)
        self.assertFalse(self.layout.slot(release_id).candidate.exists())

    def test_runtime_manifest_forgery_rejected(self):
        release_id, plan, _ = self.run_good('a')
        self.intent(release_id, plan, phase='recovering')
        path = self.layout.slot(release_id).state / 'state.json'
        state = json.loads(path.read_text())
        state['candidate_sha'] = 'f' * 64
        path.write_text(json.dumps(state))
        with self.assertRaises(PermissionError):
            engine.recover_release(self.layout, release_id)

    def test_plan_symlink_and_writable_root_record_rejected(self):
        release_id, _ = self.make_release('a')
        path = self.layout.plan_path(release_id)
        data = path.read_bytes()
        copy = path.with_name('copy.json')
        copy.write_bytes(data)
        copy.chmod(0o640)
        path.unlink()
        path.symlink_to(copy)
        with self.assertRaises(PermissionError):
            engine.execute_release(self.layout, release_id)
        path.unlink()
        path.write_bytes(data)
        path.chmod(0o660)
        with self.assertRaises(PermissionError):
            engine.execute_release(self.layout, release_id)

    def test_unknown_config_and_fixture_live_paths_rejected(self):
        release_id, _ = self.make_release('a')
        self.config['target_override'] = '/tmp/unsafe'
        self.seal(self.layout.config, self.config)
        with self.assertRaises(PermissionError):
            engine.execute_release(self.layout, release_id)
        with self.assertRaises(PermissionError):
            engine.Layout.fixture('/home/iwh/apps/iot/web')
        with self.assertRaises(PermissionError):
            self.layout.slot('../outside')

    def test_immutable_collision_and_limits_preserve_live(self):
        before = core.tree_sha(self.layout.live)
        with self.assertRaises(PermissionError):
            self.make_release('a', asset='initial.js')
        release_id, _ = self.make_release('b')
        with mock.patch.object(core, 'FILE_COUNT_LIMIT', 2):
            with self.assertRaises((ValueError, PermissionError)):
                engine.execute_release(self.layout, release_id)
        self.assertFalse(self.layout.slot(release_id).candidate.exists())
        # archive_files의 실제 한도는 1024로 고정되어 있으므로 실제 초과 입력도 확인한다.
        with self.assertRaises((ValueError, PermissionError)):
            self.make_release('c', extra_files=1020)
        self.assertEqual(before, core.tree_sha(self.layout.live))

    def test_operation_is_bound_to_exact_root_intent_phase(self):
        release_id, plan = self.make_release('a')
        for phase in ['prepared', 'verifying', 'recovering']:
            self.intent(release_id, plan, phase=phase)
            with self.assertRaises(PermissionError):
                engine.execute_release(self.layout, release_id)
        for phase in ['prepared', 'executing', 'verifying']:
            self.intent(release_id, plan, phase=phase)
            with self.assertRaises(PermissionError):
                engine.recover_release(self.layout, release_id)
        self.assertFalse(self.layout.slot(release_id).candidate.exists())

    def test_default_fixture_verifier_checks_public_modes(self):
        release_id, plan = self.make_release('a')
        def private_mode(context, _):
            if core.read_state(context)['phase'] == 'active':
                (context.tree('live') / 'index.html').chmod(0o600)
            return engine.verify_live(context, plan)
        result = engine.execute_release(self.layout, release_id, verify=private_mode)
        self.assertFalse(result['ok'])
        self.assertEqual(result['phase'], 'rolled_back')
        self.assertTrue(result['files_restored'])
        self.assertTrue(result['health_verified'])
        self.assertEqual((self.layout.live / 'index.html').read_bytes(), b'initial')


if __name__ == '__main__':
    unittest.main()
