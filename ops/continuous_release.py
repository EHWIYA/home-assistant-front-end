#!/usr/bin/env python3
"""root 봉인 릴리스만 실행하는 연속 승격 엔진. root 포인터는 쓰지 않는다."""
import argparse
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
import http.client
import io
import json
import os
from pathlib import Path
import pwd
import socket
import ssl
import stat
import sys
import tarfile
import time

_package = Path(__file__).resolve().parent
if str(_package) == '/usr/local/libexec/iot-web-publisher':
    _owner = _package.stat()
    if _owner.st_uid != 0 or _owner.st_mode & 0o022:
        raise PermissionError('root package 보호 오류')
sys.path.insert(0, str(_package))
import operating_adapter as adapter
core = adapter.core
ID, SHA, REV = adapter.ID, adapter.SHA, adapter.REV
CONFIG_KEYS = {'schema', 'auto_enabled', 'allow_enqueue', 'production', 'repo', 'target'}
PLAN_KEYS = {'schema', 'release_id', 'parent_release', 'policy', 'expected_state'}
POINTER_KEYS = {'schema', 'release_id', 'source_revision', 'live_sha', 'proof_release'}
INTENT_KEYS = {'schema', 'release_id', 'parent_release', 'baseline_sha', 'plan_sha256', 'phase'}
EXPECTED_KEYS = {'revision', 'run_id', 'archive_sha256', 'baseline_sha', 'candidate_sha', 'rollback_sha'}
INTENT_PHASES = {'prepared', 'executing', 'verifying', 'recovering'}


@dataclass(frozen=True)
class Layout:
    config: Path
    base: Path
    store: Path
    web: Path
    lock: Path
    markers: tuple
    trust_uid: int = 0
    live_uid: int = -1
    fixture_root: Path | None = None

    @classmethod
    def production(cls):
        return cls(Path('/etc/iot-web-publisher/continuous.json'),
                   Path('/var/lib/iot-web-publisher/v2'),
                   Path('/mnt/HDD500GB/backups/managed/staging/front-release-store'),
                   Path('/home/iwh/apps/iot/web'), Path('/home/iwh/.cache/iot-stack-watchdog.lock'),
                   (Path('/var/lib/nas-maintenance/iot.json'),
                    Path('/home/iwh/.local/state/iot-operations/deploy-active.json')))

    @classmethod
    def fixture(cls, root, *, trust_uid=0, live_uid=None):
        root = Path(root).absolute()
        if (root == Path('/home/iwh/apps') or Path('/home/iwh/apps') in root.parents or
                root == Path('/') or root != Path(os.path.normpath(root))):
            raise PermissionError('격리 root 오류')
        return cls(root / 'config.json', root / 'base', root / 'store', root / 'web',
                   root / 'lock', (root / 'maintenance.json', root / 'deploy-active.json'),
                   trust_uid, pwd.getpwnam('iwh').pw_uid if live_uid is None else live_uid, root)

    @property
    def current(self):
        return self.base / 'current.json'

    @property
    def live(self):
        return self.web / 'dist'

    @property
    def is_production(self):
        return self.fixture_root is None

    def validate_id(self, release_id):
        if not isinstance(release_id, str) or not ID.fullmatch(release_id):
            raise PermissionError('릴리스 ID 오류')
        return release_id

    def plan_path(self, release_id):
        return self.store / 'releases' / self.validate_id(release_id) / 'plan.json'

    def intent_path(self, release_id):
        return self.base / 'intents' / (self.validate_id(release_id) + '.json')

    def runtime(self, release_id):
        return self.base / 'releases' / self.validate_id(release_id)

    def slot(self, release_id):
        release_id = self.validate_id(release_id)
        # 같은 부모의 교환은 기존 live 디렉터리의 쓰기 권한을 요구하지 않는다.
        # 서로 다른 부모를 쓰면 renameat2가 '..' 변경 권한을 요구한다.
        tree = self.web / ('.publisher-v2-' + release_id)
        return adapter.OperatingLayout(
            policy=self.plan_path(release_id), live=self.web / 'dist',
            candidate=tree.with_name(tree.name + '-candidate'),
            previous=tree.with_name(tree.name + '-previous'),
            state=self.runtime(release_id) / 'state',
            inbox=self.store / 'releases' / release_id / 'inbox',
            requests=self.runtime(release_id), results=self.runtime(release_id),
            lock=self.lock, markers=self.markers, trust_uid=self.trust_uid,
            live_uid=self.live_uid, fixture_root=self.fixture_root)


