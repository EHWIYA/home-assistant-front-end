#!/usr/bin/python3 -I
"""고정 root 관리 경로: CI는 검증 자료를 접수만 하며 root 정책은 선택하지 못한다."""
import argparse,base64,fcntl,hashlib,io,json,os,pwd,secrets,shutil,stat,subprocess,sys,tarfile,time,zipfile,urllib.error
from contextlib import contextmanager
from datetime import datetime,timedelta,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import continuous_release as engine
core,adapter=engine.core,engine.adapter
PROFILE_LIMIT=64*1024
MAX_QUEUE=1000
INPUT_NAMES=('VITE_API_KEY','VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_VAPID_KEY')
class Pending(Exception):
 def __init__(self,reason='waiting',retry_after=30):
  super().__init__(reason);self.reason=reason if reason in {'maintenance','ci','source_service','resources'} else 'waiting';self.retry_after=max(1,min(3600,int(retry_after)))

def verify_store(layout):
 if layout.fixture_root:return
 mount=Path('/mnt/HDD500GB');adapter.no_symlinks(mount);adapter.no_symlinks(layout.store)
 device=os.stat('/dev/disk/by-uuid/da1072f7-6685-4ad3-b0df-ab6892bc77ac')
 if not os.path.ismount(mount) or not stat.S_ISBLK(device.st_mode) or mount.stat().st_dev!=device.st_rdev or layout.store.stat().st_dev!=device.st_rdev:raise PermissionError('HDD 저장소 마운트/UUID 오류')

def maintenance_wait(layout,rid='0'*32):
 try:adapter.markers_clear(layout.slot(rid))
 except PermissionError as error:raise Pending('maintenance') from error

def owner(layout):
 if os.geteuid()!=layout.trust_uid:raise PermissionError('관리 계정 필요')

def raw_read(path,layout,limit=core.RECEIPT_LIMIT):return adapter.trusted_read(Path(path),layout.slot('0'*32),limit)
def read_json(path,layout,limit=core.RECEIPT_LIMIT):return core.decode(raw_read(path,layout,limit))
def role_ids(layout):
 if layout.fixture_root and layout.trust_uid!=0:return os.getuid(),os.getgid()
 p=pwd.getpwnam('iot-web-publisher');return p.pw_uid,p.pw_gid

def managed_dir(path,layout,*,runtime=False):
 path=Path(path);uid,gid=role_ids(layout) if runtime else (layout.trust_uid,role_ids(layout)[1])
 if not path.is_absolute() or path!=Path(os.path.normpath(path)):raise ValueError('관리 폴더 경로')
 fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  for part in path.parts[1:]:
   try:os.mkdir(part,0o750,dir_fd=fd)
   except FileExistsError:pass
   nextfd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd);os.close(fd);fd=nextfd
  if os.fstat(fd).st_uid not in {layout.trust_uid,uid}:raise PermissionError('관리 폴더 소유자')
  os.fchown(fd,uid,gid);os.fchmod(fd,0o700 if runtime else 0o750)
 finally:os.close(fd)

def write_bytes(path,data,layout,*,replace=False,mode=0o640):
 owner(layout);path=Path(path);adapter.no_symlinks(path.parent)
 on_hdd=layout.store in path.parents
 if on_hdd:verify_store(layout)
 if path.exists() or path.is_symlink():
  if not replace:raise FileExistsError('기존 원본 보존')
  raw_read(path,layout,max(len(data),core.RECEIPT_LIMIT))
 directory=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 if os.fstat(directory).st_uid!=layout.trust_uid:os.close(directory);raise PermissionError('root 관리 폴더 필요')
 if on_hdd and os.fstat(directory).st_dev!=layout.store.stat().st_dev:os.close(directory);raise PermissionError('HDD 기록 장치 변경')
 temp='.next-'+secrets.token_hex(16);fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode,dir_fd=directory)
 try:
  os.fchown(fd,layout.trust_uid,role_ids(layout)[1]);os.fchmod(fd,mode)
  with os.fdopen(fd,'wb',closefd=False) as stream:stream.write(data);stream.flush();os.fsync(fd)
 finally:os.close(fd)
 try:os.replace(temp,path.name,src_dir_fd=directory,dst_dir_fd=directory);os.fsync(directory)
 finally:os.close(directory)

