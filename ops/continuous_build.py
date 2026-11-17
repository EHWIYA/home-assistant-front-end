#!/usr/bin/python3
"""고정 관리자 경로의 비공개 프런트 빌드. 앱 코드는 격리 컨테이너에서만 실행한다."""
import argparse
import contextlib
import datetime as dt
import fcntl
import gzip
import hashlib
from html.parser import HTMLParser
import hmac
import io
import json
import os
from pathlib import Path
import pwd
import re
import selectors
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import time
import urllib.request
from urllib.parse import unquote, urlsplit

CONFIG = Path('/etc/iot-web-publisher/build.json')
STORE = Path('/mnt/HDD500GB/backups/managed/staging/front-release-store')
BOOTSTRAP = Path('/usr/local/libexec/iot-web-publisher/pwa-deploy-bootstrap.html')
MODULE = Path('/usr/local/libexec/iot-web-publisher/continuous_build.py')
GUARD = Path('/home/iwh/scripts/nas-build-guard/workload.py')
TARGET = '/home/iwh/apps/iot/web/dist'
REPO = 'EHWIYA/home-assistant-front-end'
KEYS = {'schema', 'image_id', 'inputs_file', 'nonce_file', 'store', 'cache', 'uid', 'gid', 'bootstrap_file'}
NAMES = ['VITE_API_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN',
         'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID',
         'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_VAPID_KEY']
INPUTS = set(NAMES) | {'VITE_API_BASE_URL', 'VITE_USE_MOCK'}
SOURCE_COMPRESSED = 16 * 1024 * 1024
SOURCE_LIMIT = 64 * 1024 * 1024
FILE_LIMIT = 8 * 1024 * 1024
OUTPUT_LIMIT = 16 * 1024 * 1024
LOG_LIMIT = 8 * 1024 * 1024
LEASE_PATH = Path('/home/iwh/.cache/nas-workload/exclusive.lock')
_LEASE_FD = None
_STOP_REQUESTED = False
HDD = Path('/mnt/HDD500GB')
HDD_UUID = Path('/dev/disk/by-uuid/da1072f7-6685-4ad3-b0df-ab6892bc77ac')
STORAGE_RESERVE = 2 * 1024 * 1024 * 1024


class BuildError(RuntimeError):
    """입력·출력 원문을 예외에 넣지 않는 빌드 실패."""


class BuildDeferred(BuildError):
    """다른 빌드/자원 부족으로 운영 쓰기 없이 대기한다."""


class _FixtureConfig(dict):
    pass


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def decode(raw):
    def unique(items):
        result = {}
        for key, value in items:
            if key in result:
                raise BuildError('duplicate JSON key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique)


def no_symlinks(path):
    path = Path(path)
    if not path.is_absolute() or path != Path(os.path.normpath(path)):
        raise BuildError('path format')
    for part in [*reversed(path.parents), path]:
        try:
            if stat.S_ISLNK(part.lstat().st_mode):
                raise BuildError('symlink path')
        except FileNotFoundError:
            continue


def private_read(path, owner, limit=65536, public=False):
    path = Path(path)
    no_symlinks(path)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        modes = {0o600, 0o640, 0o644} if public else {0o600}
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != owner or
                stat.S_IMODE(info.st_mode) not in modes or info.st_size > limit):
            raise BuildError('trusted file permission/size')
        raw = os.read(fd, limit + 1)
        if len(raw) > limit:
            raise BuildError('trusted file size')
        return raw
    finally:
        os.close(fd)


def fixture_config(root, image_id='sha256:' + 'a' * 64, trust_uid=None):
    """부모의 명시적 격리 검사 전용. 실제 CLI에는 fixture/root override가 없다."""
    root = Path(root).absolute()
    no_symlinks(root)
    if (root == Path('/home/iwh/apps') or Path('/home/iwh/apps') in root.parents or
            root == STORE or STORE in root.parents or root in {Path('/'), Path('/etc'), Path('/var/lib')}):
        raise BuildError('fixture production path')
    config = _FixtureConfig(schema=1, image_id=image_id, inputs_file=str(root / 'inputs.env'),
                            nonce_file=str(root / 'nonce'), store=str(root), cache=str(root / 'cache'),
                            uid=os.getuid(), gid=os.getgid(), bootstrap_file=str(root / 'bootstrap.html'))
    config.trust_uid = os.getuid() if trust_uid is None else trust_uid
    return config


