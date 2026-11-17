"""운영 후보 빌드 입력을 값 출력 없이 검사하고 nonce 결합 지문만 기록한다."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sys

NAMES = ['VITE_API_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN',
         'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID',
         'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_VAPID_KEY']


def profile(values, nonce):
    if not re.fullmatch(r'[0-9a-f]{64}', nonce):
        raise ValueError('후보 nonce 형식 오류')
    missing = [n for n in NAMES if not values.get(n, '').strip()]
    if missing:
        raise ValueError('필수 입력 누락: ' + ','.join(missing))
    if values.get('VITE_API_BASE_URL') != 'https://iot-api.iwhya.kr' or values.get('VITE_USE_MOCK') != 'false':
        raise ValueError('운영 API/mock 입력 불일치')
    return {'schema': 1, 'profile': 'production_candidate', 'nonce_tag': hashlib.sha256(nonce.encode()).hexdigest(),
            'required_names': NAMES, 'all_required_present': True,
            'api_base_matches': True, 'mock_disabled': True,
            'input_hmacs': {n: hmac.new(values[n].encode(), (nonce + ':' + n).encode(),
                                       hashlib.sha256).hexdigest() for n in NAMES},
            'verification_scope': '입력 존재·정적 profile 지문, 실사용 인증/FCM 성공 주장 아님'}


if __name__ == '__main__':
    try:
        result = profile(os.environ, os.environ.get('CANDIDATE_INPUT_NONCE', ''))
        output = Path(__file__).resolve().parents[2] / '.ci-artifacts/build-input-profile.json'
        if output.parent.is_symlink():
            raise ValueError('출력 경로 symlink 거부')
        output.parent.mkdir(mode=0o700, exist_ok=True)
        with output.open('x') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
        output.chmod(0o600)
        print(json.dumps({'profile': 'production_candidate', 'required_input_count': len(NAMES),
                          'all_required_present': True, 'values_printed': False}))
    except Exception as error:
        # 실패도 변수명/오류 유형만 출력한다.
        if isinstance(error, ValueError):
            raise SystemExit(str(error)) from None
        raise SystemExit(type(error).__name__) from None
