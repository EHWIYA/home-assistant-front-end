"""고정 host key의 기존 승인 별칭 호환성과 거부 경계."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('stage', Path(__file__).with_name('stage-front-release.py'))
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class PinTests(unittest.TestCase):
    def test_approved_alias_retains_key_material(self):
        self.assertEqual(stage.pinned_host_line('nas-connection-approved ssh-ed25519 AAAAFixture='),
                         '100.88.40.125 ssh-ed25519 AAAAFixture=\n')

    def test_literal_host_retains_key_material(self):
        line = '100.88.40.125 ssh-ed25519 AAAAFixture=\n'
        self.assertEqual(stage.pinned_host_line(line), line)

    def test_unapproved_name_or_algorithm(self):
        for line in ['other ssh-ed25519 AAAA', '100.88.40.125 ssh-rsa AAAA']:
            with self.subTest(line=line), self.assertRaises(ValueError):
                stage.pinned_host_line(line)

    def test_ambiguous_or_malformed_key(self):
        for line in ['', '100.88.40.125 ssh-ed25519 AAAA\n100.88.40.125 ssh-ed25519 BBBB',
                     '100.88.40.125 ssh-ed25519 invalid$']:
            with self.subTest(line=line), self.assertRaises(ValueError):
                stage.pinned_host_line(line)


if __name__ == '__main__':
    unittest.main()
