"""배포 준비의 경로·자산·원본 보존 경계를 검사한다."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release', HERE / 'prepare-front-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
REV = 'a' * 40


class PrepareTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        dist = self.root / 'dist'
        (dist / 'assets').mkdir(parents=True)
        (dist / 'icons').mkdir()
        files = {'index.html': '<head></head><script src="/assets/index-Ab12.js"></script>',
                 'assets/index-Ab12.js': 'https://iot-api.iwhya.kr',
                 'manifest.webmanifest': '{"icons":[{"src":"icons/icon.svg"}]}',
                 'icons/icon.svg': '<svg/>', 'sw-v3.js': '// sw',
                 'firebase-messaging-sw.js': '// fixture'}
        for name, data in files.items():
            (dist / name).write_text(data)
        script = self.root / '.github/scripts'
        script.mkdir(parents=True)
        (script / 'pwa-deploy-bootstrap.html').write_text(
            (HERE / 'pwa-deploy-bootstrap.html').read_text())

    def prepare(self, target=release.TARGET, revision=REV, run='1'):
        return release.prepare(self.root, revision, run, target)

    def test_archive_readback_and_source_untouched(self):
        before = {str(p): p.read_bytes() for p in (self.root / 'dist').rglob('*') if p.is_file()}
        out = self.prepare()
        receipt = json.loads((Path(out['release']) / 'receipt.json').read_text())
        self.assertFalse(receipt['deployment_enabled'])
        self.assertFalse(receipt['remote_authentication'])
        self.assertEqual(before, {str(p): p.read_bytes() for p in (self.root / 'dist').rglob('*') if p.is_file()})
        self.assertEqual(receipt['target_root'], release.TARGET)
        self.assertIn('version.json', receipt['files'])

    def test_wrong_target(self):
        for p in ['/home/iwh/iot/web/dist', '/', release.TARGET + '/..']:
            with self.subTest(p=p), self.assertRaises(ValueError):
                self.prepare(target=p)

    def test_bad_revision_run(self):
        for rev, run in [('main', '1'), (REV, '0'), (REV, '1;sh')]:
            with self.subTest(rev=rev, run=run), self.assertRaises(ValueError):
                self.prepare(revision=rev, run=run)

    def test_missing_bundle(self):
        (self.root / 'dist/assets/index-Ab12.js').unlink()
        with self.assertRaises(ValueError):
            self.prepare()

    def test_secret_or_hidden_file(self):
        (self.root / 'dist/.env').write_text('synthetic-only')
        with self.assertRaises(ValueError):
            self.prepare()

    def test_nonhidden_sensitive_file(self):
        (self.root / 'dist/credentials.json').write_text('{}')
        with self.assertRaises(ValueError):
            self.prepare()

    def test_production_parent(self):
        with self.assertRaises(ValueError):
            release.prepare(release.WEB_ROOT, REV, '1', release.TARGET)

    def test_external_script(self):
        p = self.root / 'dist/index.html'
        p.write_text(p.read_text() + '<script src="//untrusted.invalid/x.js"></script>')
        with self.assertRaises(ValueError):
            self.prepare()

    def test_bootstrap_symlink(self):
        p = self.root / '.github/scripts/pwa-deploy-bootstrap.html'
        p.unlink()
        p.symlink_to('/etc/hostname')
        with self.assertRaises(ValueError):
            self.prepare()

    def test_symlink_asset(self):
        (self.root / 'dist/assets/outside').symlink_to('/etc/hostname')
        with self.assertRaises(ValueError):
            self.prepare()

    def test_symlink_output(self):
        (self.root / '.ci-artifacts').symlink_to(self.root / 'dist', target_is_directory=True)
        with self.assertRaises(ValueError):
            self.prepare()

    def test_existing_release_not_overwritten(self):
        self.prepare()
        with self.assertRaises(FileExistsError):
            self.prepare()

    def test_bad_api_bundle(self):
        (self.root / 'dist/assets/index-Ab12.js').write_text('http://localhost:8000')
        with self.assertRaises(ValueError):
            self.prepare()

    def test_default_and_deploy_are_blocked_before_credentials(self):
        for args in [[], ['--deploy']]:
            result = subprocess.run(['bash', str(HERE / 'deploy-to-nas.sh'), *args],
                                    env={'PATH': '/usr/bin:/bin'}, capture_output=True)
            self.assertEqual(result.returncode, 64)


if __name__ == '__main__':
    unittest.main()