def validate_config(config):
    if set(config) != KEYS or config['schema'] != 1:
        raise BuildError('build config schema')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', str(config['image_id'])):
        raise BuildError('fixed image digest')
    fixture = isinstance(config, _FixtureConfig)
    if not fixture:
        role = pwd.getpwnam('iot-web-publisher')
        fixed = {'inputs_file': '/etc/iot-web-publisher/build-inputs.env',
                 'nonce_file': '/etc/iot-web-publisher/build-input-nonce', 'store': str(STORE),
                 'cache': str(STORE / 'cache'), 'bootstrap_file': str(BOOTSTRAP),
                 'uid': role.pw_uid, 'gid': role.pw_gid}
        if any(config[k] != v for k, v in fixed.items()):
            raise BuildError('fixed build config mismatch')
    for name in ['store', 'cache', 'inputs_file', 'nonce_file', 'bootstrap_file']:
        no_symlinks(Path(config[name]))
    if not fixture:
        verify_hdd()
    return config.trust_uid if fixture else 0


def verify_hdd():
    """controller와 별개로 실제 빌드 직전 HDD fallback 쓰기를 거부한다."""
    no_symlinks(HDD)
    no_symlinks(STORE)
    try:
        if not os.path.ismount(HDD):
            raise BuildError('HDD mount missing')
        device = os.stat(HDD_UUID)
        if (not stat.S_ISBLK(device.st_mode) or device.st_rdev != os.stat(HDD).st_dev or
                os.stat(STORE).st_dev != device.st_rdev):
            raise BuildError('HDD UUID/device mismatch')
    except OSError:
        raise BuildError('HDD unavailable') from None


def storage_ready_path(store):
    """CI가 바꿀 수 없는 고정 여유 공간. 자동 정리나 상한 완화는 하지 않는다."""
    try:
        if shutil.disk_usage(store).free < STORAGE_RESERVE:
            raise BuildDeferred('private build storage reserve')
    except OSError:
        raise BuildDeferred('private build storage unavailable') from None


def load_config(path=CONFIG):
    if Path(path) != CONFIG:
        raise BuildError('fixed config path')
    if stat.S_IMODE(Path(path).lstat().st_mode) not in {0o600, 0o640}:
        raise BuildError('build config permissions')
    config = decode(private_read(path, 0, public=True))
    validate_config(config)
    return config


def validate_request(request):
    if (set(request) != {'run_id', 'attempt', 'sha'} or
            type(request['run_id']) is not int or not 0 < request['run_id'] < 10**20 or
            type(request['attempt']) is not int or not 0 < request['attempt'] < 10000 or
            not re.fullmatch(r'[0-9a-f]{40}', str(request['sha']))):
        raise BuildError('build request schema')


def read_inputs(config):
    owner = validate_config(config)
    raw = private_read(config['inputs_file'], owner)
    values = {}
    try:
        for line in raw.decode().splitlines():
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            name, separator, text = line.partition('=')
            if not separator or name not in INPUTS or name in values:
                raise BuildError('private input names')
            tokens = shlex.split(text, comments=True)
            if (len(tokens) != 1 or not tokens[0].strip() or len(tokens[0]) > 8192 or
                    any(ord(char) < 32 or ord(char) == 127 for char in tokens[0])):
                raise BuildError('private input format')
            values[name] = tokens[0]
    except (UnicodeError, ValueError):
        raise BuildError('private input format') from None
    if set(values) != INPUTS:
        raise BuildError('private input names')
    try:
        nonce = private_read(config['nonce_file'], owner, 1024).decode().strip()
    except UnicodeError:
        raise BuildError('private nonce format') from None
    if not re.fullmatch(r'[0-9a-f]{64}', nonce):
        raise BuildError('private nonce format')
    if values['VITE_API_BASE_URL'] != 'https://iot-api.iwhya.kr' or values['VITE_USE_MOCK'] != 'false':
        raise BuildError('API/mock input profile')
    profile = {'schema': 1, 'profile': 'production_candidate', 'nonce_tag': digest(nonce.encode()),
               'required_names': NAMES, 'all_required_present': True, 'api_base_matches': True,
               'mock_disabled': True,
               'input_hmacs': {name: hmac.new(values[name].encode(), (nonce + ':' + name).encode(),
                                              hashlib.sha256).hexdigest() for name in NAMES},
               'verification_scope': '입력 존재·정적 profile 지문, 실사용 인증/FCM 성공 주장 아님'}
    return values, nonce, profile


