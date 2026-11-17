"""준비 archive를 고정 NAS 보관함으로만 전송한다. 운영 배포 명령 없음."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HOST = '100.88.40.125'


def regular(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('일반 파일만 허용')
    return path.read_bytes()


def pinned_host_line(pins):
    entries = [line.split() for line in pins.splitlines() if line.strip()]
    if (len(entries) != 1 or len(entries[0]) != 3 or
            entries[0][0] not in {HOST, 'nas-connection-approved'} or
            entries[0][1] != 'ssh-ed25519'):
        raise ValueError('승인된 고정 ed25519 호스트 키 1개 필요')
    if not re.fullmatch(r'[A-Za-z0-9+/=]+', entries[0][2]):
        raise ValueError('호스트 키 형식 오류')
    # 기존 공개 변수의 승인 별칭만 실제 고정 호스트에 연결하며 key bytes는 유지한다.
    return HOST + ' ' + ' '.join(entries[0][1:]) + '\n'


def stage(release, key, pins):
    release = Path(release)
    if release.is_symlink() or release.resolve().parent != (ROOT / '.ci-artifacts').resolve():
        raise ValueError('checkout 준비 산출물 경로만 허용')
    archive = regular(release / 'release.tar')
    receipt = regular(release / 'receipt.json')
    if not 0 < len(archive) <= 16 * 1024 * 1024 or not 0 < len(receipt) <= 256 * 1024:
        raise ValueError('전송 크기 초과')
    meta = json.loads(receipt)
    revision, run = meta['revision'], meta['run_id']
    if (not re.fullmatch(r'[0-9a-f]{40}', revision) or
            not re.fullmatch(r'[1-9][0-9]{0,19}', run) or
            meta.get('phase') != 'prepared_only' or meta.get('deployment_enabled') is not False or
            meta.get('production_changed') is not False or
            meta.get('target_root') != '/home/iwh/apps/iot/web/dist' or
            hashlib.sha256(archive).hexdigest() != meta['archive_sha256']):
        raise ValueError('준비 영수증/SHA 오류')
    head = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'],
                                   timeout=10, text=True).strip()
    if head != revision:
        raise ValueError('checkout revision 불일치')
    key = Path(key)
    regular(key)
    info = key.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError('SSH 키 소유자/0600 권한 오류')
    pin = pinned_host_line(pins)
    with tempfile.TemporaryDirectory(prefix='ssh-stage-', dir=ROOT / '.ci-artifacts') as temp:
        known = Path(temp) / 'known_hosts'
        known.write_text(pin)
        known.chmod(0o600)
        ssh = ['ssh', '-F', '/dev/null', '-T', '-p', '22', '-i', str(key),
               '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
               '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + str(known),
               '-o', 'GlobalKnownHostsFile=/dev/null', '-o', 'ConnectTimeout=10',
               '-o', 'ConnectionAttempts=1', '-o', 'ServerAliveInterval=5',
               '-o', 'ServerAliveCountMax=2', '-o', 'ForwardAgent=no',
               '-o', 'ClearAllForwardings=yes', '-o', 'LogLevel=ERROR', 'iwh@' + HOST]
        commands = [('iot-web-preflight ' + revision + ' ' + run, None),
                    (' '.join(['iot-web-stage', revision, run, meta['archive_sha256'],
                               str(len(archive)), hashlib.sha256(receipt).hexdigest(), str(len(receipt))]),
                     receipt + archive)]
        final = None
        for command, payload in commands:
            result = subprocess.run(ssh + [command], input=payload, capture_output=True, timeout=60,
                                    **({'stdin': subprocess.DEVNULL} if payload is None else {}))
            if result.returncode:
                raise ValueError('제한 SSH 요청 거부')
            final = json.loads(result.stdout)
            if final.get('production_changed') is not False or final.get('promotion_allowed') is not False:
                raise ValueError('gateway 보호 영수증 오류')
        if final.get('phase') != 'staged_only':
            raise ValueError('보관 완료 영수증 없음')
        return final


def main():
    try:
        result = stage(os.environ['FRONT_STAGE_RELEASE'], os.environ['NAS_STAGE_KEY_FILE'],
                       os.environ['NAS_SSH_HOST_KEYS'])
        print(json.dumps(result))
    except Exception as error:
        raise SystemExit('제한 전송 실패: ' + type(error).__name__) from None


if __name__ == '__main__':
    main()