def trusted_json(path, layout, limit=core.RECEIPT_LIMIT):
    raw = adapter.trusted_read(path, layout, limit)
    return core.decode(raw), core.digest(raw)


def read_config(layout, *, require_enabled=True):
    value, fingerprint = trusted_json(layout.config, layout)
    keys = CONFIG_KEYS | ({'scope'} if layout.fixture_root else set())
    if (set(value) != keys or type(value['schema']) is not int or value['schema'] != 1 or
            any(type(value[k]) is not bool for k in ['auto_enabled', 'allow_enqueue', 'production']) or
            value['repo'] != adapter.REPO or value['target'] != str(layout.web / 'dist') or
            value['production'] != layout.is_production):
        raise PermissionError('연속 정책 schema/대상 오류')
    if layout.fixture_root and value['scope'] != 'rehearsal':
        raise PermissionError('격리 정책 범위 오류')
    if require_enabled and not value['auto_enabled']:
        raise PermissionError('운영 자동 승격 비활성')
    return value, fingerprint


def _identifier(value, nullable=False):
    return (nullable and value is None) or (isinstance(value, str) and ID.fullmatch(value))


def _validate_policy(policy, layout):
    if (set(policy) != adapter.POLICY_KEYS or type(policy['schema']) is not int or
            policy['schema'] != 1 or policy['enabled'] is not True or
            policy['target'] != str(layout.web / 'dist') or not _identifier(policy['policy_id']) or
            not isinstance(policy['source_revision'], str) or not REV.fullmatch(policy['source_revision']) or
            policy['source_revision'] != policy['current_main'] or
            type(policy['ci_run']) is not int or not 0 < policy['ci_run'] < 10**20 or
            type(policy['ci_attempt']) is not int or not 0 < policy['ci_attempt'] < 10000):
        raise PermissionError('릴리스 단기 정책 오류')
    for key in ['archive_sha256', 'receipt_sha256', 'backup_sha256', 'baseline_sha', 'input_profile_digest']:
        if not isinstance(policy[key], str) or not SHA.fullmatch(policy[key]):
            raise PermissionError('정책 해시 오류')
    try:
        expiry = datetime.fromisoformat(policy['approved_until'].replace('Z', '+00:00'))
        if expiry.utcoffset() is None:
            raise ValueError('timezone missing')
    except (ValueError, TypeError, AttributeError):
        raise PermissionError('승인 만료 형식 오류') from None
    return expiry.timestamp()


def read_plan(layout, release_id):
    release_id = layout.validate_id(release_id)
    plan, fingerprint = trusted_json(layout.plan_path(release_id), layout)
    if (set(plan) != PLAN_KEYS or type(plan['schema']) is not int or plan['schema'] != 1 or
            plan['release_id'] != release_id or not _identifier(plan['parent_release'], True) or
            plan['parent_release'] == release_id or not isinstance(plan['policy'], dict) or
            not isinstance(plan['expected_state'], dict) or set(plan['expected_state']) != EXPECTED_KEYS):
        raise PermissionError('릴리스 봉인 계획 오류')
    _validate_policy(plan['policy'], layout)
    expected = plan['expected_state']
    for key in ['archive_sha256', 'baseline_sha', 'candidate_sha', 'rollback_sha']:
        if not isinstance(expected[key], str) or not SHA.fullmatch(expected[key]):
            raise PermissionError('봉인 원장 해시 오류')
    if (expected['revision'] != plan['policy']['source_revision'] or
            expected['run_id'] != str(plan['policy']['ci_run']) or
            expected['archive_sha256'] != plan['policy']['archive_sha256'] or
            expected['baseline_sha'] != plan['policy']['baseline_sha']):
        raise PermissionError('봉인 정책/원장 불일치')
    return plan, fingerprint