class _Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, newurl):
        url = urlsplit(newurl)
        if url.scheme != 'https' or url.hostname != 'codeload.github.com' or url.username or url.password:
            raise BuildError('source redirect')
        return super().redirect_request(request, response, code, message, headers, newurl)


def fetch_source(sha):
    if not re.fullmatch('[0-9a-f]{40}', sha):
        raise BuildError('source sha')
    request = urllib.request.Request('https://api.github.com/repos/' + REPO + '/tarball/' + sha,
                                     headers={'User-Agent': 'iot-web-private-build/1'})
    try:
        with urllib.request.build_opener(_Redirect()).open(request, timeout=20) as response:
            if response.status != 200:
                raise BuildError('source HTTP')
            raw = response.read(SOURCE_COMPRESSED + 1)
    except Exception as error:
        raise BuildError('source download ' + type(error).__name__) from None
    if len(raw) > SOURCE_COMPRESSED:
        raise BuildError('source compressed limit')
    return raw


def bounded_source_tar(raw):
    """TarInfo가 숨겨 처리하는 PAX/압축 폭탄도 파싱 전에 상한으로 막는다."""
    if not 0 < len(raw) <= SOURCE_COMPRESSED:
        raise BuildError('source compressed limit')
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as compressed:
            tar = compressed.read(SOURCE_LIMIT + 4 * 1024 * 1024 + 1)
    except Exception as error:
        raise BuildError('source gzip ' + type(error).__name__) from None
    if not tar or len(tar) > SOURCE_LIMIT + 4 * 1024 * 1024 or len(tar) % 512:
        raise BuildError('source tar expanded bound')
    offset, entries, metadata = 0, 0, 0
    while offset < len(tar):
        header = tar[offset:offset + 512]
        if header == bytes(512):
            if any(tar[offset:]):
                raise BuildError('source tar trailing bytes')
            return tar
        size = header[124:136].rstrip(b'\0 ').strip()
        kind = header[156:157]
        if not re.fullmatch(rb'[0-7]{1,12}', size) or kind not in {b'0', b'\0', b'5', b'x', b'g'}:
            raise BuildError('source tar header/link type')
        size = int(size, 8)
        if kind in {b'x', b'g'}:
            metadata += size
            if size > 8192 or metadata > 1024 * 1024:
                raise BuildError('source tar metadata bound')
        elif size > FILE_LIMIT:
            raise BuildError('source tar member bound')
        entries += 1
        offset += 512 + ((size + 511) // 512) * 512
        if offset > len(tar) or entries > 8192:
            raise BuildError('source tar structural bound')
    raise BuildError('source tar missing end marker')


def extract_source(raw, workspace, uid, gid):
    tar = bounded_source_tar(raw)
    total, seen, prefix = 0, set(), None
    try:
        with tarfile.open(fileobj=io.BytesIO(tar), mode='r:') as archive:
            for member in archive:
                path = Path(member.name)
                normalized = os.path.normpath(member.name)
                if (path.is_absolute() or '..' in path.parts or '\\' in member.name or len(path.parts) > 32 or
                        len(member.name) > 512 or member.name not in {normalized, normalized + '/' if member.isdir() else normalized}):
                    # tar directory trailing slash is harmless and normalized by TarInfo.name.
                    raise BuildError('source member path')
                if not path.parts:
                    raise BuildError('source empty path')
                if prefix is None:
                    prefix = path.parts[0]
                if path.parts[0] != prefix:
                    raise BuildError('source multiple roots')
                parts = path.parts[1:]
                if not parts:
                    if not member.isdir():
                        raise BuildError('source root member')
                    continue
                name = Path(*parts)
                if name.parts[0] == '.git' or str(name) in seen:
                    raise BuildError('source duplicate/git path')
                seen.add(str(name))
                if len(seen) > 4096 or member.size < 0 or member.size > FILE_LIMIT:
                    raise BuildError('source entry bound')
                if not member.isdir() and not member.isfile():
                    raise BuildError('source link/special member')
                target = workspace / name
                if member.isdir():
                    target.mkdir(mode=0o700, parents=True, exist_ok=True)
                    continue
                total += member.size
                if total > SOURCE_LIMIT:
                    raise BuildError('source expanded limit')
                target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                data = archive.extractfile(member).read(FILE_LIMIT + 1)
                if len(data) != member.size:
                    raise BuildError('source truncated member')
                with target.open('xb') as stream:
                    stream.write(data)
                target.chmod(0o755 if member.mode & 0o111 else 0o644)
        if not (workspace / 'package.json').is_file() or not (workspace / 'package-lock.json').is_file():
            raise BuildError('source package files')
        for path in [workspace, *workspace.rglob('*')]:
            if os.geteuid() == 0:
                os.chown(path, uid, gid)
            if path.is_dir():
                path.chmod(0o755)
    except BuildError:
        raise
    except Exception as error:
        raise BuildError('source archive ' + type(error).__name__) from None


def _save(path, raw, mode=0o600):
    path = Path(path)
    with path.open('xb') as stream:
        os.fchmod(stream.fileno(), mode)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())


