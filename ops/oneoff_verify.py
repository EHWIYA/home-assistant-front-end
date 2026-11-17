#!/usr/bin/python3 -I
"""관리자 전용 단발 V2 검증. CI/SSH에는 이 진입점을 노출하지 않는다."""
import argparse,json,os,signal,stat,subprocess,sys,time
from contextlib import contextmanager
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import continuous_gateway as g
engine,core=g.engine,g.core
ACTIVE={'queued','waiting','building','executing'}
class StopRequested(BaseException):pass

def path(layout):return layout.base/'oneoff.json'
def load(layout):return g.read_json(path(layout),layout)
def save(layout,value):
 folder=layout.store/'oneoff-history'/value['nonce'];g.managed_dir(folder,layout)
 g.write_json(folder/(str(time.time_ns())+'.json'),value,layout)
 g.write_json(path(layout),value,layout,replace=path(layout).exists())

@contextmanager
def queue_lock(layout):
 stop=time.monotonic()+3
 while True:
  manager=g.management_lock(layout,'queue')
  try:manager.__enter__();break
  except BlockingIOError:
   if time.monotonic()>=stop:raise
   time.sleep(.025)
 try:yield
 finally:manager.__exit__(None,None,None)

def flags(layout,auto,allow):
 with queue_lock(layout):
  value,_=engine.read_config(layout,require_enabled=False)
  value.update(auto_enabled=auto,allow_enqueue=allow);g.write_json(layout.config,value,layout,replace=True)
  check,_=engine.read_config(layout,require_enabled=False)
  if (check['auto_enabled'],check['allow_enqueue'])!=(auto,allow):raise RuntimeError('gate readback')

def exact_row(layout,request):
 request=g.request_value(request);qid=core.digest(json.dumps(request,sort_keys=True).encode())[:32]
 rows=g.queue_rows(layout);matches=[r for r in rows if r['request_id']==qid and r['request']==request]
 if len(matches)!=1 or any(r['request_id']!=qid and r['state'] in ACTIVE for r in rows):raise PermissionError('다른 단발 요청/작업')
 return matches[0]

def arm(layout,sha):
 g.owner(layout)
 if not isinstance(sha,str) or not engine.REV.fullmatch(sha):raise ValueError('source SHA')
 config,_=engine.read_config(layout,require_enabled=False)
 if config['auto_enabled'] or config['allow_enqueue']:raise PermissionError('gate가 닫혀 있어야 함')
 if path(layout).exists() and load(layout)['phase'] not in {'closed','closed_error'}:raise PermissionError('기존 단발 작업')
 if any(r['state'] in ACTIVE for r in g.queue_rows(layout)):raise PermissionError('기존 대기 작업')
 g.maintenance_wait(layout);pointer,_=engine.read_pointer(layout)
 if g.live_sha(layout)!=pointer['live_sha']:raise PermissionError('현재 live/포인터')
 value={'schema':1,'nonce':g.secrets.token_hex(16),'sha':sha,'request':None,'release_id':None,'phase':'armed','expires_ns':time.time_ns()+1800*10**9,'last_execution':None,'result':None}
 save(layout,value);return {'ok':True,'phase':'armed','nonce':value['nonce'],'sha':sha}

def submit(layout,request):
 g.owner(layout);value=load(layout);request=g.request_value(request)
 if value['phase']!='waiting_ci' or request['sha']!=value['sha'] or time.time_ns()>value['expires_ns']:raise PermissionError('단발 접수 상태')
 config,_=engine.read_config(layout,require_enabled=False)
 if config['auto_enabled']:raise PermissionError('접수 중 승격 gate')
 # 큐 잠금으로 진행 중 enqueue가 끝난 뒤 닫힌 창을 확인한다.
 flags(layout,False,False)
 row=exact_row(layout,request)
 if row['state'] not in {'queued','waiting'}:raise PermissionError('단발 요청 상태')
 value.update(request=request,phase='execute_requested');save(layout,value)
 return {'ok':True,'phase':'execute_requested','request_id':row['request_id']}

def _identity(p):
 if not p.exists() and not p.is_symlink():return None
 s=p.lstat();return [s.st_dev,s.st_ino,s.st_mtime_ns]