def read_pointer(layout):
    value, fingerprint = trusted_json(layout.current, layout)
    if (set(value) != POINTER_KEYS or type(value['schema']) is not int or value['schema'] != 1 or
            not _identifier(value['release_id'], True) or not _identifier(value['proof_release'], True) or
            not isinstance(value['source_revision'], str) or not REV.fullmatch(value['source_revision']) or
            not isinstance(value['live_sha'], str) or not SHA.fullmatch(value['live_sha'])):
        raise PermissionError('현재 릴리스 포인터 오류')
    return value, fingerprint


def _parent_pointer(layout, release_id, plan):
    parent, fingerprint = trusted_json(layout.plan_path(release_id).parent / 'parent-current.json', layout)
    if (set(parent) != POINTER_KEYS or type(parent['schema']) is not int or parent['schema'] != 1 or
            parent['release_id'] != plan['parent_release'] or
            parent['live_sha'] != plan['policy']['baseline_sha'] or
            not _identifier(parent['release_id'], True) or not _identifier(parent['proof_release'], True) or
            not isinstance(parent['source_revision'], str) or not REV.fullmatch(parent['source_revision'])):
        raise PermissionError('봉인 부모 포인터 오류')
    return parent, fingerprint


def _pointer_bound(pointer, plan, release_id, parent):
    expected = plan['expected_state']
    if pointer == parent:
        return 'parent'
    if (pointer['release_id'] == release_id and pointer['proof_release'] == release_id and
            pointer['source_revision'] == plan['policy']['source_revision'] and
            pointer['live_sha'] == expected['candidate_sha']):
        return 'active'
    if (pointer['release_id'] == plan['parent_release'] and pointer['proof_release'] == release_id and
            pointer['source_revision'] == parent['source_revision'] and
            pointer['live_sha'] == expected['rollback_sha']):
        return 'restored'
    raise PermissionError('현재 릴리스와 다른 slot')


def _read_intent(layout, release_id, plan, plan_sha):
    intent, fingerprint = trusted_json(layout.intent_path(release_id), layout)
    if (set(intent) != INTENT_KEYS or type(intent['schema']) is not int or intent['schema'] != 1 or
            intent['release_id'] != release_id or intent['parent_release'] != plan['parent_release'] or
            intent['baseline_sha'] != plan['policy']['baseline_sha'] or intent['plan_sha256'] != plan_sha or
            intent['phase'] not in INTENT_PHASES):
        raise PermissionError('root intent 불일치')
    return intent, fingerprint


def _audit(layout, release_id, plan):
    slot = layout.slot(release_id)
    raw, receipt, expected = adapter.audit_inputs(slot, plan['policy'])
    if expected != plan['expected_state']:
        raise PermissionError('root 봉인 예상 manifest 불일치')
    # 개별 tar가 허용 한도여도 기존 immutable 병합 결과는 한도를 넘을 수 있다.
    # live/candidate를 쓰기 전에 두 결과 tree의 실제 확장 크기와 파일 수를 제한한다.
    backup = adapter.trusted_read(slot.inbox / 'backup.tar', slot,
                                  core.TREE_LIMIT + 4 * 1024 * 1024)
    baseline_sizes = {}
    with tarfile.open(fileobj=io.BytesIO(backup), mode='r:') as archive:
        for member in archive:
            if not member.isfile():
                continue
            name = member.name.removeprefix('./').removeprefix('dist/')
            baseline_sizes[name] = member.size
    incoming, _ = core.archive_files(raw, receipt, plan['policy']['source_revision'],
                                    str(plan['policy']['ci_run']))
    candidate_sizes = {name: len(data) for name, data in incoming.items()}
    previous_sizes = dict(baseline_sizes)
    for source, destination in ((baseline_sizes, candidate_sizes), (candidate_sizes, previous_sizes)):
        for name, size in source.items():
            if name not in core.MUTABLE:
                destination[name] = size
    if any(len(files) > core.FILE_COUNT_LIMIT or sum(files.values()) > core.TREE_LIMIT
           for files in (candidate_sizes, previous_sizes)):
        raise PermissionError('병합 static tree 용량/파일 수 한도')
    context = adapter.OperatingContext(slot)
    adapter.state_bound(context, expected)
    if (context.root / 'state.json').exists():
        state = core.read_state(context)
        if state.get('scope') != context.scope:
            raise PermissionError('원장 범위 위조')
    return slot, context, raw, receipt


