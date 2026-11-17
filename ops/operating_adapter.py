#!/usr/bin/env python3
"""고정 운영 경로의 최소 권한 승격 어댑터. 운영 정책은 기본 비활성이다."""
import argparse
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import fcntl
import io
import json
import os
from pathlib import Path
import pwd
import re
import signal
import stat
import sys
import tarfile
import time
import urllib.request

# -I에서도 환경/PYTHONPATH를 사용하지 않고 설치된 형제 core만 가져온다.
_package = Path(__file__).resolve().parent
if str(_package) == '/usr/local/libexec/iot-web-publisher':
    _info = _package.stat()
    if _info.st_uid != 0 or _info.st_mode & 0o022:
        raise PermissionError('설치 package 소유자/권한 오류')
sys.path.insert(0, str(_package))
import frontend_publish as core

ID = re.compile(r'[0-9a-f]{32}')
SHA = re.compile(r'[0-9a-f]{64}')
REV = re.compile(r'[0-9a-f]{40}')
POLICY_KEYS = {'schema', 'enabled', 'target', 'policy_id', 'approved_until',
               'source_revision', 'ci_run', 'ci_attempt', 'current_main', 'archive_sha256',
               'receipt_sha256', 'backup_sha256', 'baseline_sha', 'input_profile_digest'}
OPERATIONS = {'readiness', 'audit', 'publish', 'rollback', 'recover'}
REQUIRED_JOBS = {'OIDC and NAS transport verification', 'build-stage-artifact',
                 'verify-input-profile', 'stage-only'}
REPO = 'EHWIYA/home-assistant-front-end'
HDD_UUID_PATH = Path('/dev/disk/by-uuid/da1072f7-6685-4ad3-b0df-ab6892bc77ac')


@dataclass(frozen=True)
class OperatingLayout:
    policy: Path = Path('/etc/iot-web-publisher/policy.json')
    live: Path = Path(core.TARGET)
    candidate: Path = Path('/home/iwh/apps/iot/web/.publisher-candidate')
    previous: Path = Path('/home/iwh/apps/iot/web/.publisher-previous')
    state: Path = Path('/var/lib/iot-web-publisher/state')
    inbox: Path = Path('/mnt/HDD500GB/backups/managed/staging/front-publisher-inbox')
    requests: Path = Path('/var/lib/iot-web-publisher/requests')
    results: Path = Path('/var/lib/iot-web-publisher/results')
    lock: Path = Path('/home/iwh/.cache/iot-stack-watchdog.lock')
    markers: tuple = (Path('/var/lib/nas-maintenance/iot.json'),
                      Path('/home/iwh/.local/state/iot-operations/deploy-active.json'))
    trust_uid: int = 0
    live_uid: int = -1
    fixture_root: Path | None = None

    @classmethod
    def fixture(cls, root, *, trust_uid=0, live_uid=None):
        """라이브 CLI에서 임의 경로로 호출하지 않는 명시적 테스트 factory."""
        root = Path(root).absolute()
        return cls(root / 'policy.json', root / 'web/dist', root / 'web/.publisher-candidate',
                   root / 'web/.publisher-previous', root / 'state', root / 'inbox',
                   root / 'requests', root / 'results', root / 'lock',
                   (root / 'maintenance.json', root / 'deploy-active.json'), trust_uid,
                   pwd.getpwnam('iwh').pw_uid if live_uid is None else live_uid, root)


def no_symlinks(path):
    path = Path(path)
    if not path.is_absolute() or path != Path(os.path.normpath(path)):
        raise PermissionError('경로 형식 거부')
    for item in [*reversed(path.parents), path]:
        info = item.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise PermissionError('경로 symlink 거부')


def trusted_read(path, layout, limit=core.RECEIPT_LIMIT):
    no_symlinks(path)
    before = path.lstat()
    if (not stat.S_ISREG(before.st_mode) or before.st_uid != layout.trust_uid or
            before.st_mode & 0o027 or stat.S_IMODE(before.st_mode) not in {0o600, 0o640}):
        raise PermissionError('root 신뢰 파일 소유자/권한 오류')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino):
            raise PermissionError('신뢰 파일 교체 감지')
        return core.read_descriptor(fd, limit, before.st_dev, {layout.trust_uid})
    finally:
        os.close(fd)


