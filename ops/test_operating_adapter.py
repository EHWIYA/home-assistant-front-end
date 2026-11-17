"""운영 어댑터와 같은 알고리즘의 명시적 파일시스템 fixture 검증."""
import dataclasses
from datetime import datetime, timezone, timedelta
import io
import json
import os
from pathlib import Path
import signal
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

import frontend_publish as core
import operating_adapter as adapter


def tar_bytes(files):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, value in files.items():
            item = tarfile.TarInfo(name)
            item.mode, item.size = 0o644, len(value)
            archive.addfile(item, io.BytesIO(value))
    return output.getvalue()


class OperatingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.layout = adapter.OperatingLayout.fixture(self.temp.name, trust_uid=os.getuid(), live_uid=os.getuid())
        for directory in (self.layout.live, self.layout.state, self.layout.inbox,
                          self.layout.requests, self.layout.results):
            directory.mkdir(parents=True)
        self.layout.lock.touch(mode=0o600)
        self.old_files = {'index.html': b'old', 'assets/old.js': b'oldasset'}
        for name, value in self.old_files.items():
            core.write_new(self.layout.live, name, value)
        self.profile = {'fixture': True, 'buildMode': 'production-private'}
        self.files = {'index.html': b'new', 'version.json': b'{"phase":"prepared_only","deployed_at":null}',
                      'manifest.webmanifest': b'{}', 'sw-v3.js': b'//sw',
                      'firebase-messaging-sw.js': b'//firebase', 'assets/new.js': b'newasset'}
        self.raw = tar_bytes(self.files)
        self.receipt = json.dumps({'phase': 'prepared_only', 'target_root': core.TARGET,
                                  'revision': 'a' * 40, 'run_id': '123',
                                  'archive_sha256': core.digest(self.raw), 'production_changed': False,
                                  'deployment_enabled': False, 'files': {k: core.digest(v) for k, v in self.files.items()},
                                  'candidate_kind': 'production_candidate_unpublished',
                                  'build_input_profile': self.profile}).encode()
        backup = tar_bytes(self.old_files)
        self.policy = {'schema': 1, 'enabled': False, 'target': str(self.layout.live),
                       'policy_id': 'b' * 32, 'approved_until': None, 'source_revision': 'a' * 40,
                       'ci_run': 123, 'ci_attempt': 1, 'current_main': 'a' * 40,
                       'archive_sha256': core.digest(self.raw), 'receipt_sha256': core.digest(self.receipt),
                       'backup_sha256': core.digest(backup), 'baseline_sha': core.tree_sha(self.layout.live),
                       'input_profile_digest': core.digest(json.dumps(self.profile, sort_keys=True).encode()),
                       'scope': 'rehearsal', 'production': False}
        provenance = {'schema': 1, 'archive_sha256': self.policy['archive_sha256'],
                      'source_revision': 'a' * 40, 'build_mode': 'private-local-build',
                      'input_profile_digest': self.policy['input_profile_digest']}
        for name, data in {'candidate.tar': self.raw, 'receipt.json': self.receipt,
                           'backup.tar': backup, 'provenance.json': json.dumps(provenance).encode()}.items():
            path = self.layout.inbox / name
            path.write_bytes(data)
            path.chmod(0o640)
        self.save_policy()

    def save_policy(self):
        self.layout.policy.write_text(json.dumps(self.policy))
        self.layout.policy.chmod(0o640)

    def enable(self):
        self.policy['enabled'] = True
        self.policy['approved_until'] = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        self.save_policy()

    def github(self, suffix):
        if suffix == '':
            return {'id': 1243065308, 'full_name': adapter.REPO}
        if suffix == '/git/ref/heads/main':
            return {'object': {'sha': self.policy['source_revision']}}
        if suffix.endswith('/jobs?per_page=100'):
            jobs = [{'name': name, 'status': 'completed', 'conclusion': 'success'} for name in adapter.REQUIRED_JOBS]
            return {'total_count': len(jobs), 'jobs': jobs}
        return {'id': 123, 'run_attempt': 1, 'repository': {'id': 1243065308},
                'head_repository': {'id': 1243065308}, 'head_branch': 'main', 'head_sha': 'a' * 40,
                'path': '.github/workflows/deploy.yml', 'status': 'completed', 'conclusion': 'success'}

    def run_operation(self, operation, **kwargs):
        return adapter.execute(self.layout, {'operation': operation, 'policy_id': 'b' * 32,
                                            'request_id': 'c' * 32}, get=self.github, **kwargs)

    def test_disabled_publish_and_rollback_fail_before_inbox(self):
        with mock.patch.object(adapter, 'audit_inputs', side_effect=AssertionError('must not read')):
            for operation in ('publish', 'rollback'):
                with self.assertRaises(PermissionError):
                    self.run_operation(operation)
        self.assertEqual(list(self.layout.state.iterdir()), [])
        self.assertFalse(self.layout.candidate.exists())

    def test_readiness_and_audit_readonly(self):
        baseline = core.tree_sha(self.layout.live)
        self.assertTrue(self.run_operation('readiness')['ok'])
        self.assertTrue(self.run_operation('audit')['github_verified'])
        self.assertEqual(core.tree_sha(self.layout.live), baseline)
        self.assertEqual(list(self.layout.state.iterdir()), [])

    def test_publish_rollback_and_idempotence_preserve_both_assets(self):
        self.enable()
        self.assertEqual(self.run_operation('publish')['phase'], 'active')
        self.assertEqual(self.run_operation('publish')['phase'], 'active')
        self.assertEqual(self.run_operation('rollback')['phase'], 'rolled_back')
        self.assertEqual((self.layout.live / 'index.html').read_bytes(), b'old')
        for name in ('assets/old.js', 'assets/new.js'):
            self.assertTrue((self.layout.live / name).is_file())

    def test_exchange_crash_metadata_recovery_no_second_exchange(self):
        self.enable()
        def fault(phase):
            if phase == 'after_exchange':
                raise RuntimeError('fixture crash')
        with self.assertRaises(RuntimeError):
            self.run_operation('publish', fault=fault)
        actual = core.tree_sha(self.layout.live)
        self.policy['enabled'], self.policy['approved_until'] = False, None
        self.save_policy()
        self.assertEqual(self.run_operation('recover')['phase'], 'active')
        self.assertEqual(core.tree_sha(self.layout.live), actual)

    def test_production_scope_metadata_on_explicit_fake_paths(self):
        context = adapter.OperatingContext(self.layout)
        context.scope = 'production'
        boundary = adapter.OperatingBoundary(self.layout, lambda: None)
        state = core.prepare(context, self.raw, self.receipt, 'a' * 40, '123',
                             self.policy['baseline_sha'], boundary)
        self.assertEqual(state['scope'], 'production')
        self.assertTrue(state['promotion_allowed'])
        self.assertFalse(state['production_changed'])
        state = core.activate(context, '123', boundary)
        self.assertTrue(state['production_changed'])
        state = core.rollback(context, '123', boundary)
        self.assertTrue(state['production_changed'])

    def test_expired_future_and_unknown_policy(self):
        self.enable()
        for delta in (-1, 901):
            self.policy['approved_until'] = (datetime.now(timezone.utc) + timedelta(seconds=delta)).isoformat()
            self.save_policy()
            with self.assertRaises(PermissionError):
                adapter.policy_read(self.layout)
        self.policy['untrusted_override'] = True
        self.save_policy()
        with self.assertRaises(PermissionError):
            adapter.policy_read(self.layout)

    def test_policy_and_input_symlink_and_writable_rejected(self):
        self.layout.policy.chmod(0o660)
        with self.assertRaises(PermissionError):
            self.run_operation('readiness')
        self.save_policy()
        path = self.layout.inbox / 'candidate.tar'
        path.unlink()
        path.symlink_to(self.layout.policy)
        with self.assertRaises(PermissionError):
            self.run_operation('audit')

    def test_digest_and_backup_and_provenance_mismatch(self):
        for name in ('candidate.tar', 'backup.tar', 'provenance.json'):
            path = self.layout.inbox / name
            old = path.read_bytes()
            path.write_bytes(b'{}')
            with self.assertRaises((PermissionError, ValueError)):
                self.run_operation('audit')
            path.write_bytes(old)

    def test_stale_head_or_missing_jobs_rejected(self):
        policy, _ = adapter.policy_read(self.layout)
        def wrong_head(suffix):
            return {'object': {'sha': 'd' * 40}} if suffix == '/git/ref/heads/main' else self.github(suffix)
        with self.assertRaises(PermissionError):
            adapter.github_verify(policy, wrong_head)
        def missing(suffix):
            return {'total_count': 0, 'jobs': []} if 'jobs?' in suffix else self.github(suffix)
        with self.assertRaises(PermissionError):
            adapter.github_verify(policy, missing)

    def test_marker_and_request_path_override_rejected(self):
        self.layout.markers[0].touch()
        with self.assertRaises(PermissionError):
            self.run_operation('readiness')
        self.layout.markers[0].unlink()
        with self.assertRaises(PermissionError):
            adapter.execute(self.layout, {'operation': 'readiness', 'policy_id': 'b' * 32,
                                         'request_id': 'c' * 32, 'root': '/tmp/override'})
        with mock.patch.dict(os.environ, {'IOT_PUBLISH_TARGET': '/tmp/override'}):
            self.assertEqual(adapter.OperatingLayout().live, Path(core.TARGET))

    def test_owner_allowlist_is_explicit(self):
        owner = os.getuid()
        with mock.patch.object(core.os, 'getuid', return_value=owner + 100):
            with self.assertRaises(ValueError):
                core.manifest(self.layout.live)
            self.assertEqual(set(core.manifest(self.layout.live, {owner})), set(self.old_files))

    def test_production_hdd_mount_uuid_and_fixture_skip(self):
        with mock.patch.object(adapter.os.path, 'ismount', side_effect=AssertionError('fixture skip')):
            adapter.verify_hdd(self.layout)
        production = dataclasses.replace(self.layout, fixture_root=None)
        with mock.patch.object(adapter, 'no_symlinks'), \
                mock.patch.object(adapter.os.path, 'ismount', return_value=False):
            with self.assertRaises(PermissionError):
                adapter.verify_hdd(production)
        block = SimpleNamespace(st_mode=adapter.stat.S_IFBLK, st_rdev=101)
        with mock.patch.object(adapter, 'no_symlinks'), \
                mock.patch.object(adapter.os.path, 'ismount', return_value=True), \
                mock.patch.object(adapter.os, 'stat', side_effect=[block, SimpleNamespace(st_dev=101),
                                                                  SimpleNamespace(st_dev=101)]):
            adapter.verify_hdd(production)
        with mock.patch.object(adapter, 'no_symlinks'), \
                mock.patch.object(adapter.os.path, 'ismount', return_value=True), \
                mock.patch.object(adapter.os, 'stat', side_effect=[block, SimpleNamespace(st_dev=102)]):
            with self.assertRaises(PermissionError):
                adapter.verify_hdd(production)

    def test_critical_deadline_and_lock_wait(self):
        with self.assertRaises(adapter.DeadlineExpired):
            with adapter.deadline(0.02):
                signal.pause()
        boundary = adapter.OperatingBoundary(self.layout, lambda: None)
        with mock.patch.object(adapter.fcntl, 'flock', side_effect=BlockingIOError), \
                mock.patch.object(adapter.time, 'monotonic', side_effect=[0, 4]):
            with self.assertRaises(TimeoutError):
                with boundary.enter():
                    self.fail('lock entered')

    def test_forged_state_slot_rejected(self):
        self.enable()
        self.run_operation('publish')
        path = self.layout.state / 'state.json'
        state = json.loads(path.read_text())
        state['candidate_sha'] = 'd' * 64
        path.write_text(json.dumps(state))
        with self.assertRaises(PermissionError):
            self.run_operation('rollback')

    def test_prepare_timeout_orphan_preserved_and_retry_refused(self):
        self.enable()
        with mock.patch.object(core, 'copy_tree', side_effect=adapter.DeadlineExpired):
            with self.assertRaises(adapter.DeadlineExpired):
                self.run_operation('publish')
        self.assertTrue(self.layout.candidate.exists())
        self.assertFalse((self.layout.state / 'state.json').exists())
        with self.assertRaises(FileExistsError):
            self.run_operation('publish')


if __name__ == '__main__':
    unittest.main()