def _redact(raw, secrets):
    text = raw.decode(errors='replace') if isinstance(raw, bytes) else str(raw)
    for value in sorted(set(secrets), key=len, reverse=True):
        if value:
            text = text.replace(value, '[redacted-input]')
    return text.encode()


def _run_bounded(name, argv, timeout):
    """raw stdout는 메모리 상한 안에만 존재하며 호출자가 private redacted log로 저장한다."""
    if _LEASE_FD is None:
        raise BuildError('NAS workload lease missing')
    inherited = os.fstat(_LEASE_FD)
    expected = LEASE_PATH.stat()
    if (inherited.st_dev, inherited.st_ino) != (expected.st_dev, expected.st_ino):
        raise BuildError('NAS workload lease inode')
    fcntl.flock(_LEASE_FD, fcntl.LOCK_EX | fcntl.LOCK_NB)
    storage_ready_path(STORE)
    process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               pass_fds=(_LEASE_FD,),
                               start_new_session=True, env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'})
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    output, end = bytearray(), time.monotonic() + timeout
    try:
        while selector.get_map():
            if _STOP_REQUESTED or time.monotonic() > end:
                raise BuildError('build timeout')
            storage_ready_path(STORE)
            for key, _ in selector.select(.2):
                part = os.read(key.fileobj.fileno(), 65536)
                if not part:
                    selector.unregister(key.fileobj)
                    continue
                if len(output) + len(part) > LOG_LIMIT:
                    raise BuildError('build output limit')
                output.extend(part)
        code = process.wait(timeout=max(.1, end - time.monotonic()))
        return {'returncode': code, 'output': bytes(output)}
    finally:
        selector.close()
        old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGHUP, signal.SIGINT})
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        process.stdout.close()
        signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)