def execute(layout,rid,action='execute'):
 value=load(layout);row=exact_row(layout,value['request'])
 if row['release_id']!=rid or not engine.ID.fullmatch(rid):raise PermissionError('단발 실행 release')
 value.update(release_id=rid,last_execution={'release_id':rid,'action':action,'intent_sha256':core.digest(g.raw_read(layout.intent_path(rid),layout)),'before':_identity(layout.runtime(rid)/'result.json')})
 save(layout,value)
 return g.default_executor(layout,rid,action,fixture_test=bool(layout.fixture_root))

def wait_roles(layout,rid):
 if layout.fixture_root:return
 stop=time.monotonic()+50
 while True:
  states=[subprocess.check_output(['systemctl','show','-p','ActiveState','--value',prefix+rid+'.service'],text=True,timeout=5).strip() for prefix in ['iot-web-release@','iot-web-release-recover@']]
  if not any(s in {'active','activating','deactivating','reloading'} for s in states):return
  if time.monotonic()>stop:
   for prefix in ['iot-web-release@','iot-web-release-recover@']:
    subprocess.run(['systemctl','stop',prefix+rid+'.service'],check=True,timeout=10,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   states=[subprocess.check_output(['systemctl','show','-p','ActiveState','--value',prefix+rid+'.service'],text=True,timeout=5).strip() for prefix in ['iot-web-release@','iot-web-release-recover@']]
   if any(s in {'active','activating','deactivating','reloading'} for s in states):raise TimeoutError('단발 role 종료 확인 불가')
   return
  time.sleep(.2)

def fresh_result(layout,rid,value):
 record=value.get('last_execution');p=layout.runtime(rid)/'result.json'
 if not record or record['release_id']!=rid or _identity(p)==record['before']:return None
 try:
  adapter=engine.adapter;adapter.no_symlinks(p);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
  try:data=core.read_descriptor(fd,core.RECEIPT_LIMIT,p.stat().st_dev,{g.role_ids(layout)[0]})
  finally:os.close(fd)
  result=core.decode(data)
  if result.get('release_id')!=rid or result.get('action')!=record['action'] or result.get('intent_sha256')!=record['intent_sha256'] or core.digest(g.raw_read(layout.intent_path(rid),layout))!=record['intent_sha256'] or type(result.get('ok')) is not bool or record['action']=='recover' and result.get('phase')=='active':return None
  if not layout.fixture_root:
   unit=('iot-web-release@' if record['action']=='execute' else 'iot-web-release-recover@')+rid+'.service'
   exitcode=int(subprocess.check_output(['systemctl','show',unit,'-p','ExecMainStatus','--value'],text=True,timeout=5))
   exitkind=int(subprocess.check_output(['systemctl','show',unit,'-p','ExecMainCode','--value'],text=True,timeout=5))
   if exitkind!=1 or (exitcode==0)!=result['ok']:return None
  return result
 except (OSError,ValueError,KeyError,TypeError):return None

def cleanup(layout,*,waiter=None,executor=None,reason='finally'):
 g.owner(layout)
 # 획득 실패는 active owner의 설정·원장에 아무 변경도 하지 않는다.
 # flags/readback/기록 확정까지 동일 controller lock을 유지한다.
 with g.management_lock(layout,'controller'):
  return _cleanup_locked(layout,load(layout),waiter=waiter,executor=executor,reason=reason)

def _cleanup_locked(layout,value,*,waiter=None,executor=None,reason='finally'):
 outcome=None;problem=None
 try:
  if value['request'] is not None:
   row=exact_row(layout,value['request']);rid=row.get('release_id')
   if rid:
    (waiter or wait_roles)(layout,rid)
    # 진행 중 role이 끝난 뒤에만 fingerprint를 바꾸는 gate를 닫는다.
    flags(layout,False,False)
    intent=g.read_json(layout.intent_path(rid),layout) if layout.intent_path(rid).exists() else None
    if intent and intent['phase'] in {'executing','verifying','recovering'}:
     result=fresh_result(layout,rid,value)
     if result and result.get('phase') in {'active','rolled_back'} and result.get('health_verified') is True:
      outcome=g.commit_result(layout,rid,result,recovered=record_action(value)=='recover')['outcome']
     else:
      g.maintenance_wait(layout,rid)
      g.intent_phase(layout,rid,'recovering')
      result=(executor or execute)(layout,rid,'recover')
      outcome=g.commit_result(layout,rid,result,recovered=True)['outcome']
    elif intent:outcome=row['state']
    elif row['state']=='building':
     if not layout.fixture_root:
      import continuous_build
      continuous_build.cleanup_build(rid,continuous_build.load_config())
     row.update(state='interrupted',result={'error':'OneoffInterruptedBeforeIntent','deployment_confirmed':False});g.write_json(layout.base/'queue'/(row['request_id']+'.json'),row,layout,replace=True);outcome='not_published'
  else:outcome='not_requested'
 except BaseException as error:
  problem=type(error).__name__
 finally:
  flags(layout,False,False)
  value=load(layout);value.update(phase='closed_error' if problem else 'closed',cleanup_reason=reason,cleanup_outcome=outcome,cleanup_error=problem);save(layout,value)
 if problem:raise RuntimeError('단발 복구/종료 확인 실패')
 return {'ok':True,'phase':'closed','outcome':outcome,'auto_enabled':False,'allow_enqueue':False}

def record_action(value):return (value.get('last_execution') or {}).get('action')

def watch(layout,*,processor=None,sleeper=time.sleep):
 g.owner(layout);value=load(layout)
 if value['phase']!='armed':raise PermissionError('단발 arm 필요')
 def stop(*_):raise StopRequested()
 previous={s:signal.signal(s,stop) for s in [signal.SIGTERM,signal.SIGHUP,signal.SIGINT]}
 try:
  flags(layout,False,True);value.update(phase='waiting_ci');save(layout,value)
  while True:
   value=load(layout)
   if time.time_ns()>value['expires_ns']:raise TimeoutError('단발 접수 기한')
   if value['phase']=='execute_requested':break
   if value['phase']!='waiting_ci':raise PermissionError('단발 진행 상태')
   sleeper(.25)
  exact_row(layout,value['request']);g.maintenance_wait(layout)
  flags(layout,True,False);value.update(phase='processing');save(layout,value)
  result=(processor or g.process_one)(layout,expected_request=value['request'],executor=lambda rid,action='execute':execute(layout,rid,action))
  value=load(layout);value['result']=result;save(layout,value)
  return result
 finally:
  mask=signal.pthread_sigmask(signal.SIG_BLOCK,{signal.SIGTERM,signal.SIGHUP,signal.SIGINT})
  try:cleanup(layout,reason='watch_finally')
  finally:
   for s,handler in previous.items():signal.signal(s,handler)
   signal.pthread_sigmask(signal.SIG_SETMASK,mask)

def main(argv=None):
 if os.getuid()!=0:raise PermissionError('root 관리자 전용')
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['arm','submit','watch','cleanup','status']);parser.add_argument('--sha');parser.add_argument('--run',type=int);parser.add_argument('--attempt',type=int);parser.add_argument('--fixture');args=parser.parse_args(argv)
 if args.fixture and not engine.ID.fullmatch(args.fixture):raise ValueError('fixture ID')
 layout=engine.Layout.fixture(Path('/var/lib/iot-web-publisher/rehearsal/v2')/args.fixture) if args.fixture else engine.Layout.production()
 if args.action=='arm':result=arm(layout,args.sha)
 elif args.action=='submit':result=submit(layout,{'run_id':args.run,'attempt':args.attempt,'sha':args.sha})
 elif args.action=='watch':result=watch(layout)
 elif args.action=='cleanup':result=cleanup(layout,reason='ExecStopPost')
 else:
  value=load(layout);config,_=engine.read_config(layout,require_enabled=False);result={k:value.get(k) for k in ['nonce','sha','request','release_id','phase','result','cleanup_outcome','cleanup_error']};result.update(auto_enabled=config['auto_enabled'],allow_enqueue=config['allow_enqueue'])
 print(json.dumps(result,sort_keys=True));return 0 if result.get('ok',True) else 1
if __name__=='__main__':
 try:raise SystemExit(main())
 except Exception as error:print(json.dumps({'ok':False,'error':type(error).__name__}));raise SystemExit(1)