class HeldBoundary:
    @contextmanager
    def enter(self):
        yield


class LoopbackHTTPS(http.client.HTTPSConnection):
    def connect(self):
        self.sock = self._context.wrap_socket(
            socket.create_connection(('127.0.0.1', 443), timeout=2), server_hostname=self.host)


def verify_live(context, plan):
    """민감 원문을 출력하지 않고 고정 loopback nginx의 모든 정적 파일을 확인한다."""
    statefile = context.root / 'state.json'
    phase = core.read_state(context)['phase'] if statefile.exists() else 'unprepared'
    key = {'unprepared': 'baseline_sha', 'prepared': 'baseline_sha',
           'active': 'candidate_sha', 'rolled_back': 'rollback_sha'}.get(phase)
    if key is None or context.hash(context.tree('live')) != plan['expected_state'][key]:
        raise ValueError('검증 대상 단계/manifest 오류')
    if context.layout.fixture_root:
        control = context.layout.fixture_root / 'verification.json'
        if control.exists() or control.is_symlink():
            fixture, _ = trusted_json(control, context.layout)
            if (set(fixture) != {'schema', 'mode'} or fixture['schema'] != 1 or
                    fixture['mode'] not in {'pass', 'fail', 'fail_candidate'}):
                raise PermissionError('격리 검증 제어 오류')
            if fixture['mode'] == 'fail' or (fixture['mode'] == 'fail_candidate' and phase == 'active'):
                return False
        live = context.tree('live')
        for path in [live, *live.rglob('*')]:
            if stat.S_IMODE(path.lstat().st_mode) != (0o755 if path.is_dir() else 0o644):
                raise ValueError('격리 static 공개 권한 오류')
        return True
    files = context.manifest(context.tree('live'))
    for name, expected in files.items():
        connection = LoopbackHTTPS('iot.iwhya.kr', timeout=2, context=ssl.create_default_context())
        try:
            connection.request('GET', '/' + name)
            response = connection.getresponse()
            data = response.read(core.FILE_LIMIT + 1)
            if response.status != 200 or core.digest(data) != expected:
                raise ValueError('반영 후 HTTP manifest 오류')
            if name in {'index.html', 'version.json', 'sw-v3.js', 'firebase-messaging-sw.js'}:
                if 'no-cache' not in response.getheader('Cache-Control', ''):
                    raise ValueError('반영 후 cache 정책 오류')
        finally:
            connection.close()
    return True


def _result(layout, release_id, plan, context, *, ok, error=None, idempotent=False,
            health_verified=False, recovery_error=None):
    path = context.root / 'state.json'
    phase = core.read_state(context)['phase'] if path.exists() else 'unprepared'
    live = context.hash(context.tree('live'))
    result = {'ok': bool(ok), 'release_id': release_id, 'phase': phase, 'live_sha': live,
              'baseline_sha': plan['expected_state']['baseline_sha'],
              'candidate_sha': plan['expected_state']['candidate_sha'],
              'rollback_sha': plan['expected_state']['rollback_sha'],
              'files_restored': phase == 'rolled_back' and live == plan['expected_state']['rollback_sha'],
              'health_verified': bool(health_verified),
              'production_changed': not bool(layout.fixture_root) and live != plan['expected_state']['baseline_sha'],
              'idempotent': bool(idempotent)}
    if error:
        result['error'] = error
    if recovery_error:
        result['recovery_error'] = recovery_error
    return result


def _health(verify, context, plan):
    try:
        if verify(context, plan) is not True:
            return False, 'VerificationFailed'
        return True, None
    except adapter.DeadlineExpired:
        raise
    except Exception as error:
        return False, type(error).__name__