def cleanup_build(build_id, config, runner=subprocess.run):
    """이번 root UUID의 label·image가 일치하는 일회성 컨테이너만 회수한다."""
    if not re.fullmatch('[0-9a-f]{32}', build_id):
        raise BuildError('cleanup build id')
    validate_config(config)
    if not isinstance(config, _FixtureConfig):
        if os.geteuid() != 0:
            raise BuildError('root cleanup required')
        request = decode(private_read(STORE / 'builds' / build_id / 'request.json', 0, 262144))
        if (set(request) != {'request', 'ci_profile', 'config_sha256', 'build_id'} or
                request['build_id'] != build_id or
                request['config_sha256'] != digest(json.dumps(config, sort_keys=True).encode())):
            raise BuildError('root cleanup request proof')
        validate_request(request['request'])
    old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGHUP, signal.SIGINT})
    try:
        for phase in ['install', 'build']:
            name = 'front-private-' + build_id + '-' + phase
            check = runner(['/usr/bin/docker', 'inspect', '--format',
                            '{"labels":{{json .Config.Labels}},"image":{{json .Image}}}', name],
                           capture_output=True, timeout=5)
            if check.returncode:
                continue
            item = decode(check.stdout)
            if (item.get('labels', {}).get('io.iwh.front-build') != build_id or
                    item.get('image') != config['image_id']):
                raise BuildError('cleanup ownership mismatch')
            removed = runner(['/usr/bin/docker', 'rm', '-f', name], capture_output=True, timeout=10)
            if removed.returncode:
                raise BuildError('own build cleanup failed')
    except BuildError:
        raise
    except Exception as error:
        raise BuildError('own build cleanup ' + type(error).__name__) from None
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'link', 'img'}:
            self.refs.extend(value for key, value in attrs if key in {'src', 'href'} and value)


def package_candidate(workspace, work_root, request, profile, bootstrap):
    dist = workspace / 'dist'
    no_symlinks(dist)
    if not dist.is_dir():
        raise BuildError('dist missing')
    files, total = {}, 0
    for path in sorted(dist.rglob('*')):
        if path.is_symlink() or not (path.is_dir() or path.is_file()):
            raise BuildError('dist link/special member')
        if path.is_dir():
            continue
        name = path.relative_to(dist).as_posix()
        allowed = (name in {'index.html', 'manifest.webmanifest', 'sw-v3.js', 'firebase-messaging-sw.js'} or
                   re.fullmatch(r'workbox-[A-Za-z0-9_-]+\.js', name) or
                   re.fullmatch(r'(assets|icons)/[A-Za-z0-9_./-]+\.(js|css|png|svg|jpg|jpeg|ico|woff|woff2|ttf)', name))
        if (not allowed or any(part.startswith('.') for part in path.relative_to(dist).parts) or
                re.search(r'(secret|credential|private|token|password)', name, re.I) or
                path.stat().st_size > FILE_LIMIT):
            raise BuildError('dist file allowlist/limit')
        total += path.stat().st_size
        if len(files) >= 1024 or total > 32 * 1024 * 1024:
            raise BuildError('dist total limit')
        files[name] = path.read_bytes()
    if not {'index.html', 'manifest.webmanifest', 'sw-v3.js', 'firebase-messaging-sw.js'} <= files.keys():
        raise BuildError('dist required files')
    html = files['index.html'].decode()
    parser = References()
    parser.feed(html)
    for reference in parser.refs:
        url = urlsplit(reference)
        if not url.path and not url.netloc:
            continue
        name = unquote(url.path).lstrip('/')
        if url.scheme or url.netloc or '..' in Path(name).parts or name not in files:
            raise BuildError('dist HTML reference')
    bundles = re.findall(r'assets/(index-[A-Za-z0-9_-]+\.js)', html)
    if len(set(bundles)) != 1 or b'https://iot-api.iwhya.kr' not in files.get('assets/' + bundles[0], b''):
        raise BuildError('dist bundle/API reference')
    for icon in decode(files['manifest.webmanifest']).get('icons', []):
        if icon['src'].lstrip('/') not in files:
            raise BuildError('dist manifest icon')
    if '<!-- iot-pwa-deploy-bootstrap -->' in html or html.count('</head>') != 1:
        raise BuildError('dist bootstrap structure')
    files['index.html'] = html.replace('</head>', bootstrap.decode() + '\n</head>').encode()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    files['version.json'] = (json.dumps({'bundle': bundles[0], 'prepared_at': now, 'deployed_at': None,
                                       'phase': 'prepared_only', 'app': 'hwiyaIoT'}) + '\n').encode()
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, data in sorted(files.items()):
            member = tarfile.TarInfo(name)
            member.size, member.mode, member.mtime = len(data), 0o644, 0
            archive.addfile(member, io.BytesIO(data))
    raw = output.getvalue()
    if len(raw) > OUTPUT_LIMIT:
        raise BuildError('candidate archive limit')
    receipt = {'phase': 'prepared_only', 'deployment_enabled': False, 'execution_origin': 'local_isolated',
               'github_run_verified': False, 'target_root': TARGET, 'revision': request['sha'],
               'run_id': str(request['run_id']), 'created_at': now, 'bundle': bundles[0],
               'archive_sha256': digest(raw), 'files': {name: digest(data) for name, data in sorted(files.items())},
               'remote_authentication': False, 'production_changed': False, 'build_input_profile': profile,
               'candidate_kind': 'production_candidate_unpublished'}
    profile_sha = digest(json.dumps(profile, sort_keys=True).encode())
    provenance = {'schema': 1, 'archive_sha256': digest(raw), 'source_revision': request['sha'],
                  'build_mode': 'private-local-build', 'input_profile_digest': profile_sha}
    paths = {'archive_path': work_root / 'candidate.tar', 'receipt_path': work_root / 'receipt.json',
             'provenance_path': work_root / 'provenance.json'}
    for key, data in [('archive_path', raw), ('receipt_path', json.dumps(receipt, ensure_ascii=False, indent=2).encode()),
                      ('provenance_path', json.dumps(provenance).encode())]:
        _save(paths[key], data)
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        reread = {member.name: digest(archive.extractfile(member).read()) for member in archive}
    if reread != receipt['files']:
        raise BuildError('candidate readback')
    return {**{key: str(value) for key, value in paths.items()}, 'profile_sha256': profile_sha,
            'archive_sha256': digest(raw), 'files': len(files)}


