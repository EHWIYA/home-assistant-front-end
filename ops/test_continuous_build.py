"""부모 NAS guard에서 실행하는 private builder 경계 검사."""
import io
import gzip
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import tarfile
import tempfile
import unittest
from types import SimpleNamespace
from unittest import mock

import continuous_build as build
import frontend_publish as core


def source_archive(extra=None):
    files = {'root/package.json': b'{"scripts":{"build":"vite build"}}',
             'root/package-lock.json': b'{}'}
    files.update(extra or {})
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz', format=tarfile.USTAR_FORMAT) as archive:
        for name, data in files.items():
            member = tarfile.TarInfo(name)
            if isinstance(data, str):
                member.type, member.linkname = tarfile.SYMTYPE, data
                archive.addfile(member)
            else:
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
    return output.getvalue()


class PrivateBuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.config = build.fixture_config(self.root)
        self.values = {name: 'fixture-' + name for name in build.NAMES}
        self.values.update(VITE_API_BASE_URL='https://iot-api.iwhya.kr', VITE_USE_MOCK='false')
        self.write_inputs()
        (self.root / 'nonce').write_text('b' * 64)
        (self.root / 'nonce').chmod(0o600)
        (self.root / 'bootstrap.html').write_text('<!-- iot-pwa-deploy-bootstrap -->\n<script>void 0;</script>')
        (self.root / 'bootstrap.html').chmod(0o600)
        self.profile = build.read_inputs(self.config)[2]
        self.request = {'run_id': 123, 'attempt': 1, 'sha': 'c' * 40}
        self.work = self.root / 'builds' / ('d' * 32)
        self.calls = []

    def write_inputs(self):
        (self.root / 'inputs.env').write_text(''.join(k + '=' + v + '\n' for k, v in self.values.items()))
        (self.root / 'inputs.env').chmod(0o600)

    def runner(self, name, argv, timeout):
        self.calls.append((name, argv, timeout))
        if name == 'inspect-image':
            return {'returncode': 0, 'output': self.config['image_id'].encode()}
        if name == 'offline-build':
            dist = self.work / 'workspace/dist'
            (dist / 'assets').mkdir(parents=True)
            (dist / 'index.html').write_text('<html><head></head><body><script src="/assets/index-test.js"></script></body></html>')
            (dist / 'assets/index-test.js').write_text('https://iot-api.iwhya.kr ' + self.values['VITE_API_KEY'] + ' ' + self.values['VITE_FIREBASE_VAPID_KEY'])
            (dist / 'manifest.webmanifest').write_text('{"icons":[]}')
            (dist / 'sw-v3.js').write_text('// fixture')
            fields = {'apiKey': 'VITE_FIREBASE_API_KEY', 'authDomain': 'VITE_FIREBASE_AUTH_DOMAIN',
                      'projectId': 'VITE_FIREBASE_PROJECT_ID', 'messagingSenderId': 'VITE_FIREBASE_MESSAGING_SENDER_ID',
                      'appId': 'VITE_FIREBASE_APP_ID'}
            (dist / 'firebase-messaging-sw.js').write_text('firebase.initializeApp(' + json.dumps({key: self.values[value] for key, value in fields.items()}) + ');')
        return {'returncode': 0, 'output': (self.values['VITE_API_KEY'] + ' ' + 'b' * 64).encode()}

    def run_build(self, **kwargs):
        return build.build_candidate(self.request, self.work, self.config, self.profile,
                                     runner=kwargs.pop('runner', self.runner),
                                     source_loader=kwargs.pop('source_loader', lambda sha: source_archive()), **kwargs)

    def test_real_format_candidate_and_profile_receipt(self):
        result = self.run_build()
        receipt = Path(result['receipt_path']).read_bytes()
        audit = core.audit_archive(Path(result['archive_path']).read_bytes(), receipt, 'c' * 40, '123')
        self.assertTrue(audit['candidate_profile_claimed'])
        self.assertEqual(audit['build_input_profile_sha256'], result['profile_sha256'])
        self.assertFalse(result['public_upload'])
        self.assertEqual(json.loads(receipt)['execution_origin'], 'local_isolated')
        self.assertEqual(json.loads(Path(result['provenance_path']).read_text())['build_mode'], 'private-local-build')
        for name in ['archive_path', 'receipt_path', 'provenance_path']:
            self.assertEqual(stat.S_IMODE(Path(result[name]).stat().st_mode), 0o600)

    def test_install_has_no_private_input_mount_and_build_has_no_network(self):
        self.run_build()
        install = next(args for name, args, _ in self.calls if name == 'install')
        compile_args = next(args for name, args, _ in self.calls if name == 'offline-build')
        self.assertNotIn('--env-file', install)
        self.assertFalse(any(value in ' '.join(install) for value in self.values.values()))
        self.assertIn('--registry=https://registry.npmjs.org', install)
        self.assertEqual(compile_args[compile_args.index('--network') + 1], 'none')
        self.assertEqual(compile_args[compile_args.index('--env-file') + 1], str(self.work / 'selected-build-inputs.env'))
        for argv in [install, compile_args]:
            self.assertEqual(argv[argv.index('--user') + 1], f'{os.getuid()}:{os.getgid()}')
            self.assertEqual(argv[argv.index('--name') + 1].split('-')[-1], 'install' if argv is install else 'build')
            self.assertIn(self.config['image_id'], argv)
            self.assertNotIn('/var/run/docker.sock', ' '.join(argv))
            self.assertIn('no-new-privileges', argv)
            self.assertIn('--read-only', argv)
            self.assertEqual(argv[argv.index('--log-driver') + 1], 'none')

    def test_logs_redact_private_values_and_nonce(self):
        self.run_build()
        for path in self.work.glob('*.log'):
            data = path.read_text()
            self.assertNotIn(self.values['VITE_API_KEY'], data)
            self.assertNotIn('b' * 64, data)
            self.assertIn('[redacted-input]', data)

    def test_request_override_rejected_before_work_created(self):
        self.request['path'] = '/etc'
        with self.assertRaises(build.BuildError):
            self.run_build()
        self.assertFalse(self.work.exists())

    def test_wrong_ci_profile_rejected_before_network_or_container(self):
        self.profile['nonce_tag'] = 'f' * 64
        with self.assertRaises(build.BuildError):
            self.run_build(source_loader=lambda _: self.fail('download called'))
        self.assertEqual(self.calls, [])
        self.assertFalse(self.work.exists())

    def test_wrong_nonce_changes_profile_and_rejects(self):
        (self.root / 'nonce').write_text('e' * 64)
        with self.assertRaises(build.BuildError):
            self.run_build()
        self.assertEqual(self.calls, [])

    def test_missing_duplicate_or_extra_input_rejected(self):
        for suffix in ['OTHER=not-allowed\n', 'VITE_API_KEY=duplicate\n']:
            self.write_inputs()
            with (self.root / 'inputs.env').open('a') as stream:
                stream.write(suffix)
            with self.assertRaises(build.BuildError):
                self.run_build()
        self.values.pop('VITE_API_KEY')
        self.write_inputs()
        with self.assertRaises(build.BuildError):
            self.run_build()

    def test_unsafe_private_permissions_and_symlink_rejected(self):
        (self.root / 'inputs.env').chmod(0o644)
        with self.assertRaises(build.BuildError):
            self.run_build()
        (self.root / 'inputs.env').chmod(0o600)
        target = self.root / 'nonce'
        target.rename(self.root / 'nonce-real')
        target.symlink_to(self.root / 'nonce-real')
        with self.assertRaises(build.BuildError):
            self.run_build()

    def test_fixed_slot_path_and_existing_evidence_preserved(self):
        self.work = self.root / 'outside' / ('d' * 32)
        with self.assertRaises(build.BuildError):
            self.run_build()
        self.work = self.root / 'builds' / ('d' * 32)
        self.work.mkdir(parents=True)
        marker = self.work / 'evidence'
        marker.write_text('keep')
        with self.assertRaises(build.BuildError):
            self.run_build()
        self.assertEqual(marker.read_text(), 'keep')

    def test_low_storage_defers_before_mkdir_download_or_container(self):
        with mock.patch.object(build.shutil, 'disk_usage', return_value=SimpleNamespace(free=build.STORAGE_RESERVE - 1)):
            with self.assertRaises(build.BuildDeferred):
                self.run_build(source_loader=lambda _: self.fail('download called'))
        self.assertFalse(self.work.exists())
        self.assertEqual(self.calls, [])

    def test_source_path_escape_and_links_rejected(self):
        for extra in [{'root/../../outside': b'bad'}, {'root/link': '/etc/passwd'}]:
            workspace = self.root / ('source-' + str(len(list(self.root.glob('source-*')))))
            workspace.mkdir()
            with self.assertRaises(build.BuildError):
                build.extract_source(source_archive(extra), workspace, os.getuid(), os.getgid())
        self.assertFalse((self.root.parent / 'outside').exists())

    def test_source_gzip_and_pax_metadata_bombs_rejected_before_tar_parse(self):
        with mock.patch.object(build, 'SOURCE_LIMIT', 1024):
            bomb = gzip.compress(bytes(4 * 1024 * 1024 + 2048))
            with self.assertRaises(build.BuildError):
                build.bounded_source_tar(bomb)
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w:gz', format=tarfile.PAX_FORMAT) as archive:
            member = tarfile.TarInfo('root/package.json')
            member.pax_headers = {'comment': 'x' * 9000}
            member.size = 2
            archive.addfile(member, io.BytesIO(b'{}'))
        with self.assertRaises(build.BuildError):
            build.bounded_source_tar(output.getvalue())

    def test_production_hdd_mount_and_uuid_are_mandatory(self):
        with mock.patch.object(build, 'no_symlinks'), mock.patch.object(build.os.path, 'ismount', return_value=False):
            with self.assertRaises(build.BuildError):
                build.verify_hdd()
        block = SimpleNamespace(st_mode=stat.S_IFBLK, st_rdev=200)
        with mock.patch.object(build, 'no_symlinks'), mock.patch.object(build.os.path, 'ismount', return_value=True), \
                mock.patch.object(build.os, 'stat', side_effect=[block, SimpleNamespace(st_dev=200), SimpleNamespace(st_dev=200)]):
            build.verify_hdd()
        with mock.patch.object(build, 'no_symlinks'), mock.patch.object(build.os.path, 'ismount', return_value=True), \
                mock.patch.object(build.os, 'stat', side_effect=[block, SimpleNamespace(st_dev=201)]):
            with self.assertRaises(build.BuildError):
                build.verify_hdd()

    def test_cached_image_mismatch_refuses_install(self):
        def wrong(name, argv, timeout):
            self.calls.append((name, argv, timeout))
            return {'returncode': 0, 'output': b'sha256:wrong'}
        with self.assertRaises(build.BuildError):
            self.run_build(runner=wrong)
        self.assertEqual([name for name, _, _ in self.calls], ['inspect-image'])

    def test_failed_stage_output_does_not_escape_exception(self):
        def fail(name, argv, timeout):
            if name == 'inspect-image':
                return self.runner(name, argv, timeout)
            return {'returncode': 1, 'output': self.values['VITE_API_KEY'].encode()}
        with self.assertRaises(build.BuildError) as error:
            self.run_build(runner=fail)
        self.assertNotIn(self.values['VITE_API_KEY'], str(error.exception))
        self.assertNotIn(self.values['VITE_API_KEY'], (self.work / 'install.log').read_text())

    def test_compiled_input_mismatch_refuses_candidate(self):
        def changed(name, argv, timeout):
            row = self.runner(name, argv, timeout)
            if name == 'offline-build':
                (self.work / 'workspace/dist/assets/index-test.js').write_text('https://iot-api.iwhya.kr')
            return row
        with self.assertRaises(build.BuildError):
            self.run_build(runner=changed)
        self.assertFalse((self.work / 'candidate.tar').exists())

    def test_fixture_requires_explicit_safe_runner_and_source(self):
        with self.assertRaises(build.BuildError):
            build.build_candidate(self.request, self.work, self.config, self.profile)
        self.assertEqual(self.calls, [])

    def test_production_config_cannot_override_path_or_image(self):
        config = dict(self.config)
        with self.assertRaises(build.BuildError):
            build.validate_config(config)
        self.config['image_id'] = 'node:latest'
        with self.assertRaises(build.BuildError):
            self.run_build()

    def test_cleanup_only_matching_label_and_image(self):
        calls = []
        def fake(argv, **kwargs):
            calls.append(argv)
            if argv[1] == 'inspect':
                return subprocess.CompletedProcess(argv, 0, json.dumps({'labels': {'io.iwh.front-build': 'd' * 32}, 'image': self.config['image_id']}).encode(), b'')
            return subprocess.CompletedProcess(argv, 0, b'', b'')
        build.cleanup_build('d' * 32, self.config, fake)
        self.assertEqual(len([args for args in calls if args[1:3] == ['rm', '-f']]), 2)
        def foreign(argv, **kwargs):
            return subprocess.CompletedProcess(argv, 0, b'{"labels":{},"image":"wrong"}', b'')
        with self.assertRaises(build.BuildError):
            build.cleanup_build('d' * 32, self.config, foreign)

    def test_default_runner_requires_real_common_lease(self):
        with mock.patch.object(build, '_LEASE_FD', None):
            with self.assertRaises(build.BuildError):
                build._run_bounded('test', ['/usr/bin/true'], 1)

    def test_timeout_calls_only_this_build_cleanup(self):
        def timed(name, argv, timeout):
            if name == 'inspect-image':
                return {'returncode': 0, 'output': self.config['image_id'].encode()}
            raise subprocess.TimeoutExpired(argv, timeout)
        with mock.patch.object(build, '_run_bounded', timed), mock.patch.object(build, 'cleanup_build') as clean:
            with self.assertRaises(build.BuildError):
                self.run_build(runner=timed)
        clean.assert_called_once_with('d' * 32, self.config)
        self.assertFalse((self.work / 'candidate.tar').exists())

    def test_signal_stop_flag_reaps_cli_before_return(self):
        lease = self.root / 'lease'
        lease.touch()
        fd = os.open(lease, os.O_RDWR)
        self.addCleanup(os.close, fd)
        read_fd, write_fd = os.pipe()
        stream = os.fdopen(read_fd, 'rb', buffering=0)
        self.addCleanup(stream.close)
        self.addCleanup(os.close, write_fd)
        class Process:
            stdout = stream
            pid = 999999
            stopped = False
            def poll(self):
                return 0 if self.stopped else None
            def wait(self, timeout=None):
                self.stopped = True
                return 0
        process = Process()
        with mock.patch.object(build, '_LEASE_FD', fd), mock.patch.object(build, 'LEASE_PATH', lease), \
                mock.patch.object(build, '_STOP_REQUESTED', True), \
                mock.patch.object(build, 'storage_ready_path'), \
                mock.patch.object(build.subprocess, 'Popen', return_value=process) as spawn, \
                mock.patch.object(build.os, 'killpg') as stop:
            with self.assertRaises(build.BuildError):
                build._run_bounded('install', ['/usr/bin/false'], 1)
        self.assertTrue(process.stopped)
        stop.assert_called_once_with(999999, signal.SIGTERM)
        self.assertEqual(spawn.call_args.kwargs['pass_fds'], (fd,))

    def test_running_storage_floor_reaps_cli_and_preserves_deferral(self):
        lease = self.root / 'lease'
        lease.touch()
        fd = os.open(lease, os.O_RDWR)
        self.addCleanup(os.close, fd)
        read_fd, write_fd = os.pipe()
        stream = os.fdopen(read_fd, 'rb', buffering=0)
        self.addCleanup(stream.close)
        self.addCleanup(os.close, write_fd)
        class Process:
            stdout = stream
            pid = 999998
            stopped = False
            def poll(self):
                return 0 if self.stopped else None
            def wait(self, timeout=None):
                self.stopped = True
                return 0
        process = Process()
        with mock.patch.object(build, '_LEASE_FD', fd), mock.patch.object(build, 'LEASE_PATH', lease), \
                mock.patch.object(build, '_STOP_REQUESTED', False), \
                mock.patch.object(build, 'storage_ready_path', side_effect=[None, build.BuildDeferred('floor')]), \
                mock.patch.object(build.subprocess, 'Popen', return_value=process), \
                mock.patch.object(build.os, 'killpg') as stop:
            with self.assertRaises(build.BuildDeferred):
                build._run_bounded('offline-build', ['/usr/bin/false'], 1)
        self.assertTrue(process.stopped)
        stop.assert_called_once_with(999998, signal.SIGTERM)


if __name__ == '__main__':
    unittest.main()