def policy_read(layout, *, now=None):
    raw = trusted_read(layout.policy, layout)
    policy = core.decode(raw)
    fixture_keys = {'scope', 'production'} if layout.fixture_root else set()
    if set(policy) != POLICY_KEYS | fixture_keys or policy['schema'] != 1 or type(policy['enabled']) is not bool:
        raise PermissionError('정책 schema 오류')
    if layout.fixture_root and (policy['scope'] != 'rehearsal' or policy['production'] is not False):
        raise PermissionError('격리 정책 범위 오류')
    if (policy['target'] != str(layout.live) or not ID.fullmatch(str(policy['policy_id'])) or
            not REV.fullmatch(str(policy['source_revision'])) or
            policy['current_main'] != policy['source_revision'] or
            type(policy['ci_run']) is not int or not 0 < policy['ci_run'] < 10**20 or
            type(policy['ci_attempt']) is not int or not 0 < policy['ci_attempt'] < 10000):
        raise PermissionError('정책 고정 대상/slot 오류')
    for name in ('archive_sha256', 'receipt_sha256', 'backup_sha256', 'baseline_sha', 'input_profile_digest'):
        if not SHA.fullmatch(str(policy[name])):
            raise PermissionError('정책 digest 형식 오류')
    if policy['enabled']:
        try:
            expires = datetime.fromisoformat(policy['approved_until'].replace('Z', '+00:00')).timestamp()
        except (ValueError, TypeError, AttributeError):
            raise PermissionError('승인 만료 형식 오류') from None
        left = expires - (time.time() if now is None else now)
        if not 0 < left <= 900:
            raise PermissionError('승인 만료 또는 15분 상한 초과')
    elif policy['approved_until'] is not None:
        raise PermissionError('비활성 정책의 만료 값 거부')
    return policy, core.digest(raw)


class OperatingContext(core.Context):
    def __init__(self, layout):
        self.layout = layout
        self.root = layout.state
        self.scope = 'rehearsal' if layout.fixture_root else 'production'
        self.owner_uids = {os.getuid(), layout.live_uid if layout.live_uid >= 0 else pwd.getpwnam('iwh').pw_uid}
        self.check()

    def check(self):
        for directory in (self.root, self.layout.live.parent):
            no_symlinks(directory)
        core.plain(self.root, True)
        device = self.layout.live.parent.stat().st_dev
        for name in ('live', 'candidate', 'previous'):
            path = getattr(self.layout, name)
            if path.exists() or path.is_symlink():
                info = core.plain(path, True, self.owner_uids)
                if info.st_dev != device or os.path.ismount(path):
                    raise PermissionError('운영 tree 장치/mount 오류')
        return self

    def tree(self, name):
        if name not in {'live', 'candidate', 'previous'}:
            raise PermissionError('고정 tree만 허용')
        self.check()
        return getattr(self.layout, name)


class DeadlineExpired(TimeoutError):
    pass


@contextmanager
def deadline(seconds):
    previous = signal.getsignal(signal.SIGALRM)
    remaining = signal.getitimer(signal.ITIMER_REAL)
    started = time.monotonic()
    def expired(_signum, _frame):
        raise DeadlineExpired('실행 시간 상한')
    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, min(seconds, remaining[0]) if remaining[0] else seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
        if remaining[0]:
            signal.setitimer(signal.ITIMER_REAL, max(0.001, remaining[0] - (time.monotonic() - started)), remaining[1])


def markers_clear(layout):
    for marker in layout.markers:
        try:
            marker.lstat()
        except FileNotFoundError:
            continue
        raise PermissionError('정비/배포 marker 또는 조회 오류')


