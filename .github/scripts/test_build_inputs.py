import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('build_inputs', Path(__file__).with_name('check-build-inputs.py'))
inputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inputs)


class InputTests(unittest.TestCase):
    def values(self):
        return {**{name: 'fixture-' + name for name in inputs.NAMES},
                'VITE_API_BASE_URL': 'https://iot-api.iwhya.kr', 'VITE_USE_MOCK': 'false'}

    def test_no_raw_values_and_nonce_binds_fingerprint(self):
        values = self.values()
        first = inputs.profile(values, 'a' * 64)
        second = inputs.profile(values, 'b' * 64)
        self.assertNotEqual(first['input_hmacs'], second['input_hmacs'])
        self.assertTrue(all(len(v) == 64 for v in first['input_hmacs'].values()))
        self.assertFalse(any(value in str(first) for value in [values[n] for n in inputs.NAMES]))

    def test_missing_input_reports_name_only(self):
        values = self.values()
        values.pop('VITE_API_KEY')
        with self.assertRaisesRegex(ValueError, 'VITE_API_KEY'):
            inputs.profile(values, 'a' * 64)

    def test_wrong_mock_or_api_or_nonce_rejected(self):
        for override in [{'VITE_USE_MOCK': 'true'}, {'VITE_API_BASE_URL': 'http://localhost'}]:
            with self.subTest(override=override), self.assertRaises(ValueError):
                inputs.profile({**self.values(), **override}, 'a' * 64)
        with self.assertRaises(ValueError):
            inputs.profile(self.values(), 'untrusted-input')


if __name__ == '__main__':
    unittest.main()
