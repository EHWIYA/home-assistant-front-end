#!/usr/bin/python3
"""전용 SSH 키의 고정 명령을 인자 없는 root dispatcher로 전달한다."""
import json,os,subprocess,sys
COMMANDS={'iot-web-publish '+x:x for x in ('readiness','audit','publish','rollback','recover')}
def main():
 command=os.environ.get('SSH_ORIGINAL_COMMAND','')
 if command not in COMMANDS:raise PermissionError('허용되지 않은 전용 명령')
 result=subprocess.run(['/usr/bin/sudo','-n','/usr/local/libexec/iot-web-publisher/dispatch'],input=json.dumps({'operation':COMMANDS[command]}).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=55,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
 sys.stdout.buffer.write(result.stdout[:65536])
 if result.returncode:sys.stderr.write('전용 작업 거부 또는 실패\n')
 return result.returncode
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as exc:print(type(exc).__name__,file=sys.stderr);sys.exit(1)