def verify_compiled(workspace, values):
    """지문 존재와 실제 bundle/worker의 입력 사용을 구분해 확인한다."""
    dist = workspace / 'dist'
    no_symlinks(dist)
    html_path = dist / 'index.html'
    no_symlinks(html_path)
    if not html_path.is_file() or html_path.stat().st_size > FILE_LIMIT:
        raise BuildError('compiled HTML file')
    html = html_path.read_text()
    bundles = re.findall(r'assets/(index-[A-Za-z0-9_-]+\.js)', html)
    if len(set(bundles)) != 1:
        raise BuildError('compiled bundle ambiguity')
    bundle_path = dist / 'assets' / bundles[0]
    worker_path = dist / 'firebase-messaging-sw.js'
    for path in [bundle_path, worker_path]:
        no_symlinks(path)
        if not path.is_file() or path.stat().st_size > FILE_LIMIT:
            raise BuildError('compiled input file')
    bundle = bundle_path.read_text()
    worker = worker_path.read_text()
    match = re.search(r'firebase\.initializeApp\((\{[\s\S]*?\})\);', worker)
    if not match:
        raise BuildError('compiled Firebase initialization')
    try:
        actual = decode(match[1])
    except (ValueError, TypeError):
        raise BuildError('compiled Firebase configuration') from None
    names = {'apiKey': 'VITE_FIREBASE_API_KEY', 'authDomain': 'VITE_FIREBASE_AUTH_DOMAIN',
             'projectId': 'VITE_FIREBASE_PROJECT_ID', 'messagingSenderId': 'VITE_FIREBASE_MESSAGING_SENDER_ID',
             'appId': 'VITE_FIREBASE_APP_ID'}
    if (any(actual.get(key) != values[name] for key, name in names.items()) or
            values['VITE_API_KEY'] not in bundle or values['VITE_FIREBASE_VAPID_KEY'] not in bundle):
        raise BuildError('compiled input mismatch')


