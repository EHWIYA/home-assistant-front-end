#!/usr/bin/env python3
"""프런트 승격 리허설. publish는 항상 거부하며 운영 파일을 쓰지 않는다."""
import argparse
from contextlib import contextmanager
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import secrets
import shutil
import stat
import sys
import tarfile
import zipfile

REPORTS = Path('/home/iwh/reports')
PROTECTED = Path('/home/iwh/apps')
MARKER = '.front-rehearsal-root'
MARKER_VALUE = {'scope': 'front-publish-rehearsal-v1', 'production': False}
TARGET = '/home/iwh/apps/iot/web/dist'
HDD_MOUNT = Path('/mnt/HDD500GB')
HDD_BASE = HDD_MOUNT / 'backups/managed'
ARCHIVE_LIMIT = 16 * 1024 * 1024
RECEIPT_LIMIT = 256 * 1024
FILE_LIMIT = 8 * 1024 * 1024
TREE_LIMIT = 64 * 1024 * 1024
FILE_COUNT_LIMIT = 1024
COPY_RESERVE = 64 * 1024 * 1024
MUTABLE = {'index.html', 'version.json', 'manifest.webmanifest', 'manifest.json',
           'sw-v3.js', 'sw.js', 'service-worker.js', 'firebase-messaging-sw.js', '.deploy-timestamp'}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError('중복 JSON key')
        result[key] = value
    return result


def decode(value):
    return json.loads(value, object_pairs_hook=pairs)


def plain(path, directory=False):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
        raise ValueError('symlink/특수 파일 거부')
    if info.st_uid != os.getuid():
        raise ValueError('소유자 불일치')
    return info


class Context:
    def __init__(self, root):
        self.root = Path(root).absolute()
        self.check()

    def check(self):
        if self.root == REPORTS or REPORTS not in self.root.parents or PROTECTED in self.root.parents:
            raise PermissionError('reports 하위 격리 root만 허용')
        for path in [*reversed(self.root.parents), self.root]:
            if path.is_symlink():
                raise ValueError('부모 symlink 거부')
        plain(self.root, True)
        marker = self.root / MARKER
        plain(marker)
        if marker.stat().st_size > 1024 or decode(read_tree_file(self.root, MARKER, 1024)) != MARKER_VALUE:
            raise PermissionError('리허설 마커 불일치')
        if self.root.resolve() != self.root or os.path.ismount(self.root):
            raise PermissionError('격리 root 해석/mount 오류')
        for name in ['live', 'candidate', 'previous']:
            path = self.root / name
            if path.exists() or path.is_symlink():
                info = plain(path, True)
                if info.st_dev != self.root.stat().st_dev or os.path.ismount(path):
                    raise ValueError('동일 장치의 일반 디렉터리 필요')
        return self

    def tree(self, name):
        if name not in {'live', 'candidate', 'previous'}:
            raise ValueError('고정 tree 이름만 허용')
        self.check()
        return self.root / name


class Boundary:
    def __init__(self, blocked, locked):
        self.blocked, self.locked = blocked, locked

    @classmethod
    def actual(cls):
        sys.path.insert(0, '/home/iwh/scripts/nas/bin')
        import iot_maintenance
        return cls(iot_maintenance.blocked, iot_maintenance.locked)

    @contextmanager
    def enter(self):
        if self.blocked():
            raise PermissionError('정비 중')
        with self.locked():
            if self.blocked():
                raise PermissionError('정비 중')
            yield


def read_descriptor(fd, limit, device):
    before = os.fstat(fd)
    if (not stat.S_ISREG(before.st_mode) or before.st_uid != os.getuid() or
            before.st_dev != device or not 0 <= before.st_size <= limit):
        raise ValueError('일반 파일/소유자/장치/크기 오류')
    data = bytearray()
    while len(data) <= limit:
        part = os.read(fd, min(65536, limit + 1 - len(data)))
        if not part:
            break
        data.extend(part)
    after = os.fstat(fd)
    if (len(data) > limit or len(data) != before.st_size or after.st_size != before.st_size or
            after.st_mtime_ns != before.st_mtime_ns):
        raise ValueError('읽기 중 크기/내용 변경 또는 상한 초과')
    return bytes(data)