def write_json(path,value,layout,*,replace=False):write_bytes(path,(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode(),layout,replace=replace)

def request_value(value):
 if set(value)!={'run_id','attempt','sha'} or type(value['run_id']) is not int or not 0<value['run_id']<10**20 or type(value['attempt']) is not int or not 0<value['attempt']<10000 or not isinstance(value['sha'],str) or not engine.REV.fullmatch(value['sha']):raise ValueError('요청 식별자 오류')
 return dict(value)

def profile_zip(raw):
 if not isinstance(raw,bytes) or not 0<len(raw)<=PROFILE_LIMIT:raise ValueError('지문 ZIP 크기')
 with zipfile.ZipFile(io.BytesIO(raw)) as z:
  rows=z.infolist()
  if len(rows)!=1:raise ValueError('지문 ZIP 항목 수')
  item=rows[0];kind=stat.S_IFMT(item.external_attr>>16)
  if item.filename!='build-input-profile.json' or item.is_dir() or item.flag_bits&1 or kind not in {0,stat.S_IFREG} or item.file_size>16384 or item.file_size<1 or item.file_size>max(1,item.compress_size)*50:raise ValueError('지문 ZIP 형식')
  data=z.read(item)
  if len(data)!=item.file_size:raise ValueError('지문 ZIP 읽기')
 value=core.decode(data)
 keys={'schema','profile','nonce_tag','required_names','all_required_present','api_base_matches','mock_disabled','input_hmacs','verification_scope'}
 if set(value)!=keys or type(value['schema']) is not int or value['schema']!=1 or value['profile']!='production_candidate' or value['required_names']!=list(INPUT_NAMES) or any(value[k] is not True for k in ['all_required_present','api_base_matches','mock_disabled']) or not isinstance(value['nonce_tag'],str) or not engine.SHA.fullmatch(value['nonce_tag']) or not isinstance(value['input_hmacs'],dict) or set(value['input_hmacs'])!=set(INPUT_NAMES) or any(not isinstance(v,str) or not engine.SHA.fullmatch(v) for v in value['input_hmacs'].values()) or not isinstance(value['verification_scope'],str) or len(value['verification_scope'])>512:raise ValueError('지문 schema')
 return value

@contextmanager
def management_lock(layout,name):
 p=layout.base/(name+'.lock');fd=os.open(p,os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
 try:
  if os.fstat(fd).st_uid!=layout.trust_uid:raise PermissionError('관리 잠금 소유자')
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);yield
 finally:os.close(fd)

def queue_rows(layout):
 folder=layout.base/'queue'
 if not folder.exists():return []
 paths=list(folder.iterdir())
 if len(paths)>MAX_QUEUE:raise ValueError('요청 원장 상한')
 rows=[]
 for p in paths:
  if p.name.startswith('.next-') and engine.ID.fullmatch(p.name[6:]):
   raw_read(p,layout);continue
  if p.suffix!='.json' or not engine.ID.fullmatch(p.stem):raise ValueError('요청 원장 이름')
  row=read_json(p,layout);request_value(row['request'])
  if row['request_id']!=p.stem:raise ValueError('요청 원장 결속')
  rows.append(row)
 return rows

def enqueue(layout,value,raw):
 owner(layout);config,_=engine.read_config(layout,require_enabled=False)
 if not config['allow_enqueue']:raise PermissionError('요청 접수 비활성')
 verify_store(layout)
 value=request_value(value);profile_zip(raw);qid=core.digest(json.dumps(value,sort_keys=True).encode())[:32]
 with management_lock(layout,'queue'):
  managed_dir(layout.base/'queue',layout);managed_dir(layout.store/'queue-payloads',layout)
  path=layout.base/'queue'/(qid+'.json')
  if path.exists():
   old=read_json(path,layout)
   if old['request']!=value or old['profile_sha256']!=core.digest(raw):raise PermissionError('중복 요청 자료 변경')
   return {'ok':True,'accepted':True,'request_id':qid,'state':old['state'],'deployment_confirmed':False,'duplicate':True}
  if len(queue_rows(layout))>=MAX_QUEUE or shutil.disk_usage(layout.store).free<core.COPY_RESERVE+PROFILE_LIMIT:raise OSError('보관 여유/요청 한도')
  payload=layout.store/'queue-payloads'/(qid+'.zip')
  if payload.exists():
   if raw_read(payload,layout,PROFILE_LIMIT)!=raw:raise PermissionError('중단 접수 자료 변경')
  else:write_bytes(payload,raw,layout,mode=0o600)
  row={'schema':1,'request_id':qid,'request':value,'profile_sha256':core.digest(raw),'created_at_ns':time.time_ns(),'state':'queued','release_id':None,'result':None}
  write_json(path,row,layout)
 return {'ok':True,'accepted':True,'request_id':qid,'state':'queued','deployment_confirmed':False,'duplicate':False}

def status(layout):
 owner(layout);config,_=engine.read_config(layout,require_enabled=False);pointer,_=engine.read_pointer(layout)
 rows=queue_rows(layout);last=max(rows,key=lambda value:value['created_at_ns']) if rows else None
 summary=None if last is None else {'request_id':last['request_id'],'run_id':last['request']['run_id'],'attempt':last['request']['attempt'],'sha':last['request']['sha'],'state':last['state'],'error':(last.get('result') or {}).get('error')}
 return {'ok':True,'auto_enabled':config['auto_enabled'],'allow_enqueue':config['allow_enqueue'],'current':pointer,'pending':sum(r['state'] in {'queued','waiting','building','executing'} for r in rows),'last_request':summary}

class GitHub:
 def __init__(self):self.certificates={}
 def verify(self,request,raw):
  cache={}
  def get(suffix):
   if suffix not in cache:
    try:cache[suffix]=adapter.github_get(suffix)
    except urllib.error.HTTPError as error:
     retry=error.headers.get('Retry-After');limited=error.code in {403,429} and (error.headers.get('X-RateLimit-Remaining')=='0' or retry is not None or error.code==429)
     if limited or error.code>=500:
      reset=error.headers.get('X-RateLimit-Reset');delay=30
      try:delay=int(retry) if retry else max(1,int(reset)-int(time.time())) if reset else 30
      except (ValueError,TypeError):pass
      raise Pending('source_service',delay) from None
     raise
    except (TimeoutError,OSError) as error:raise Pending('source_service') from error
   return cache[suffix]
  key=(request['run_id'],request['attempt'],request['sha'],core.digest(raw))
  if key in self.certificates:
   head=get('/git/ref/heads/main')
   if head.get('object',{}).get('sha')!=request['sha']:raise PermissionError('최신 main 변경')
   certificate=dict(self.certificates[key],checked_at=time.monotonic());certificate['evidence']=dict(certificate['evidence'],head_rechecked_at=datetime.now(timezone.utc).isoformat());return certificate
  run=get(f"/actions/runs/{request['run_id']}/attempts/{request['attempt']}")
  if run.get('status')!='completed':raise Pending('ci')
  if run.get('event')!='push':raise PermissionError('main push만 자동 승격 허용')
  adapter.github_verify({'source_revision':request['sha'],'ci_run':request['run_id'],'ci_attempt':request['attempt']},get)
  jobs=get(f"/actions/runs/{request['run_id']}/attempts/{request['attempt']}/jobs?per_page=100")['jobs']
  enqueue_jobs=[j for j in jobs if j.get('name')=='enqueue-release']
  if len(enqueue_jobs)!=1 or enqueue_jobs[0].get('conclusion')!='success':raise PermissionError('필수 접수 job')
  info=get(f"/actions/runs/{request['run_id']}/artifacts?per_page=100")
  if info.get('total_count')!=len(info.get('artifacts',[])) or len(info['artifacts'])>100:raise PermissionError('artifact 목록 한도')
  expected=f"front-input-profile-{request['run_id']}-{request['attempt']}";matched=[x for x in info['artifacts'] if x.get('name')==expected]
  if len(matched)!=1:raise PermissionError('시도별 artifact 모호')
  item=matched[0];binding=item.get('workflow_run',{})
  if item.get('expired') is not False or item.get('digest')!='sha256:'+core.digest(raw) or binding.get('id')!=request['run_id'] or binding.get('head_sha')!=request['sha'] or binding.get('repository_id')!=1243065308 or binding.get('head_repository_id')!=1243065308 or binding.get('head_branch')!='main':raise PermissionError('공식 지문 artifact 결속')
  evidence={'scope':'github_api','repo':adapter.REPO,'repository_id':1243065308,'head_repository_id':binding['head_repository_id'],'source_revision':request['sha'],'run_id':request['run_id'],'attempt':request['attempt'],'status':run['status'],'conclusion':run['conclusion'],'required_jobs':{j['name']:{'id':j['id'],'status':j['status'],'conclusion':j['conclusion']} for j in jobs if j['name'] in adapter.REQUIRED_JOBS|{'enqueue-release'}},'artifact_id':item['id'],'artifact_digest':item['digest'],'observed_at':datetime.now(timezone.utc).isoformat()}
  value={'profile':profile_zip(raw),'artifact_id':item['id'],'artifact_digest':item['digest'],'checked_at':time.monotonic(),'evidence':evidence};self.certificates[key]=value;return value

def snapshot_tar(layout,pointer):
 files=core.manifest(layout.live,{layout.live_uid if layout.live_uid>=0 else pwd.getpwnam('iwh').pw_uid,role_ids(layout)[0]})
 raw=io.BytesIO()
 with tarfile.open(fileobj=raw,mode='w',format=tarfile.USTAR_FORMAT) as t:
  for name,expected in files.items():
   data=core.read_tree_file(layout.live,name,owner_uids={layout.live_uid if layout.live_uid>=0 else pwd.getpwnam('iwh').pw_uid,role_ids(layout)[0]})
   if core.digest(data)!=expected:raise PermissionError('백업 중 파일 변경')
   item=tarfile.TarInfo(name);item.size=len(data);item.mode=0o644;t.addfile(item,io.BytesIO(data))
 backup=raw.getvalue()
 if adapter.backup_manifest(backup)!=pointer['live_sha']:raise PermissionError('현재 포인터/백업 불일치')
 return backup

def live_sha(layout):return core.tree_sha(layout.live,{layout.live_uid if layout.live_uid>=0 else pwd.getpwnam('iwh').pw_uid,role_ids(layout)[0]})

def seal_release(layout,rid,request,built,verified,parent):
 config,_=engine.read_config(layout);maintenance_wait(layout,rid)
 verify_store(layout)
 if live_sha(layout)!=parent['live_sha']:raise PermissionError('빌드 중 운영 변경')
 managed_dir(layout.store/'releases'/rid,layout);managed_dir(layout.store/'releases'/rid/'inbox',layout)
 managed_dir(layout.base/'releases',layout);managed_dir(layout.runtime(rid),layout,runtime=True);managed_dir(layout.runtime(rid)/'state',layout,runtime=True)
 inbox=layout.slot(rid).inbox
 rootwork=layout.store/'builds'/rid
 for field,name,limit in [('archive_path','candidate.tar',core.ARCHIVE_LIMIT),('receipt_path','receipt.json',core.RECEIPT_LIMIT),('provenance_path','provenance.json',core.RECEIPT_LIMIT)]:
  p=Path(built[field]);adapter.no_symlinks(p)
  if rootwork not in p.parents:raise PermissionError('빌드 출력 경로')
  data=raw_read(p,layout,limit);write_bytes(inbox/name,data,layout)
 backup=snapshot_tar(layout,parent);write_bytes(inbox/'backup.tar',backup,layout)
 if raw_read(inbox/'backup.tar',layout,core.TREE_LIMIT+4*1024*1024)!=backup:raise OSError('HDD 백업 readback')
 raw=raw_read(inbox/'candidate.tar',layout,core.ARCHIVE_LIMIT);receipt=raw_read(inbox/'receipt.json',layout)
 profile_sha=core.digest(json.dumps(verified['profile'],sort_keys=True).encode())
 if built['profile_sha256']!=profile_sha:raise PermissionError('CI/빌드 지문 불일치')
 policy={'schema':1,'enabled':True,'target':str(layout.live),'policy_id':secrets.token_hex(16),'approved_until':(datetime.now(timezone.utc)+timedelta(minutes=10)).isoformat(),'source_revision':request['sha'],'ci_run':request['run_id'],'ci_attempt':request['attempt'],'current_main':request['sha'],'archive_sha256':core.digest(raw),'receipt_sha256':core.digest(receipt),'backup_sha256':core.digest(backup),'baseline_sha':parent['live_sha'],'input_profile_digest':profile_sha}
 _,_,expected=adapter.audit_inputs(layout.slot(rid),policy)
 plan={'schema':1,'release_id':rid,'parent_release':parent['release_id'],'policy':policy,'expected_state':expected}
 write_json(layout.store/'releases'/rid/'parent-current.json',parent,layout)
 evidence=verified.get('evidence')
 if not isinstance(evidence,dict) or not layout.fixture_root and evidence.get('scope')!='github_api':raise PermissionError('공식 CI 증거 필요')
 write_json(layout.store/'releases'/rid/'verified-ci.json',evidence,layout)
 write_json(layout.plan_path(rid),plan,layout)
 managed_dir(layout.base/'intents',layout)
 intent={'schema':1,'release_id':rid,'parent_release':parent['release_id'],'baseline_sha':parent['live_sha'],'plan_sha256':core.digest(raw_read(layout.plan_path(rid),layout)),'phase':'prepared'}
 write_json(layout.intent_path(rid),intent,layout)
 return plan

def intent_phase(layout,rid,phase):
 value=read_json(layout.intent_path(rid),layout);value['phase']=phase;write_json(layout.intent_path(rid),value,layout,replace=True)

def default_builder(layout,request,work,profile):
 import continuous_build as builder
 config=builder.load_config()
 try:return builder.build_candidate(request,work,config,profile)
 except builder.BuildDeferred as error:raise Pending('resources') from error

def default_executor(layout,rid,action='execute',*,fixture_test=False):
 if action not in {'execute','recover'} or not engine.ID.fullmatch(rid):raise PermissionError('실행 형식')
 if layout.fixture_root:
  fid=layout.fixture_root.name
  if not fixture_test or not engine.ID.fullmatch(fid):raise PermissionError('fixture executor 명시 필요')
  prefix='iot-web-release-fixture-'+fid+('-recover@' if action=='recover' else '@')
 elif fixture_test:raise PermissionError('production fixture override 금지')
 else:prefix='iot-web-release@' if action=='execute' else 'iot-web-release-recover@'
 unit=prefix+rid+'.service'
 p=layout.runtime(rid)/'result.json'
 before=p.lstat() if p.exists() or p.is_symlink() else None
 intent_sha=core.digest(raw_read(layout.intent_path(rid),layout))
 result=subprocess.run(['/usr/bin/systemctl','start','--wait',unit],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=48)
 adapter.no_symlinks(p);after=p.lstat()
 if before and (before.st_dev,before.st_ino,before.st_mtime_ns)==(after.st_dev,after.st_ino,after.st_mtime_ns):raise PermissionError('실행 결과가 새로 기록되지 않음')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:data=core.read_descriptor(fd,core.RECEIPT_LIMIT,p.stat().st_dev,{role_ids(layout)[0]})
 finally:os.close(fd)
 value=core.decode(data)
 if value.get('release_id')!=rid or type(value.get('ok')) is not bool or value.get('action')!=action or value.get('intent_sha256')!=intent_sha or (result.returncode==0)!=value['ok'] or action=='recover' and value.get('phase')=='active':raise PermissionError('실행 결과 결속')
 value['service_exit']=result.returncode
 return value

def commit_result(layout,rid,result,*,recovered=False,fault=None):
 plan,_=engine.read_plan(layout,rid);expected=plan['expected_state'];actual=live_sha(layout)
 parent=read_json(layout.store/'releases'/rid/'parent-current.json',layout)
 if parent['release_id']!=plan['parent_release'] or parent['live_sha']!=expected['baseline_sha']:raise PermissionError('부모 원본 결속')
 if result.get('live_sha')!=actual:raise PermissionError('실제 결과 hash 불일치')
 if result.get('ok') is True and result.get('health_verified') is True and result.get('phase')=='active' and actual==expected['candidate_sha']:
  pointer={'schema':1,'release_id':rid,'source_revision':plan['policy']['source_revision'],'live_sha':actual,'proof_release':rid};outcome='healthy'
 elif result.get('phase')=='rolled_back' and actual==expected['rollback_sha']:
  pointer=dict(parent,live_sha=actual,proof_release=rid);outcome='rolled_back' if result.get('health_verified') is True else 'unhealthy_rollback'
 elif actual==expected['baseline_sha']:
  pointer=parent;outcome='not_published'
 else:raise PermissionError('실제 운영 결과 모호')
 receipt={'schema':1,'release_id':rid,'outcome':outcome,'pointer':pointer,'result':result,'at_ns':time.time_ns(),'plan_sha256':core.digest(raw_read(layout.plan_path(rid),layout))}
 # root receipt를 먼저 남기고 pointer, intent 순서로 확정한다. 각 원본은 덮지 않는다.
 receipt_dir=layout.store/'releases'/rid/'receipts';managed_dir(receipt_dir,layout)
 write_json(receipt_dir/(str(receipt['at_ns'])+'.json'),receipt,layout)
 if fault:fault('after_receipt',rid)
 write_json(layout.current,pointer,layout,replace=True)
 if fault:fault('after_current',rid)
 for row in queue_rows(layout):
  if row['release_id']==rid:
   row.update(state=outcome,result=receipt);write_json(layout.base/'queue'/(row['request_id']+'.json'),row,layout,replace=True)
 if fault:fault('before_intent_close',rid)
 intent_phase(layout,rid,'completed' if outcome=='healthy' else outcome)
 if outcome=='unhealthy_rollback':
  config,_=engine.read_config(layout,require_enabled=False);config.update(auto_enabled=False,allow_enqueue=False);write_json(layout.config,config,layout,replace=True)
 return receipt

def process_one(layout,*,backend=None,builder=None,executor=None,fault=None,cleanup=None):
 owner(layout);config,_=engine.read_config(layout,require_enabled=False)
 if not config['auto_enabled']:return {'ok':True,'state':'disabled','deployment_confirmed':False}
 verify_store(layout)
 backend=backend or GitHub();builder=builder or (lambda request,work,profile:default_builder(layout,request,work,profile));executor=executor or (lambda rid,action='execute':default_executor(layout,rid,action))
 with management_lock(layout,'controller'):
  # 미완료 transaction이 있으면 최신 요청보다 먼저 현재 slot을 복구/확정한다.
  intents=layout.base/'intents'
  if intents.exists():
   pending=[]
   for p in intents.iterdir():
    if p.suffix!='.json' or not engine.ID.fullmatch(p.stem):raise ValueError('intent 이름')
    value=read_json(p,layout)
    if value['phase'] in {'executing','verifying','recovering'}:pending.append(p.stem)
   if len(pending)>1:raise PermissionError('복수 미완료 transaction')
   if pending:
    rid=pending[0]
    try:maintenance_wait(layout,rid)
    except Pending:return {'ok':False,'state':'waiting','release_id':rid,'error':'WaitingMaintenance','deployment_confirmed':False}
    receipts=layout.store/'releases'/rid/'receipts'
    if receipts.exists():
     paths=list(receipts.iterdir())
     if len(paths)>100:raise ValueError('릴리스 영수증 상한')
     saved=[read_json(p,layout) for p in paths if p.suffix=='.json' and p.stem.isdigit()]
     saved.sort(key=lambda value:value['at_ns'],reverse=True)
     if saved and saved[0]['plan_sha256']==core.digest(raw_read(layout.plan_path(rid),layout)) and saved[0]['pointer']['live_sha']==live_sha(layout):
      receipt=saved[0];write_json(layout.current,receipt['pointer'],layout,replace=True)
      for row in queue_rows(layout):
       if row['release_id']==rid:
        row.update(state=receipt['outcome'],result=receipt);write_json(layout.base/'queue'/(row['request_id']+'.json'),row,layout,replace=True)
      intent_phase(layout,rid,'completed' if receipt['outcome']=='healthy' else receipt['outcome'])
      if receipt['outcome']=='unhealthy_rollback':
       config.update(auto_enabled=False,allow_enqueue=False);write_json(layout.config,config,layout,replace=True)
      return receipt
    intent_phase(layout,rid,'recovering');result=executor(rid,'recover');return commit_result(layout,rid,result,recovered=True)
  for row in queue_rows(layout):
   if row['state']=='building':
    rid=row['release_id']
    if cleanup is not None:cleanup(rid)
    elif not layout.fixture_root:
     import continuous_build
     continuous_build.cleanup_build(rid,continuous_build.load_config())
    row.update(state='interrupted',result={'error':'InterruptedBuild','deployment_confirmed':False});write_json(layout.base/'queue'/(row['request_id']+'.json'),row,layout,replace=True)
  candidates=[r for r in queue_rows(layout) if r['state'] in {'queued','waiting'} and r.get('retry_at_ns',0)<=time.time_ns()]
  if not candidates:return {'ok':True,'state':'idle','deployment_confirmed':False}
  row=max(candidates,key=lambda r:r['created_at_ns']);qid=row['request_id'];request=row['request'];path=layout.base/'queue'/(qid+'.json')
  try:
   maintenance_wait(layout);raw=raw_read(layout.store/'queue-payloads'/(qid+'.zip'),layout,PROFILE_LIMIT)
   if core.digest(raw)!=row['profile_sha256']:raise PermissionError('접수 자료 변경')
   verified=backend.verify(request,raw);parent,_=engine.read_pointer(layout)
   if live_sha(layout)!=parent['live_sha']:raise PermissionError('운영 현재 포인터 변경')
   rid=secrets.token_hex(16);row.update(state='building',release_id=rid);write_json(path,row,layout,replace=True)
   managed_dir(layout.store/'builds',layout);work=layout.store/'builds'/rid
   built=builder(request,work,verified['profile'])
   engine.read_config(layout);maintenance_wait(layout,rid)
   # 빌드·백업 이후 source/CI/latest를 다시 확인한 뒤만 executing을 발급한다.
   verified=backend.verify(request,raw);plan=seal_release(layout,rid,request,built,verified,parent)
   verified=backend.verify(request,raw)
   if time.monotonic()-verified['checked_at']>10 or live_sha(layout)!=parent['live_sha']:raise PermissionError('승격 전 최신성/기준 변경')
   intent_phase(layout,rid,'executing');row['state']='executing';write_json(path,row,layout,replace=True)
   if fault:fault('before_executor',rid)
   result=executor(rid,'execute')
   if fault:fault('after_executor',rid)
   receipt=commit_result(layout,rid,result,fault=fault);row.update(state=receipt['outcome'],result=receipt);write_json(path,row,layout,replace=True)
   return {'ok':receipt['outcome']=='healthy','request_id':qid,'release_id':rid,'state':receipt['outcome'],'deployment_confirmed':receipt['outcome']=='healthy'}
  except (Pending,BlockingIOError) as error:
   delay=0 if layout.fixture_root else getattr(error,'retry_after',30)
   row.update(state='waiting',retry_at_ns=time.time_ns()+delay*1000000000,result={'error':type(error).__name__,'reason':getattr(error,'reason','resources')});write_json(path,row,layout,replace=True);return {'ok':False,'state':'waiting','error':type(error).__name__,'deployment_confirmed':False}
  except Exception as error:
   rid=row.get('release_id');pending=rid and layout.intent_path(rid).exists() and read_json(layout.intent_path(rid),layout)['phase'] in {'executing','verifying','recovering'}
   row.update(state='executing' if pending else 'rejected',result={'error':type(error).__name__});write_json(path,row,layout,replace=True)
   return {'ok':False,'state':row['state'],'error':type(error).__name__,'deployment_confirmed':False}

def dispatch_request(value,layout=None):
 layout=layout or engine.Layout.production();owner(layout)
 if value=={'operation':'continuous-status'}:return status(layout)
 if set(value)!={'operation','run_id','attempt','sha','profile_zip_b64'} or value['operation']!='continuous-enqueue' or not isinstance(value['profile_zip_b64'],str) or len(value['profile_zip_b64'])>PROFILE_LIMIT*4//3+8:raise ValueError('접수 schema')
 raw=base64.b64decode(value['profile_zip_b64'],validate=True)
 return enqueue(layout,{k:value[k] for k in ['run_id','attempt','sha']},raw)

def main(argv=None):
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=['once','status']);args=parser.parse_args(argv);layout=engine.Layout.production();owner(layout)
 result=process_one(layout) if args.action=='once' else status(layout);print(json.dumps(result,sort_keys=True));return 0 if result.get('ok') else 1
if __name__=='__main__':
 try:raise SystemExit(main())
 except Exception as exc:print(json.dumps({'ok':False,'error':type(exc).__name__}));raise SystemExit(1)