def _build(request, work_root, config, ci_profile, runner, source_loader):
    storage_ready_path(Path(config['store']))
    values, nonce, profile = read_inputs(config)
    if ci_profile != profile:
        raise BuildError('CI/private input profile mismatch')
    bootstrap = private_read(config['bootstrap_file'], validate_config(config), 16384, public=True)
    if b'<!-- iot-pwa-deploy-bootstrap -->' not in bootstrap:
        raise BuildError('trusted bootstrap marker')
    workspace = work_root / 'workspace'
    workspace.mkdir(mode=0o700)
    raw = source_loader(request['sha'])
    _save(work_root / 'source.tar.gz', raw)
    extract_source(raw, workspace, config['uid'], config['gid'])
    cache = Path(config['cache'])
    storage_ready_path(Path(config['store']))
    if not cache.exists():
        cache.mkdir(mode=0o700)
        if os.geteuid() == 0:
            os.chown(cache, config['uid'], config['gid'])
    if cache.is_symlink() or not cache.is_dir():
        raise BuildError('cache directory')
    info = cache.stat()
    if info.st_uid != config['uid'] or info.st_gid != config['gid'] or stat.S_IMODE(info.st_mode) != 0o700:
        raise BuildError('private cache owner/permission')
    envfile = work_root / 'selected-build-inputs.env'
    _save(envfile, ''.join(name + '=' + values[name] + '\n' for name in sorted(INPUTS)).encode())
    image = config['image_id']
    common = ['/usr/bin/docker', 'run', '--rm', '--read-only', '--log-driver', 'none',
              '--user', f"{config['uid']}:{config['gid']}",
              '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '2g', '--cpus', '1',
              '--pids-limit', '256', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m', '--env', 'HOME=/tmp',
              '--volume', str(workspace) + ':/work', '--workdir', '/work']
    results = []
    hidden = [*values.values(), nonce]
    def run(name, args, timeout, container=None):
        started = time.monotonic()
        try:
            row = runner(name, args, timeout)
            output = row.get('output', b'')
            _save(work_root / (name + '.log'), _redact(output, hidden))
            if type(row.get('returncode')) is not int or row['returncode'] != 0:
                raise BuildError('build command failed')
            results.append({'name': name, 'exit': 0, 'seconds': round(time.monotonic() - started, 3)})
        except BaseException as error:
            if container and runner is _run_bounded:
                cleanup_build(work_root.name, config)
            if isinstance(error, BuildDeferred):
                raise BuildDeferred('build stage ' + name + ' storage unavailable') from None
            raise BuildError('build stage ' + name + ' ' + type(error).__name__) from None
    inspected = runner('inspect-image', ['/usr/bin/docker', 'image', 'inspect', '--format', '{{.Id}}', image], 15)
    actual_image = inspected.get('output', b'')
    if isinstance(actual_image, bytes):
        actual_image = actual_image.decode(errors='replace')
    if inspected.get('returncode') != 0 or actual_image.strip() != image:
        raise BuildError('cached fixed image missing/mismatch')
    build_id = work_root.name
    install_name, build_name = 'front-private-' + build_id + '-install', 'front-private-' + build_id + '-build'
    run('install', [*common[:3], '--name', install_name, '--label', 'io.iwh.front-build=' + build_id,
                    *common[3:], '--volume', str(cache) + ':/npmcache',
                    '--env', 'npm_config_cache=/npmcache', image, 'npm', 'ci', '--no-audit', '--no-fund',
                    '--registry=https://registry.npmjs.org'], 600, install_name)
    run('offline-build', [*common[:3], '--name', build_name, '--label', 'io.iwh.front-build=' + build_id,
                          *common[3:], '--network', 'none', '--env-file',
                          str(envfile), image, 'npm', 'run', 'build'], 600, build_name)
    verify_compiled(workspace, values)
    result = package_candidate(workspace, work_root, request, profile, bootstrap)
    result.update(request=request, results=results, source_archive_sha256=digest(raw), private_build=True,
                  public_upload=False, source_ci_verification='caller-responsibility')
    _save(work_root / 'result.json', json.dumps(result, ensure_ascii=False, indent=2).encode())
    return result