def read_tree_file(root, name, limit=FILE_LIMIT):
    parts = Path(name).parts
    if not parts or name.startswith('/') or '..' in parts or len(parts) > 32:
        raise ValueError('tree 상대 경로 오류')
    info = plain(root, True)
    directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        opened = os.fstat(directory)
        if opened.st_uid != os.getuid() or (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
            raise ValueError('tree root가 열기 중 변경됨')
        for part in parts[:-1]:
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = nxt
            parent = os.fstat(directory)
            if parent.st_uid != os.getuid() or parent.st_dev != info.st_dev:
                raise ValueError('tree 부모 소유자/장치 오류')
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        try:
            return read_descriptor(fd, limit, info.st_dev)
        finally:
            os.close(fd)
    finally:
        os.close(directory)


def manifest(root):
    device = plain(root, True).st_dev
    result, total, visited = {}, 0, 0
    def walk(directory, prefix, depth):
        nonlocal total, visited
        if depth > 32:
            raise ValueError('tree 깊이 초과')
        current = os.fstat(directory)
        if current.st_uid != os.getuid() or current.st_dev != device:
            raise ValueError('tree 디렉터리 소유자/장치 오류')
        with os.scandir(directory) as entries:
            for entry in entries:
                visited += 1
                if visited > 2 * FILE_COUNT_LIMIT:
                    raise ValueError('tree 항목 수 초과')
                info = entry.stat(follow_symlinks=False)
                name = prefix + entry.name
                if info.st_uid != os.getuid() or info.st_dev != device or len(name) > 512:
                    raise ValueError('tree 항목 소유자/장치/경로 오류')
                if stat.S_ISDIR(info.st_mode):
                    child = os.open(entry.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
                    try:
                        walk(child, name + '/', depth + 1)
                    finally:
                        os.close(child)
                elif stat.S_ISREG(info.st_mode):
                    if len(result) >= FILE_COUNT_LIMIT:
                        raise ValueError('tree 파일 수 초과')
                    fd = os.open(entry.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
                    try:
                        data = read_descriptor(fd, FILE_LIMIT, device)
                    finally:
                        os.close(fd)
                    total += len(data)
                    if total > TREE_LIMIT:
                        raise ValueError('tree 전체 크기 초과')
                    result[name] = digest(data)
                else:
                    raise ValueError('tree symlink/특수 파일 거부')
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        walk(fd, '', 0)
    finally:
        os.close(fd)
    return result


def tree_sha(root):
    return digest(json.dumps(manifest(root), sort_keys=True, separators=(',', ':')).encode())


def allowed_name(name):
    return bool(name in MUTABLE or re.fullmatch(r'workbox-[A-Za-z0-9_-]+\.js', name) or
                re.fullmatch(r'(assets|icons)/[A-Za-z0-9_./-]+\.(js|css|png|svg|jpg|jpeg|ico|woff|woff2|ttf)', name))


def archive_files(raw, receipt, revision, run_id):
    if not re.fullmatch(r'[0-9a-f]{40}', revision) or not re.fullmatch(r'[1-9][0-9]{0,19}', run_id):
        raise ValueError('revision/run 형식 오류')
    if not 0 < len(raw) <= 16 * 1024 * 1024 or len(raw) % 512 or not 0 < len(receipt) <= 256 * 1024:
        raise ValueError('archive/receipt 크기 오류')
    meta = decode(receipt)
    expected = {'phase': 'prepared_only', 'target_root': TARGET, 'revision': revision,
                'run_id': run_id, 'archive_sha256': digest(raw)}
    if (any(meta.get(k) != v for k, v in expected.items()) or
            meta.get('production_changed') is not False or meta.get('deployment_enabled') is not False):
        raise ValueError('준비 영수증 불일치')
    offset = 0
    while offset < len(raw):
        header = raw[offset:offset + 512]
        if header == bytes(512):
            if any(raw[offset:]):
                raise ValueError('tar 종료 뒤 데이터')
            break
        field = header[124:136].rstrip(b'\0 ').strip()
        if header[156:157] not in {b'0', b'\0'} or not re.fullmatch(rb'[0-7]{1,12}', field):
            raise ValueError('tar 확장/링크/크기 필드 거부')
        length = int(field, 8)
        if length > 8 * 1024 * 1024:
            raise ValueError('개별 파일 크기 초과')
        offset += 512 + (length + 511) // 512 * 512
        if offset > len(raw):
            raise ValueError('tar 조기 종료')
    files, total = {}, 0
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        for member in archive:
            name = member.name
            if (not member.isfile() or member.pax_headers or name.startswith('/') or
                    name != posixpath.normpath(name) or '..' in name.split('/') or name in files or
                    not allowed_name(name) or re.search(r'(secret|credential|private|password|token)', name, re.I) or
                    member.size > 8 * 1024 * 1024 or member.size < 0 or member.mode & 0o7000):
                raise ValueError('비허용 tar member')
            total += member.size
            if len(files) >= 1024 or total > 32 * 1024 * 1024:
                raise ValueError('tar 파일 수/확장 크기 초과')
            files[name] = archive.extractfile(member).read()
        if archive.pax_headers:
            raise ValueError('global PAX 거부')
    hashes = {name: digest(value) for name, value in files.items()}
    required = {'index.html', 'version.json', 'manifest.webmanifest', 'sw-v3.js', 'firebase-messaging-sw.js'}
    if hashes != meta.get('files') or not required <= files.keys():
        raise ValueError('파일 manifest 불일치')
    version = decode(files['version.json'])
    if version.get('phase') != 'prepared_only' or version.get('deployed_at') is not None:
        raise ValueError('준비 version 불일치')
    return files, meta


def audit_archive(raw, receipt, revision, run_id, github_zip=None, artifact_metadata=None):
    files, meta = archive_files(raw, receipt, revision, run_id)
    github_match = False
    if (github_zip is None) != (artifact_metadata is None):
        raise ValueError('GitHub ZIP와 공식 metadata 둘 다 필요')
    if github_zip is not None:
        artifact = artifact_metadata
        run = artifact.get('workflow_run', {})
        if (artifact.get('digest') != 'sha256:' + digest(github_zip) or artifact.get('expired') is not False or
                run.get('id') != int(run_id) or run.get('repository_id') != 1243065308 or
                run.get('head_repository_id') != 1243065308 or run.get('head_branch') != 'main' or
                run.get('head_sha') != revision):
            raise ValueError('공식 GitHub artifact metadata 불일치')
        with zipfile.ZipFile(io.BytesIO(github_zip)) as archive:
            if len(archive.infolist()) != 2 or set(archive.namelist()) != {'release.tar', 'receipt.json'}:
                raise ValueError('GitHub ZIP member 불일치')
            if any(i.file_size > 16 * 1024 * 1024 for i in archive.infolist()):
                raise ValueError('ZIP 확장 크기 초과')
            if archive.read('release.tar') != raw or archive.read('receipt.json') != receipt:
                raise ValueError('GitHub ZIP와 HDD 산출물 불일치')
        github_match = True
    profile = meta.get('build_input_profile')
    return {'phase': 'audit_only', 'revision': revision, 'run_id': run_id,
            'archive_sha256': digest(raw), 'files': len(files), 'github_artifact_digest_matched': github_match,
            'build_input_profile_present': isinstance(profile, dict),
            'build_input_profile_sha256': (digest(json.dumps(profile, sort_keys=True).encode())
                                           if isinstance(profile, dict) else None),
            'candidate_profile_claimed': meta.get('candidate_kind') == 'production_candidate_unpublished',
            'promotion_allowed': False,
            'production_changed': False, 'signed_attestation_verified': False}


def fsync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_new(root, name, data):
    parts = Path(name).parts
    if name.startswith('/') or '..' in parts:
        raise ValueError('상대 경로 오류')
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            try:
                os.mkdir(part, 0o755, dir_fd=fd)
            except FileExistsError:
                pass
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = nxt
        out = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644, dir_fd=fd)
        with os.fdopen(out, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.fsync(fd)
    finally:
        os.close(fd)


def copy_tree(source, target):
    files = manifest(source)
    target.mkdir(mode=0o755)
    for name, expected in files.items():
        data = read_tree_file(source, name)
        if digest(data) != expected:
            raise ValueError('복사 중 source 변경')
        write_new(target, name, data)
    if manifest(target) != files:
        raise ValueError('복사본 manifest 불일치')


def merge_immutable(source, target):
    for name, expected in manifest(source).items():
        if name in MUTABLE:
            continue
        data = read_tree_file(source, name)
        if digest(data) != expected:
            raise ValueError('자산 병합 중 source 변경')
        try:
            present = read_tree_file(target, name)
        except FileNotFoundError:
            write_new(target, name, data)
        else:
            if digest(present) != expected:
                raise ValueError('같은 자산 URL의 다른 바이트')


def journal(context, state):
    context.check()
    target = context.root / 'state.json'
    if target.exists():
        plain(target)
    payload = (json.dumps(state, ensure_ascii=False, sort_keys=True) + '\n').encode()
    # 중단 후 남은 실패 원장도 보존하며 다음 쓰기를 막지 않는 고유 임시 파일이다.
    temp_name = '.state-next-' + secrets.token_hex(16) + '.json'
    directory = os.open(context.root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fd = os.open(temp_name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o600, dir_fd=directory)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.fsync(directory)
        os.replace(temp_name, 'state.json', src_dir_fd=directory, dst_dir_fd=directory)
        os.fsync(directory)
    finally:
        os.close(directory)


def read_state(context):
    context.check()
    path = context.root / 'state.json'
    plain(path)
    return decode(read_tree_file(context.root, 'state.json', RECEIPT_LIMIT))


def rename_exchange(context, first, second):
    first, second = context.tree(first), context.tree(second)
    plain(first, True)
    plain(second, True)
    if first.stat().st_dev != second.stat().st_dev:
        raise ValueError('같은 파일 시스템 필요')
    libc = ctypes.CDLL(None, use_errno=True)
    exchange = getattr(libc, 'renameat2', None)
    if exchange is None:
        raise NotImplementedError('renameat2 미지원: fallback 금지')
    exchange.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    exchange.restype = ctypes.c_int
    if exchange(-100, os.fsencode(first), -100, os.fsencode(second), 2):
        error = ctypes.get_errno()
        raise OSError(error, '원자 교환 실패')
    fsync_dir(context.root)


def prepare(context, raw, receipt, revision, run_id, expected_live_sha, boundary):
    context.check()
    files, _ = archive_files(raw, receipt, revision, run_id)
    with boundary.enter():
        live = context.tree('live')
        if (context.root / 'state.json').exists():
            old = read_state(context)
            if old['revision'] == revision and old['run_id'] == run_id and old['archive_sha256'] == digest(raw):
                key = {'prepared': 'baseline_sha', 'active': 'candidate_sha', 'rolled_back': 'rollback_sha'}.get(old['phase'])
                if key is None or tree_sha(live) != old[key]:
                    raise ValueError('중복 요청의 실제 상태 불일치')
                return old
            raise ValueError('기존 리허설 원장 보존: 새 root 필요')
        if tree_sha(live) != expected_live_sha:
            raise ValueError('운영 사본 기준 manifest 변경')
        current_files = manifest(live)
        current_size = sum(len(read_tree_file(live, name)) for name in current_files)
        required = 2 * (current_size + sum(map(len, files.values())))
        if shutil.disk_usage(context.root).free < required + COPY_RESERVE:
            raise ValueError('리허설 복사 용량/보호 여유 부족')
        candidate, previous = context.tree('candidate'), context.tree('previous')
        candidate.mkdir(mode=0o755)
        for name, data in files.items():
            write_new(candidate, name, data)
        copy_tree(live, previous)
        merge_immutable(live, candidate)
        merge_immutable(candidate, previous)
        if tree_sha(live) != expected_live_sha:
            raise ValueError('준비 중 기준 manifest 변경')
        state = {'phase': 'prepared', 'revision': revision, 'run_id': run_id,
                 'archive_sha256': digest(raw), 'baseline_sha': expected_live_sha,
                 'candidate_sha': tree_sha(candidate), 'rollback_sha': tree_sha(previous),
                 'promotion_allowed': False, 'production_changed': False, 'scope': 'rehearsal'}
        fsync_dir(candidate)
        fsync_dir(previous)
        journal(context, state)
        return state


def activate(context, run_id, boundary, fault=None):
    with boundary.enter():
        state = read_state(context)
        if state['run_id'] != run_id:
            raise ValueError('오래되거나 다른 run 거부')
        live, candidate = context.tree('live'), context.tree('candidate')
        previous = context.tree('previous')
        if not previous.exists() or tree_sha(previous) != state['rollback_sha']:
            raise ValueError('검증된 복구 사본이 없거나 변경됨')
        if state['phase'] == 'active' and tree_sha(live) == state['candidate_sha']:
            return dict(state, idempotent=True)
        if state['phase'] != 'prepared' or tree_sha(live) != state['baseline_sha'] or tree_sha(candidate) != state['candidate_sha']:
            raise ValueError('교체 전 상태/manifest 불일치')
        state['phase'] = 'exchange_pending'
        journal(context, state)
        if fault:
            fault('before_exchange')
        rename_exchange(context, 'live', 'candidate')
        if fault:
            fault('after_exchange')
        state['phase'] = 'active'
        journal(context, state)
        return state


def rollback(context, run_id, boundary, fault=None):
    with boundary.enter():
        state = read_state(context)
        live, previous = context.tree('live'), context.tree('previous')
        if state['run_id'] != run_id:
            raise ValueError('다른 run 거부')
        if state['phase'] == 'rolled_back' and tree_sha(live) == state['rollback_sha']:
            return dict(state, idempotent=True)
        if state['phase'] != 'active' or tree_sha(live) != state['candidate_sha'] or tree_sha(previous) != state['rollback_sha']:
            raise ValueError('복구 전 상태/manifest 불일치')
        state['phase'] = 'rollback_pending'
        journal(context, state)
        if fault:
            fault('before_exchange')
        rename_exchange(context, 'live', 'previous')
        if fault:
            fault('after_exchange')
        state['phase'] = 'rolled_back'
        journal(context, state)
        return state


def recover(context, boundary):
    with boundary.enter():
        state = read_state(context)
        live = tree_sha(context.tree('live'))
        if state['phase'] == 'exchange_pending':
            other = tree_sha(context.tree('candidate'))
            if (live, other) == (state['baseline_sha'], state['candidate_sha']):
                state['phase'] = 'prepared'
            elif (live, other) == (state['candidate_sha'], state['baseline_sha']):
                state['phase'] = 'active'
            else:
                raise ValueError('중단 상태 불명확: 자동 추측 복구 금지')
        elif state['phase'] == 'rollback_pending':
            other = tree_sha(context.tree('previous'))
            if (live, other) == (state['candidate_sha'], state['rollback_sha']):
                state['phase'] = 'active'
            elif (live, other) == (state['rollback_sha'], state['candidate_sha']):
                state['phase'] = 'rolled_back'
            else:
                raise ValueError('복구 중단 상태 불명확')
        else:
            raise ValueError('복구할 pending 상태 아님')
        journal(context, state)
        return state


def publish(*_args, **_kwargs):
    raise PermissionError('운영 publish는 미승인·비활성 상태입니다')


def hdd_storage():
    # NAS CLI에서만 mount/UUID/여유와 읽기 전체 FD 수명을 검증한다.
    sys.path.insert(0, '/home/iwh/backup/bin')
    from hdd_backup import Storage
    return Storage()


def read_hdd_candidate(value, limit=ARCHIVE_LIMIT):
    path = Path(value).absolute()
    if HDD_BASE not in path.parents or path.resolve() != path:
        raise PermissionError('HDD 보관 후보 파일만 허용')
    for parent in path.parents:
        if parent.is_symlink():
            raise ValueError('후보 부모 symlink 거부')
    if not isinstance(limit, int) or not 0 < limit <= ARCHIVE_LIMIT:
        raise ValueError('읽기 상한 오류')
    components = path.relative_to(HDD_MOUNT).parts
    with hdd_storage() as storage:
        device = os.fstat(storage.fd).st_dev
        directory = os.dup(storage.fd)
        try:
            for component in components[:-1]:
                nxt = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                              dir_fd=directory)
                os.close(directory)
                directory = nxt
                info = os.fstat(directory)
                if info.st_dev != device or info.st_uid != os.getuid():
                    raise ValueError('HDD 부모 장치/소유자 불일치')
            fd = os.open(components[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                         dir_fd=directory)
            try:
                return read_descriptor(fd, limit, device)
            finally:
                os.close(fd)
        finally:
            os.close(directory)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['publish', 'audit', 'rehearse', 'rollback', 'recover'])
    parser.add_argument('--root')
    parser.add_argument('--archive')
    parser.add_argument('--receipt')
    parser.add_argument('--revision')
    parser.add_argument('--run-id')
    parser.add_argument('--expected-live-sha')
    args = parser.parse_args(argv)
    if args.action == 'publish':
        publish()
    if args.action == 'audit':
        return audit_archive(read_hdd_candidate(args.archive, ARCHIVE_LIMIT),
                             read_hdd_candidate(args.receipt, RECEIPT_LIMIT), args.revision, args.run_id)
    context = Context(args.root)
    boundary = Boundary.actual()
    if args.action == 'rehearse':
        prepare(context, read_hdd_candidate(args.archive, ARCHIVE_LIMIT),
                read_hdd_candidate(args.receipt, RECEIPT_LIMIT),
                args.revision, args.run_id, args.expected_live_sha, boundary)
        return activate(context, args.run_id, boundary)
    if args.action == 'rollback':
        return rollback(context, args.run_id, boundary)
    return recover(context, boundary)


if __name__ == '__main__':
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'status': 'rejected', 'reason_type': type(error).__name__, 'production_changed': False}), file=sys.stderr)
        raise SystemExit(1)
