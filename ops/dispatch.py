#!/usr/bin/python3 -I
"""인자 없는 sudo 경계. 서비스/경로/정책은 호출자가 선택할 수 없다."""
import fcntl,json,os,pwd,re,secrets,signal,stat,subprocess,sys
from pathlib import Path
BASE=Path('/var/lib/iot-web-publisher')
POLICY=Path('/etc/iot-web-publisher/policy.json')
OPS={'readiness','audit','publish','rollback','recover'}
def pairs(items):
 d={}
 for k,v in items:
  if k in d:raise ValueError('duplicate key')
  d[k]=v
 return d
def read_regular(path,limit,owner):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  s=os.fstat(fd)
  if not stat.S_ISREG(s.st_mode) or s.st_uid!=owner or s.st_size>limit or s.st_mode&0o022:raise PermissionError('unsafe file')
  raw=os.read(fd,limit+1)
  if len(raw)>limit:raise ValueError('oversize')
  return json.loads(raw,object_pairs_hook=pairs)
 finally:os.close(fd)
def main():
 if len(sys.argv)!=1 or os.geteuid()!=0 or os.environ.get('SUDO_USER')!='iwh':raise PermissionError('fixed sudo entry required')
 signal.alarm(3)
 raw=sys.stdin.buffer.read(1025)
 signal.alarm(0)
 if len(raw)>1024:raise ValueError('oversize request')
 obj=json.loads(raw,object_pairs_hook=pairs)
 if set(obj)!={'operation'} or obj['operation'] not in OPS:raise ValueError('invalid request')
 lock=os.open('/run/lock/iot-web-publisher-dispatch.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
 try:
  if os.fstat(lock).st_uid!=0:raise PermissionError('lock owner')
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  policy=read_regular(POLICY,16384,0)
  if not re.fullmatch('[a-f0-9]{32}',policy['policy_id']):raise ValueError('policy id')
  request_id=secrets.token_hex(16)
  request={'operation':obj['operation'],'policy_id':policy['policy_id'],'request_id':request_id}
  uid=pwd.getpwnam('iot-web-publisher').pw_uid;gid=pwd.getpwnam('iot-web-publisher').pw_gid
  fd=os.open(BASE/'requests'/f'{request_id}.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o640)
  try:
   os.fchown(fd,0,gid);os.write(fd,json.dumps(request).encode());os.fsync(fd)
  finally:os.close(fd)
  result=subprocess.run(['/usr/bin/systemctl','start','--wait',f'iot-web-publisher@{request_id}.service'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=48,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
  path=BASE/'results'/f'{request_id}.json'
  data=read_regular(path,65536,uid) if path.exists() else {'ok':False,'error':'service failed without result'}
  print(json.dumps({'request_id':request_id,'service_exit':result.returncode,'result':{k:v for k,v in data.items() if k in {'ok','operation','enabled','production_changed','inputs_verified','github_verified','phase','error'} and (v is None or type(v) in (bool,int) or isinstance(v,str) and len(v)<=80)}},ensure_ascii=False))
  return 0 if result.returncode==0 and data.get('ok') is True else 1
 finally:os.close(lock)
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as exc:print(json.dumps({'ok':False,'error':type(exc).__name__}));sys.exit(1)