def _session(layout, release_id, *, recovery=False):
    config, config_sha = read_config(layout, require_enabled=not recovery)
    adapter.markers_clear(layout.slot(release_id))
    plan, plan_sha = read_plan(layout, release_id)
    parent, parent_sha = _parent_pointer(layout, release_id, plan)
    pointer, pointer_sha = read_pointer(layout)
    _pointer_bound(pointer, plan, release_id, parent)
    intent, intent_sha = _read_intent(layout, release_id, plan, plan_sha)
    if intent['phase'] != ('recovering' if recovery else 'executing'):
        raise PermissionError('operation과 root intent 단계 불일치')
    if not config['auto_enabled'] and (not recovery or intent['phase'] != 'recovering'):
        raise PermissionError('비활성 상태의 자동 복구 금지')
    slot, context, raw, receipt = _audit(layout, release_id, plan)
    def check(*, check_lease=True):
        current_config, current_config_sha = read_config(layout, require_enabled=not recovery)
        current_intent, current_intent_sha = _read_intent(layout, release_id, plan, plan_sha)
        if not current_config['auto_enabled'] and (not recovery or current_intent['phase'] != 'recovering'):
            raise PermissionError('비활성 상태의 자동 복구 금지')
        if current_config_sha != config_sha or read_plan(layout, release_id)[1] != plan_sha:
            raise PermissionError('진행 중 root 정책/계획 변경')
        if read_pointer(layout)[1] != pointer_sha:
            raise PermissionError('진행 중 현재 포인터 변경')
        if _parent_pointer(layout, release_id, plan)[1] != parent_sha:
            raise PermissionError('진행 중 봉인 부모 변경')
        _pointer_bound(read_pointer(layout)[0], plan, release_id, parent)
        if current_intent_sha != intent_sha:
            raise PermissionError('진행 중 root intent 변경')
        _audit(layout, release_id, plan)
        if not recovery and check_lease:
            left = _validate_policy(plan['policy'], layout) - time.time()
            if not 0 < left <= 900:
                raise PermissionError('승인 만료 또는 15분 초과')
    return plan, context, raw, receipt, check, adapter.OperatingBoundary(slot, check)


def execute_release(layout, release_id, verify=None, fault=None):
    """한 번의 공통 잠금에서 준비·교환·짧은 검증·필요 복구를 수행한다."""
    verify = verify_live if verify is None else verify
    with adapter.deadline(30):
        plan, context, raw, receipt, check, boundary = _session(layout, release_id)
        with boundary.enter():
            expected = plan['expected_state']
            if (context.root / 'state.json').exists():
                state = core.read_state(context)
                if state['phase'] in {'exchange_pending', 'rollback_pending'}:
                    raise PermissionError('pending 복구가 먼저 필요함')
                if state['phase'] == 'rolled_back':
                    if context.hash(context.tree('live')) != expected['rollback_sha']:
                        raise PermissionError('복구된 live 변경')
                    healthy, health_error = _health(verify, context, plan)
                    return _result(layout, release_id, plan, context, ok=False, idempotent=True,
                                   health_verified=healthy, recovery_error=health_error)
            try:
                core.prepare(context, raw, receipt, plan['policy']['source_revision'],
                             str(plan['policy']['ci_run']), expected['baseline_sha'], HeldBoundary())
                check()
                prior = core.read_state(context)['phase']
                core.activate(context, str(plan['policy']['ci_run']), HeldBoundary(), fault)
                # 새 정비/관리자 중단 명령이 생겼다면 이후 자동 쓰기 전에 멈춘다.
                adapter.markers_clear(context.layout)
                if verify(context, plan) is not True:
                    raise ValueError('반영 후 검증 거부')
                return _result(layout, release_id, plan, context, ok=True, idempotent=prior == 'active',
                               health_verified=True)
            except adapter.DeadlineExpired:
                # 15초 중단 뒤 여유 시간을 임의 연장하지 않는다. 별도 recover가 실제 해시로 확정한다.
                raise
            except Exception as error:
                read_config(layout)
                adapter.markers_clear(context.layout)
                # 동일 executing intent를 유지하며 시간 만료만 무시한다.
                # 외부 recover operation의 root recovering capability와 혼동하지 않는다.
                check(check_lease=False)
                if (context.root / 'state.json').exists():
                    state = core.read_state(context)
                    if state['phase'] in {'exchange_pending', 'rollback_pending'}:
                        core.recover(context, HeldBoundary())
                    if core.read_state(context)['phase'] == 'active':
                        core.rollback(context, str(plan['policy']['ci_run']), HeldBoundary())
                healthy, health_error = _health(verify, context, plan)
                return _result(layout, release_id, plan, context, ok=False, error=type(error).__name__,
                               health_verified=healthy, recovery_error=health_error)


