"""프런트 산출물을 오프라인으로 준비한다. NAS 인증·전송·반영은 하지 않는다."""
import argparse
import datetime as dt
import hashlib
from html.parser import HTMLParser
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
from urllib.parse import unquote, urlsplit

TARGET = '/home/iwh/apps/iot/web/dist'
ROOT = Path(__file__).resolve().parents[2]
WEB_ROOT = Path(TARGET).parent


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'link', 'img'}:
            self.refs.extend(v for k, v in attrs if k in {'src', 'href'} and v)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate_dist(dist):
    if dist.is_symlink() or not dist.is_dir():
        raise ValueError('실제 dist 디렉터리가 필요합니다')
    files = {}
    for p in sorted(dist.rglob('*')):
        if p.is_symlink() or not (p.is_file() or p.is_dir()):
            raise ValueError('symlink/특수 파일 거부')
        if p.is_file():
            name = p.relative_to(dist).as_posix()
            if any(part.startswith('.') for part in p.relative_to(dist).parts):
                raise ValueError('숨김 파일 거부')
            allowed = (name in {'index.html', 'manifest.webmanifest', 'sw-v3.js',
                                'firebase-messaging-sw.js'} or
                       re.fullmatch(r'workbox-[A-Za-z0-9_-]+\.js', name) or
                       re.fullmatch(r'(assets|icons)/[A-Za-z0-9_./-]+\.(js|css|png|svg|jpg|jpeg|ico|woff|woff2|ttf)', name))
            if not allowed or re.search(r'(secret|credential|private|token|password)', name, re.I):
                raise ValueError('허용된 공개 산출물 파일명이 아닙니다')
            files[name] = p.read_bytes()
    required = {'index.html', 'manifest.webmanifest', 'sw-v3.js', 'firebase-messaging-sw.js'}
    if not required <= files.keys():
        raise ValueError('필수 HTML/PWA 산출물 누락')
    html = files['index.html'].decode('utf-8')
    refs = References()
    refs.feed(html)
    for ref in refs.refs:
        u = urlsplit(ref)
        if not u.path and not u.netloc:
            continue
        if u.scheme or u.netloc:
            raise ValueError('HTML 외부 자산 참조 거부')
        name = unquote(u.path).lstrip('/')
        if '..' in Path(name).parts or name not in files:
            raise ValueError('HTML 로컬 자산 참조 오류')
    manifest = json.loads(files['manifest.webmanifest'])
    for icon in manifest.get('icons', []):
        if icon['src'].lstrip('/') not in files:
            raise ValueError('PWA icon 누락')
    bundles = re.findall(r'assets/(index-[A-Za-z0-9_-]+\.js)', html)
    if len(set(bundles)) != 1:
        raise ValueError('진입 JS bundle 모호함')
    if b'https://iot-api.iwhya.kr' not in files['assets/' + bundles[0]]:
        raise ValueError('운영 API 주소 누락')
    return files, bundles[0]


def prepare(root, revision, run_id, target):
    if target != TARGET or not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('고정 배포 경로/commit 형식 오류')
    if not re.fullmatch(r'[1-9][0-9]{0,19}', run_id):
        raise ValueError('run ID 형식 오류')
    root = root.resolve()
    if root == WEB_ROOT or WEB_ROOT in root.parents or (root / 'dist').resolve() == Path(TARGET):
        raise ValueError('운영 산출물 준비 거부')
    files, bundle = validate_dist(root / 'dist')
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    files['version.json'] = (json.dumps({'bundle': bundle, 'prepared_at': now,
                                        'deployed_at': None, 'phase': 'prepared_only',
                                        'app': 'hwiyaIoT'}) + '\n').encode()
    template = root / '.github/scripts/pwa-deploy-bootstrap.html'
    if template.is_symlink() or not template.is_file() or template.resolve().parent != template.parent:
        raise ValueError('bootstrap 입력 symlink/특수 파일 거부')
    bootstrap = template.read_text()
    html = files['index.html'].decode()
    if '<!-- iot-pwa-deploy-bootstrap -->' in html or html.count('</head>') != 1:
        raise ValueError('중복 bootstrap/HTML 구조 오류')
    files['index.html'] = html.replace('</head>', bootstrap + '\n</head>').encode()
    output = root / '.ci-artifacts'
    if output.is_symlink():
        raise ValueError('출력 symlink 거부')
    output.mkdir(mode=0o700, exist_ok=True)
    release = output / ('front-' + revision + '-' + run_id)
    release.mkdir(mode=0o700)
    archive = release / 'release.tar'
    with tarfile.open(archive, 'x', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in sorted(files.items()):
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime = len(data), 0o644, 0
            tar.addfile(info, io.BytesIO(data))
    archive.chmod(0o600)
    receipt = {'phase': 'prepared_only', 'deployment_enabled': False,
               'execution_origin': ('github_actions' if os.environ.get('GITHUB_ACTIONS') == 'true'
                                    else 'local_isolated'), 'github_run_verified': False,
               'target_root': TARGET, 'revision': revision, 'run_id': run_id,
               'created_at': now, 'bundle': bundle, 'archive_sha256': sha(archive.read_bytes()),
               'files': {n: sha(b) for n, b in sorted(files.items())},
               'remote_authentication': False, 'production_changed': False}
    if os.environ.get('FRONT_PRODUCTION_CANDIDATE') == 'true':
        profile_path = root / '.ci-artifacts/build-input-profile.json'
        if profile_path.is_symlink() or not profile_path.is_file():
            raise ValueError('운영 후보 입력 profile 누락')
        profile = json.loads(profile_path.read_text())
        if profile.get('profile') != 'production_candidate' or profile.get('all_required_present') is not True:
            raise ValueError('운영 후보 입력 profile 오류')
        receipt['build_input_profile'] = profile
        receipt['candidate_kind'] = 'production_candidate_unpublished'
    p = release / 'receipt.json'
    p.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    p.chmod(0o600)
    with tarfile.open(archive) as tar:
        restored = {m.name: sha(tar.extractfile(m).read()) for m in tar.getmembers()}
    if restored != receipt['files']:
        raise ValueError('archive 재읽기 불일치')
    if sha(archive.read_bytes()) != receipt['archive_sha256']:
        raise ValueError('전체 archive SHA 재읽기 불일치')
    return {'release': str(release), 'files': len(files),
            'archive_sha256': receipt['archive_sha256'], 'production_changed': False}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--revision', required=True)
    p.add_argument('--run-id', required=True)
    p.add_argument('--target', required=True)
    args = p.parse_args()
    try:
        head = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'],
                                       text=True, timeout=10).strip()
        if head != args.revision:
            raise ValueError('checkout HEAD와 revision 불일치')
        print(json.dumps(prepare(ROOT, args.revision, args.run_id, args.target)))
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit('준비 중단: ' + str(error)) from None


if __name__ == '__main__':
    main()