def build_candidate(request, work_root, config, ci_profile, runner=None, source_loader=None):
    """공식 완료 CI 확인은 호출자 책임. production Docker 단계는 공통 guard 아래에서만 실행한다."""
    validate_request(request)
    owner = validate_config(config)
    storage_ready_path(Path(config['store']))
    work_root = Path(work_root).absolute()
    no_symlinks(work_root)
    if work_root.parent != Path(config['store']) / 'builds' or not re.fullmatch('[0-9a-f]{32}', work_root.name):
        raise BuildError('fixed build slot path')
    if work_root.exists():
        raise BuildError('existing build preserved')
    # private 입력과 CI 지문을 작업 생성/네트워크/컨테이너보다 먼저 검증한다.
    _, _, expected = read_inputs(config)
    if ci_profile != expected:
        raise BuildError('CI/private input profile mismatch')
    work_root.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    work_root.mkdir(mode=0o700)
    if isinstance(config, _FixtureConfig):
        if runner is None or source_loader is None:
            raise BuildError('fixture requires explicit runner/source')
        return _build(request, work_root, config, ci_profile, runner, source_loader)
    if os.geteuid() != 0 or runner is not None or source_loader is not None:
        raise BuildError('production root fixed launcher required')
    _save(work_root / 'request.json', json.dumps({'request': request, 'ci_profile': ci_profile,
                                                'build_id': work_root.name,
                                                'config_sha256': digest(json.dumps(config, sort_keys=True).encode())}).encode())
    log = work_root / 'guard.log'
    # child 내부 명령 output은 private redacted 파일에만 남기며 guard에는 요약만 출력한다.
    with log.open('xb') as stream:
        os.fchmod(stream.fileno(), 0o600)
        child = subprocess.Popen(['/usr/bin/python3', '-I', '-B', str(MODULE), '--build-id', work_root.name],
                                 stdout=stream, stderr=subprocess.STDOUT, start_new_session=True,
                                 env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'})
        try:
            code = child.wait(timeout=1300)
        finally:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
                cleanup_build(work_root.name, config)
    if code:
        cleanup_build(work_root.name, config)
        if code == 2:
            raise BuildDeferred('NAS build guard busy/resources unavailable')
        raise BuildError('NAS build guard refused/failed')
    return decode(private_read(work_root / 'result.json', owner, 262144))


def main(argv=None):
    global _LEASE_FD, _STOP_REQUESTED
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--build-id')
    group.add_argument('--cleanup-build-id')
    args = parser.parse_args(argv)
    build_id = args.build_id or args.cleanup_build_id
    if os.geteuid() != 0 or not re.fullmatch('[0-9a-f]{32}', build_id):
        raise BuildError('fixed root build id')
    # root의 Path.home() 기본값으로 별도 lock을 만들지 않는다. 공통 guard의 같은 구현에
    # NAS의 기존 iwh lock 경로를 명시해 관리자 실행에서도 기존 빌드와 직렬화한다.
    sys.path.insert(0, '/home/iwh/apps/chcar')
    from tools.host_workload import WorkloadBusy, WorkloadLease
    from tools.check_android_resources import inspect
    config = load_config()
    work_root = STORE / 'builds' / build_id
    request = decode(private_read(work_root / 'request.json', 0, 262144))
    if (set(request) != {'request', 'ci_profile', 'config_sha256', 'build_id'} or
            request['build_id'] != build_id or
            request['config_sha256'] != digest(json.dumps(config, sort_keys=True).encode())):
        raise BuildError('guard child request')
    validate_request(request['request'])
    if args.cleanup_build_id:
        cleanup_build(build_id, config)
        print(json.dumps({'cleanup_checked': True, 'build_id': build_id}))
        return
    def stop(_signal, _frame):
        global _STOP_REQUESTED
        _STOP_REQUESTED = True
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGHUP, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        with WorkloadLease('build', LEASE_PATH) as lease:
            _LEASE_FD = lease.fd
            summary = io.StringIO()
            with contextlib.redirect_stdout(summary):
                ready = inspect('build')
            if ready:
                raise BuildDeferred('NAS resource guard refused')
            result = _build(request['request'], work_root, config, request['ci_profile'], _run_bounded, fetch_source)
            if _STOP_REQUESTED:
                cleanup_build(build_id, config)
                raise BuildError('build session stopped')
    except WorkloadBusy:
        raise BuildDeferred('NAS workload busy') from None
    finally:
        _LEASE_FD = None
    print(json.dumps({'private_build': True, 'files': result['files'], 'public_upload': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': type(error).__name__}), file=sys.stderr)
        raise SystemExit(2 if isinstance(error, BuildDeferred) else 1)