class OperatingBoundary:
    def __init__(self, layout, recheck):
        self.layout, self.recheck = layout, recheck

    @contextmanager
    def enter(self):
        markers_clear(self.layout)
        no_symlinks(self.layout.lock)
        fd = os.open(self.layout.lock, os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK)
        acquired = False
        try:
            info = os.fstat(fd)
            live_uid = self.layout.live_uid if self.layout.live_uid >= 0 else pwd.getpwnam('iwh').pw_uid
            if not stat.S_ISREG(info.st_mode) or info.st_uid not in {self.layout.trust_uid, live_uid, os.getuid()}:
                raise PermissionError('공통 lock 신뢰 오류')
            stop = time.monotonic() + 3
            while True:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    acquired = True
                    break
                except BlockingIOError:
                    if time.monotonic() >= stop:
                        raise TimeoutError('공통 lock 3초 상한') from None
                    time.sleep(0.025)
            with deadline(15):
                markers_clear(self.layout)
                self.recheck()
                yield
        finally:
            if acquired:
                fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise PermissionError('GitHub redirect 거부')


def github_get(suffix):
    request = urllib.request.Request('https://api.github.com/repos/' + REPO + suffix,
                                     headers={'Accept': 'application/vnd.github+json',
                                              'User-Agent': 'iot-web-publisher/1'})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=3) as response:
        if response.status != 200:
            raise PermissionError('GitHub 응답 오류')
        data = response.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise PermissionError('GitHub 응답 크기 초과')
        return core.decode(data)


def github_verify(policy, get=github_get):
    repo = get('')
    head = get('/git/ref/heads/main')
    run = get(f"/actions/runs/{policy['ci_run']}/attempts/{policy['ci_attempt']}")
    jobs = get(f"/actions/runs/{policy['ci_run']}/attempts/{policy['ci_attempt']}/jobs?per_page=100")
    if (repo.get('id') != 1243065308 or repo.get('full_name') != REPO or
            head.get('object', {}).get('sha') != policy['source_revision'] or
            run.get('id') != policy['ci_run'] or run.get('run_attempt') != policy['ci_attempt'] or
            run.get('repository', {}).get('id') != 1243065308 or
            run.get('head_repository', {}).get('id') != 1243065308 or run.get('head_branch') != 'main' or
            run.get('head_sha') != policy['source_revision'] or run.get('path') != '.github/workflows/deploy.yml' or
            run.get('status') != 'completed' or run.get('conclusion') != 'success' or
            type(jobs.get('total_count')) is not int or jobs['total_count'] != len(jobs.get('jobs', []))):
        raise PermissionError('GitHub source/run/latest 검증 실패')
    matched = {}
    for job in jobs['jobs']:
        name = job.get('name')
        if name in REQUIRED_JOBS:
            if name in matched or job.get('status') != 'completed' or job.get('conclusion') != 'success':
                raise PermissionError('필수 GitHub job 검증 실패')
            matched[name] = True
    if set(matched) != REQUIRED_JOBS:
        raise PermissionError('필수 GitHub job 누락')
    return time.monotonic()


def backup_files(raw):
    """기존 파일의 전체 복구 tar를 읽기만 하며 링크/특수 파일은 거부한다."""
    files, total = {}, 0
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        for member in archive:
            name = member.name
            if name.startswith('./'):
                name = name[2:]
            if name.startswith('dist/'):
                name = name[5:]
            if member.isdir():
                if (member.pax_headers or name.startswith('/') or '..' in name.split('/') or
                        not re.fullmatch(r'[A-Za-z0-9_./-]+', name) or member.mode & 0o7000):
                    raise PermissionError('복구 tar 디렉터리 오류')
                continue
            if (not member.isfile() or member.pax_headers or not name or name.startswith('/') or
                    '..' in name.split('/') or name in files or member.size > core.FILE_LIMIT or
                    member.size < 0 or len(files) >= core.FILE_COUNT_LIMIT):
                raise PermissionError('복구 tar 형식 오류')
            total += member.size
            if total > core.TREE_LIMIT:
                raise PermissionError('복구 tar 크기 초과')
            files[name] = core.digest(archive.extractfile(member).read())
    return files


