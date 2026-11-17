#!/usr/bin/python3
"""전용 SSH 키의 고정 명령을 인자 없는 root dispatcher로 전달한다."""
import base64,json,os,re,signal,subprocess,sys
COMMANDS={'iot-web-publish '+x:x for x in ('readiness','audit','publish','rollback','recover')}
def main():
 command=os.environ.get('SSH_ORIGINAL_COMMAND','')
 if command in COMMANDS:payload={'operation':COMMANDS[command]}
 elif command=='iot-web-publish status':payload={'operation':'continuous-status'}
 else:
  match=re.fullmatch(r'iot-web-publish enqueue ([1-9][0-9]{0,19}) ([1-9][0-9]{0,3}) ([0-9a-f]{40})',command)
  if not match:raise PermissionError('허용되지 않은 전용 명령')
  signal.alarm(10);raw=sys.stdin.buffer.read(65537);signal.alarm(0)
  if not 0<len(raw)<=65536:raise ValueError('지문 ZIP 크기')
  payload={'operation':'continuous-enqueue','run_id':int(match[1]),'attempt':int(match[2]),'sha':match[3],'profile_zip_b64':base64.b64encode(raw).decode('ascii')}
 result=subprocess.run(['/usr/bin/sudo','-n','/usr/local/libexec/iot-web-publisher/dispatch'],input=json.dumps(payload).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=55,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
 sys.stdout.buffer.write(result.stdout[:65536])
 if result.returncode:sys.stderr.write('전용 작업 거부 또는 실패\n')
 return result.returncode
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as exc:print(type(exc).__name__,file=sys.stderr);sys.exit(1)