def recover_release(layout, release_id, verify=None, fault=None):
    """현재 root intent의 exact slot만 복구한다. GitHub와 lease 만료는 사용하지 않는다."""
    verify = verify_live if verify is None else verify
    with adapter.deadline(30):
        plan, context, _, _, check, boundary = _session(layout, release_id, recovery=True)
        with boundary.enter():
            expected = plan['expected_state']
            path = context.root / 'state.json'
            if path.exists() and core.read_state(context)['phase'] in {'exchange_pending', 'rollback_pending'}:
                core.recover(context, HeldBoundary())
            phase = core.read_state(context)['phase'] if path.exists() else 'unprepared'
            live = context.hash(context.tree('live'))
            if live == expected['baseline_sha'] and phase in {'unprepared', 'prepared'}:
                healthy, health_error = _health(verify, context, plan)
                return _result(layout, release_id, plan, context, ok=healthy, idempotent=True,
                               health_verified=healthy, recovery_error=health_error)
            if live == expected['rollback_sha'] and phase == 'rolled_back':
                healthy, health_error = _health(verify, context, plan)
                return _result(layout, release_id, plan, context, ok=healthy, idempotent=True,
                               health_verified=healthy, recovery_error=health_error)
            check()
            core.rollback(context, str(plan['policy']['ci_run']), HeldBoundary(), fault)
            if context.hash(context.tree('live')) != expected['rollback_sha']:
                raise ValueError('복구 후 실제 manifest 불일치')
            healthy, health_error = _health(verify, context, plan)
            return _result(layout, release_id, plan, context, ok=healthy,
                           health_verified=healthy, recovery_error=health_error)


def _store_result(layout, release_id, value):
    parent = layout.runtime(release_id)
    core.plain(parent, True)
    raw = (json.dumps(value, sort_keys=True) + '\n').encode()
    name = 'result-' + str(time.time_ns()) + '.json'
    core.write_new(parent, name, raw)
    (parent / name).chmod(0o600)
    temp = parent / ('result-next-' + str(time.time_ns()) + '.json')
    core.write_new(parent, temp.name, raw)
    temp.chmod(0o600)
    os.replace(temp, parent / 'result.json')
    core.fsync_dir(parent)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['execute', 'recover'])
    parser.add_argument('--release', required=True)
    parser.add_argument('--fixture')
    args = parser.parse_args(argv)
    if not ID.fullmatch(args.release) or (args.fixture is not None and not ID.fullmatch(args.fixture)):
        parser.error('고정 hex ID만 허용')
    layout = (Layout.fixture(Path('/var/lib/iot-web-publisher/rehearsal/v2') / args.fixture)
              if args.fixture else Layout.production())
    try:
        result = (execute_release if args.action == 'execute' else recover_release)(layout, args.release)
    except Exception as error:
        result = {'ok': False, 'release_id': args.release, 'error': type(error).__name__,
                  'production_changed': None}
    result['action'] = args.action
    try:
        result['intent_sha256'] = trusted_json(layout.intent_path(args.release), layout)[1]
    except Exception as error:
        result.update(ok=False, error=type(error).__name__, intent_sha256=None)
    if layout.runtime(args.release).is_dir():
        _store_result(layout, args.release, result)
    print(json.dumps(result, sort_keys=True))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