def manifest_sha(files):
    return core.digest(json.dumps(files, sort_keys=True, separators=(',', ':')).encode())


def backup_manifest(raw):
    return manifest_sha(backup_files(raw))


def verify_hdd(layout):
    if layout.fixture_root:
        return
    mount = Path('/mnt/HDD500GB')
    no_symlinks(mount)
    no_symlinks(layout.inbox)
    if not os.path.ismount(mount):
        raise PermissionError('고정 HDD mount 없음')
    device = os.stat(HDD_UUID_PATH)
    if (not stat.S_ISBLK(device.st_mode) or device.st_rdev != os.stat(mount).st_dev or
            device.st_rdev != os.stat(layout.inbox).st_dev):
        raise PermissionError('고정 HDD UUID/장치 불일치')


def audit_inputs(layout, policy):
    verify_hdd(layout)
    raw = trusted_read(layout.inbox / 'candidate.tar', layout, core.ARCHIVE_LIMIT)
    receipt = trusted_read(layout.inbox / 'receipt.json', layout)
    backup = trusted_read(layout.inbox / 'backup.tar', layout, core.TREE_LIMIT + 4 * 1024 * 1024)
    provenance = core.decode(trusted_read(layout.inbox / 'provenance.json', layout))
    if any(core.digest(data) != policy[key] for data, key in
           ((raw, 'archive_sha256'), (receipt, 'receipt_sha256'), (backup, 'backup_sha256'))):
        raise PermissionError('inbox digest 불일치')
    expected = {'schema': 1, 'archive_sha256': policy['archive_sha256'],
                'source_revision': policy['source_revision'], 'build_mode': 'private-local-build',
                'input_profile_digest': policy['input_profile_digest']}
    if provenance != expected:
        raise PermissionError('root private build provenance 불일치')
    result = core.audit_archive(raw, receipt, policy['source_revision'], str(policy['ci_run']))
    if (not result['candidate_profile_claimed'] or result['build_input_profile_sha256'] != policy['input_profile_digest'] or
            backup_manifest(backup) != policy['baseline_sha']):
        raise PermissionError('private 입력/복구 사본 불일치')
    baseline = backup_files(backup)
    candidate_files, _ = core.archive_files(raw, receipt, policy['source_revision'], str(policy['ci_run']))
    candidate = {name: core.digest(data) for name, data in candidate_files.items()}
    previous = dict(baseline)
    for source, destination in ((baseline, candidate), (candidate, previous)):
        for name, value in source.items():
            if name not in core.MUTABLE:
                if name in destination and destination[name] != value:
                    raise PermissionError('동일 immutable URL 바이트 충돌')
                destination[name] = value
    return raw, receipt, {'revision': policy['source_revision'], 'run_id': str(policy['ci_run']),
                          'archive_sha256': policy['archive_sha256'], 'baseline_sha': policy['baseline_sha'],
                          'candidate_sha': manifest_sha(candidate), 'rollback_sha': manifest_sha(previous)}


def state_bound(context, expected):
    if (context.root / 'state.json').exists():
        state = core.read_state(context)
        if any(state.get(key) != value for key, value in expected.items()):
            raise PermissionError('root slot과 원장 불일치')


