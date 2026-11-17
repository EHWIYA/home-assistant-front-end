"""운영 경로 대신 새 reports 임시 root만 쓰는 publisher 회귀 검사."""
from contextlib import contextmanager, nullcontext
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import frontend_publish as p

REV = 'a' * 40


def bundle(extra=None, link=False):
    files = {'index.html': b'new-index', 'version.json': b'{"phase":"prepared_only","deployed_at":null}',
             'manifest.webmanifest': b'{}', 'sw-v3.js': b'new-sw', 'firebase-messaging-sw.js': b'new-fcm',
             'assets/new-123.js': b'new-asset', 'workbox-new123.js': b'new-workbox'}
    files.update(extra or {})
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in files.items():
            item = tarfile.TarInfo(name)
            item.size = len(data)
            if link and name == 'assets/new-123.js':
                item.type, item.linkname, item.size = tarfile.SYMTYPE, '/etc/hostname', 0
            tar.addfile(item, io.BytesIO(data) if item.isfile() else None)
    raw = buf.getvalue()
    receipt = json.dumps({'phase': 'prepared_only', 'production_changed': False, 'deployment_enabled': False,
                          'target_root': p.TARGET, 'revision': REV, 'run_id': '42',
                          'archive_sha256': p.digest(raw), 'files': {n: p.digest(v) for n, v in files.items()}}).encode()
    return raw, receipt


class RehearsalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # GitHub 단위 검사는 test 전용 root를 주입한다. CLI 상수/운영 경계는 바꾸지 않는다.
        if not p.REPORTS.is_dir():
            cls.report_temp = tempfile.TemporaryDirectory(prefix='front-reports-test-')
            cls.addClassCleanup(cls.report_temp.cleanup)
            cls.report_patch = patch.object(p, 'REPORTS', Path(cls.report_temp.name))
            cls.report_patch.start()
            cls.addClassCleanup(cls.report_patch.stop)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='front-publisher-test-', dir=p.REPORTS)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / p.MARKER).write_text(json.dumps(p.MARKER_VALUE))
        live = self.root / 'live'
        live.mkdir()
        (live / 'index.html').write_bytes(b'old-index')
        (live / 'sw-v3.js').write_bytes(b'old-sw')
        (live / 'assets').mkdir()
        (live / 'assets/old-123.js').write_bytes(b'old-asset')
        (live / 'workbox-old123.js').write_bytes(b'old-workbox')
        self.context = p.Context(self.root)
        self.boundary = p.Boundary(lambda: False, nullcontext)
        self.raw, self.receipt = bundle()
        self.baseline = p.tree_sha(live)

    def prepare(self, raw=None, receipt=None):
        return p.prepare(self.context, raw or self.raw, receipt or self.receipt, REV, '42', self.baseline, self.boundary)

    def test_operating_publish_is_always_denied(self):
        with self.assertRaises(PermissionError):
            p.publish(root=self.root, enabled=True)
        with self.assertRaises(PermissionError):
            p.main(['publish'])

    def test_wrong_root_and_missing_marker(self):
        for root in ['/tmp', p.TARGET, str(p.REPORTS)]:
            with self.subTest(root=root), self.assertRaises(PermissionError):
                p.Context(root)
        (self.root / p.MARKER).unlink()
        with self.assertRaises(FileNotFoundError):
            p.Context(self.root)

    def test_symlink_root_or_tree(self):
        path = self.root / 'linked'
        path.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            p.Context(path)
        (self.root / 'live/assets/link').symlink_to('/etc/hostname')
        with self.assertRaises(ValueError):
            self.prepare()

    def test_tar_paths_links_and_sha(self):
        for raw, receipt in [bundle({'../out.js': b'bad'}), bundle(link=True), (self.raw[:-1] + b'x', self.receipt)]:
            with self.assertRaises(ValueError):
                self.prepare(raw, receipt)
        self.assertFalse((self.root / 'candidate').exists())

    def test_manifest_drift_is_rejected(self):
        (self.root / 'live/index.html').write_bytes(b'drift')
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse((self.root / 'candidate').exists())

    def test_maintenance_before_or_during_lock(self):
        for checks in [[True], [False, True]]:
            with patch.object(self.boundary, 'blocked', side_effect=checks):
                with self.assertRaises(PermissionError):
                    self.prepare()
        self.assertFalse((self.root / 'candidate').exists())

    def test_asset_collision_is_rejected(self):
        raw, receipt = bundle({'assets/old-123.js': b'different'})
        with self.assertRaises(ValueError):
            self.prepare(raw, receipt)
        self.assertEqual((self.root / 'live/assets/old-123.js').read_bytes(), b'old-asset')

    def test_atomic_swap_rollback_and_bidirectional_asset_preservation(self):
        self.prepare()
        p.activate(self.context, '42', self.boundary)
        self.assertEqual((self.root / 'live/index.html').read_bytes(), b'new-index')
        self.assertEqual((self.root / 'live/assets/old-123.js').read_bytes(), b'old-asset')
        p.rollback(self.context, '42', self.boundary)
        self.assertEqual((self.root / 'live/index.html').read_bytes(), b'old-index')
        self.assertEqual((self.root / 'live/assets/new-123.js').read_bytes(), b'new-asset')
        for name in ['workbox-old123.js', 'workbox-new123.js']:
            self.assertTrue((self.root / 'live' / name).is_file())

    def test_duplicate_and_stale_run(self):
        self.prepare()
        p.activate(self.context, '42', self.boundary)
        self.prepare()
        self.assertTrue(p.activate(self.context, '42', self.boundary)['idempotent'])
        with self.assertRaises(ValueError):
            p.activate(self.context, '41', self.boundary)

    def test_unsupported_exchange_has_no_fallback(self):
        self.prepare()
        with patch.object(p, 'rename_exchange', side_effect=NotImplementedError):
            with self.assertRaises(NotImplementedError):
                p.activate(self.context, '42', self.boundary)
        self.assertEqual((self.root / 'live/index.html').read_bytes(), b'old-index')
        self.assertEqual(p.recover(self.context, self.boundary)['phase'], 'prepared')

    def test_interruption_before_and_after_exchange(self):
        self.prepare()
        def fail_before(point):
            if point == 'before_exchange':
                raise RuntimeError('synthetic interruption')
        with self.assertRaises(RuntimeError):
            p.activate(self.context, '42', self.boundary, fail_before)
        self.assertEqual(p.recover(self.context, self.boundary)['phase'], 'prepared')
        def fail_after(point):
            if point == 'after_exchange':
                raise RuntimeError('synthetic interruption')
        with self.assertRaises(RuntimeError):
            p.activate(self.context, '42', self.boundary, fail_after)
        self.assertEqual(p.recover(self.context, self.boundary)['phase'], 'active')
        with self.assertRaises(RuntimeError):
            p.rollback(self.context, '42', self.boundary, fail_after)
        self.assertEqual(p.recover(self.context, self.boundary)['phase'], 'rolled_back')

    def test_candidate_or_active_drift_blocks_swap(self):
        self.prepare()
        (self.root / 'candidate/index.html').write_bytes(b'tampered')
        with self.assertRaises(ValueError):
            p.activate(self.context, '42', self.boundary)

    def test_changed_rollback_tree_blocks_activation(self):
        self.prepare()
        (self.root / 'previous/index.html').write_bytes(b'changed-rollback')
        with self.assertRaises(ValueError):
            p.activate(self.context, '42', self.boundary)
        self.assertEqual((self.root / 'live/index.html').read_bytes(), b'old-index')

    def test_missing_rollback_tree_blocks_activation(self):
        self.prepare()
        (self.root / 'previous').rename(self.root / 'previous-preserved')
        with self.assertRaises(ValueError):
            p.activate(self.context, '42', self.boundary)
        self.assertEqual((self.root / 'live/index.html').read_bytes(), b'old-index')

    def test_changed_rollback_tree_blocks_idempotent_success(self):
        self.prepare()
        p.activate(self.context, '42', self.boundary)
        (self.root / 'previous/index.html').write_bytes(b'changed-rollback')
        with self.assertRaises(ValueError):
            p.activate(self.context, '42', self.boundary)
        self.assertEqual((self.root / 'live/index.html').read_bytes(), b'new-index')

    def test_crash_before_journal_replace_preserves_orphan_and_recovery_retries(self):
        self.prepare()
        def before_exchange(_):
            raise RuntimeError('synthetic interruption')
        with self.assertRaises(RuntimeError):
            p.activate(self.context, '42', self.boundary, before_exchange)
        legacy = self.root / '.state-next.json'
        legacy.write_text('legacy-failed-write')
        with patch.object(p.os, 'replace', side_effect=OSError('synthetic pre-replace crash')):
            with self.assertRaises(OSError):
                p.recover(self.context, self.boundary)
        orphans = list(self.root.glob('.state-next-*.json'))
        self.assertEqual(len(orphans), 1)
        orphan_bytes = orphans[0].read_bytes()
        self.assertEqual(p.read_state(self.context)['phase'], 'exchange_pending')
        self.assertEqual(p.recover(self.context, self.boundary)['phase'], 'prepared')
        self.assertEqual(orphans[0].read_bytes(), orphan_bytes)
        self.assertEqual(legacy.read_text(), 'legacy-failed-write')

    def test_oversize_live_file_is_rejected_before_copy(self):
        path = self.root / 'live/assets/oversize.js'
        with path.open('wb') as stream:
            stream.truncate(p.FILE_LIMIT + 1)
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse((self.root / 'candidate').exists())

    def test_file_count_total_and_copy_space_limits(self):
        with patch.object(p, 'FILE_COUNT_LIMIT', 1):
            with self.assertRaises(ValueError):
                p.manifest(self.root / 'live')
        with patch.object(p, 'TREE_LIMIT', 1):
            with self.assertRaises(ValueError):
                p.manifest(self.root / 'live')
        space = type('Space', (), {'free': 0})()
        with patch.object(p.shutil, 'disk_usage', return_value=space):
            with self.assertRaises(ValueError):
                self.prepare()
        self.assertFalse((self.root / 'candidate').exists())

    @contextmanager
    def candidate_storage(self):
        mount = self.root / 'fake-hdd'
        base = mount / 'backups/managed'
        base.mkdir(parents=True)
        class Storage:
            def __enter__(self):
                self.fd = os.open(mount, os.O_RDONLY | os.O_DIRECTORY)
                return self
            def __exit__(self, *_):
                os.close(self.fd)
        with patch.object(p, 'HDD_MOUNT', mount), patch.object(p, 'HDD_BASE', base), patch.object(p, 'hdd_storage', Storage):
            yield base

    def test_candidate_read_is_bounded_and_rejects_links_special_files(self):
        with self.candidate_storage() as base:
            regular = base / 'candidate.tar'
            regular.write_bytes(b'fixture')
            self.assertEqual(p.read_hdd_candidate(regular, 64), b'fixture')
            linked = base / 'linked.tar'
            linked.symlink_to(regular)
            with self.assertRaises((ValueError, PermissionError, OSError)):
                p.read_hdd_candidate(linked)
            fifo = base / 'fifo.tar'
            os.mkfifo(fifo)
            with self.assertRaises(ValueError):
                p.read_hdd_candidate(fifo)
            with regular.open('wb') as stream:
                stream.truncate(p.ARCHIVE_LIMIT + 1)
            with patch.object(p.os, 'read', side_effect=AssertionError('oversize must not be read')):
                with self.assertRaises(ValueError):
                    p.read_hdd_candidate(regular)

    def test_cli_audit_and_rehearse_reject_dev_zero_before_read(self):
        with patch.object(p, 'hdd_storage', side_effect=AssertionError('outside HDD must not open storage')):
            with self.assertRaises(PermissionError):
                p.read_hdd_candidate('/dev/zero')
            for action in ['audit', 'rehearse']:
                with self.subTest(action=action), patch.object(p.Boundary, 'actual', return_value=self.boundary):
                    with self.assertRaises(PermissionError):
                        p.main([action, '--root', str(self.root), '--archive', '/dev/zero',
                                '--receipt', '/dev/zero', '--revision', REV, '--run-id', '42',
                                '--expected-live-sha', self.baseline])
        self.assertFalse((self.root / 'candidate').exists())

    def test_official_zip_digest_is_separate_from_raw_tar_sha(self):
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w') as archive:
            archive.writestr('release.tar', self.raw)
            archive.writestr('receipt.json', self.receipt)
        zipped = out.getvalue()
        metadata = {'digest': 'sha256:' + p.digest(zipped), 'expired': False,
                    'workflow_run': {'id': 42, 'repository_id': 1243065308, 'head_repository_id': 1243065308,
                                     'head_branch': 'main', 'head_sha': REV}}
        result = p.audit_archive(self.raw, self.receipt, REV, '42', zipped, metadata)
        self.assertTrue(result['github_artifact_digest_matched'])
        self.assertFalse(result['promotion_allowed'])
        metadata['digest'] = 'sha256:' + p.digest(self.raw)
        with self.assertRaises(ValueError):
            p.audit_archive(self.raw, self.receipt, REV, '42', zipped, metadata)


if __name__ == '__main__':
    unittest.main()