def execute(layout, request, *, get=github_get, fault=None):
    """테스트도 동일 경로를 사용한다. 임의 경로/환경 override를 받지 않는다."""
    if (set(request) != {'operation', 'policy_id', 'request_id'} or request['operation'] not in OPERATIONS or
            not ID.fullmatch(str(request['request_id']))):
        raise PermissionError('고정 request schema 오류')
    policy, policy_sha = policy_read(layout)
    if request['policy_id'] != policy['policy_id']:
        raise PermissionError('request 정책 slot 불일치')
    operation = request['operation']
    if operation in {'publish', 'rollback'} and not policy['enabled']:
        raise PermissionError('운영 승격 정책 비활성')
    markers_clear(layout)
    context = OperatingContext(layout)
    if operation == 'readiness':
        return {'ok': True, 'operation': operation, 'enabled': policy['enabled'], 'production_changed': False}
    if operation == 'recover':
        _, _, expected_state = audit_inputs(layout, policy)
        state_bound(context, expected_state)
        def recover_check():
            current, fingerprint = policy_read(layout)
            if fingerprint != policy_sha or current['policy_id'] != request['policy_id']:
                raise PermissionError('복구 정책 변경')
            state_bound(context, expected_state)
        state = core.recover(context, OperatingBoundary(layout, recover_check))
        return {'ok': True, 'operation': operation, 'phase': state['phase'], 'production_changed': False}
    raw, receipt, expected_state = audit_inputs(layout, policy)
    state_bound(context, expected_state)
    checked = github_verify(policy, get)
    initial_live = context.hash(layout.live)
    if operation in {'audit', 'publish'}:
        statefile = context.root / 'state.json'
        if not statefile.exists() and initial_live != policy['baseline_sha']:
            raise PermissionError('기준 live 변경')
        if statefile.exists():
            state = core.read_state(context)
            key = {'prepared': 'baseline_sha', 'active': 'candidate_sha',
                   'rolled_back': 'rollback_sha'}.get(state.get('phase'))
            if key is None or initial_live != expected_state[key]:
                raise PermissionError('원장 단계와 실제 live 불일치')
    def recheck():
        current, fingerprint = policy_read(layout)
        if fingerprint != policy_sha or current != policy or time.monotonic() - checked > 10:
            raise PermissionError('정책/온라인 검증 freshness 오류')
        # 재조회는 락 바깥. 락 안에서는 최대 10초 된 공식 head 증거와 로컬 기준을 재검사한다.
        if context.hash(layout.live) != initial_live:
            raise PermissionError('lock 대기 중 live 변경')
        audit_inputs(layout, policy)
        state_bound(context, expected_state)
    boundary = OperatingBoundary(layout, recheck)
    if operation == 'audit':
        with boundary.enter():
            pass
        return {'ok': True, 'operation': operation, 'enabled': policy['enabled'],
                'inputs_verified': True, 'github_verified': True, 'production_changed': False}
    # 한 번 획득한 락 안에서 준비/교환까지 실행해 다른 배포와 교차하지 않는다.
    class HeldBoundary:
        @contextmanager
        def enter(self):
            yield
    with boundary.enter():
        if operation == 'publish':
            core.prepare(context, raw, receipt, policy['source_revision'], str(policy['ci_run']),
                         policy['baseline_sha'], HeldBoundary())
            state = core.activate(context, str(policy['ci_run']), HeldBoundary(), fault)
        else:
            state = core.rollback(context, str(policy['ci_run']), HeldBoundary(), fault)
    return {'ok': True, 'operation': operation, 'phase': state['phase'],
            'production_changed': not bool(layout.fixture_root)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['execute'])
    parser.add_argument('--request', required=True)
    parser.add_argument('--fixture')
    args = parser.parse_args(argv)
    if not ID.fullmatch(args.request) or (args.fixture is not None and not ID.fullmatch(args.fixture)):
        parser.error('32자리 고정 ID 필요')
    layout = (OperatingLayout.fixture(Path('/var/lib/iot-web-publisher/rehearsal') / args.fixture)
              if args.fixture else OperatingLayout())
    with deadline(30):
        request = core.decode(trusted_read(layout.requests / (args.request + '.json'), layout, 1024))
        if request.get('request_id') != args.request:
            raise PermissionError('request ID 불일치')
        try:
            result = execute(layout, request)
        except Exception as error:
            # 입력/경로/비밀 원문 및 예외 문자열을 결과에 복제하지 않는다.
            # 교환 직후 중단될 수 있으므로 실패만으로 무변경을 단정하지 않는다.
            result = {'ok': False, 'error': type(error).__name__, 'production_changed': None}
        core.plain(layout.results, True)
        core.write_new(layout.results, args.request + '.json',
                       (json.dumps(result, sort_keys=True) + '\n').encode())
        print(json.dumps(result, sort_keys=True))
        return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
