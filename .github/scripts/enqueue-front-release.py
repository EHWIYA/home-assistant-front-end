#!/usr/bin/env python3
"""공개 지문 ZIP만 임시 CI 토큰으로 받아 제한 NAS 요청에 전달한다. 운영 승격은 기다리지 않는다."""
import base64,hashlib,json,os,re,stat,subprocess,sys,tempfile,urllib.parse,urllib.request
from pathlib import Path
REPO='EHWIYA/home-assistant-front-end';LIMIT=65536
class MetadataRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise PermissionError('metadata redirect')
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  parsed=urllib.parse.urlsplit(newurl)
  if parsed.scheme!='https' or not parsed.hostname or not (parsed.hostname.endswith('.blob.core.windows.net') or parsed.hostname.endswith('.amazonaws.com') or parsed.hostname.endswith('.actions.githubusercontent.com')):raise PermissionError('artifact redirect')
  return urllib.request.Request(newurl,headers={'Accept':'application/octet-stream'})
def metadata(token,suffix):
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+suffix,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'front-enqueue/1'})
 with urllib.request.build_opener(MetadataRedirect()).open(req,timeout=15) as response:
  raw=response.read(1024*1024+1)
 if len(raw)>1024*1024:raise ValueError('metadata size')
 return json.loads(raw)
def download(token,artifact):
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/actions/artifacts/'+str(artifact)+'/zip',headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'})
 with urllib.request.build_opener(Redirect()).open(req,timeout=20) as response:raw=response.read(LIMIT+1)
 if not 0<len(raw)<=LIMIT:raise ValueError('artifact size')
 return raw

def context(env):
 if env.get('GITHUB_REPOSITORY')!=REPO or env.get('GITHUB_REF')!='refs/heads/main' or not re.fullmatch('[a-f0-9]{40}',env.get('GITHUB_SHA','')) or not re.fullmatch('[1-9][0-9]{0,19}',env.get('GITHUB_RUN_ID','')) or not re.fullmatch('[1-9][0-9]{0,3}',env.get('GITHUB_RUN_ATTEMPT','')):raise PermissionError('source context')
 return int(env['GITHUB_RUN_ID']),int(env['GITHUB_RUN_ATTEMPT']),env['GITHUB_SHA']
def select_artifact(value,run,attempt,sha):
 if value.get('total_count')!=len(value.get('artifacts',[])) or len(value['artifacts'])>100:raise ValueError('artifact list')
 items=[x for x in value['artifacts'] if x.get('name')==f'front-input-profile-{run}-{attempt}']
 if len(items)!=1:raise ValueError('attempt artifact')
 item=items[0];binding=item.get('workflow_run',{})
 if type(item.get('id')) is not int or item.get('expired') is not False or not re.fullmatch('sha256:[a-f0-9]{64}',item.get('digest','')) or binding.get('id')!=run or binding.get('head_sha')!=sha or binding.get('repository_id')!=1243065308 or binding.get('head_repository_id')!=1243065308 or binding.get('head_branch')!='main':raise PermissionError('artifact binding')
 return item

def main():
 env=os.environ;run,attempt,sha=context(env);token=env['GH_TOKEN'];item=select_artifact(metadata(token,f'/actions/runs/{run}/artifacts?per_page=100'),run,attempt,sha);raw=download(token,item['id'])
 if 'sha256:'+hashlib.sha256(raw).hexdigest()!=item['digest']:raise PermissionError('artifact digest')
 keys={tuple(line.split()[1:3]) for line in env['NAS_SSH_HOST_KEYS'].splitlines() if len(line.split())>=3 and line.split()[1]=='ssh-ed25519'}
 if len(keys)!=1 or not env.get('NAS_PUBLISH_SSH_KEY'):raise ValueError('host pin/key')
 with tempfile.TemporaryDirectory(prefix='front-enqueue-',dir=env['RUNNER_TEMP']) as folder:
  root=Path(folder);key=root/'key';hosts=root/'hosts';key.write_text(env['NAS_PUBLISH_SSH_KEY']+'\n');key.chmod(0o600);kind,value=next(iter(keys));base64.b64decode(value,validate=True);hosts.write_text('100.88.40.125 '+kind+' '+value+'\n');hosts.chmod(0o600)
  result=subprocess.run(['/usr/bin/ssh','-F','/dev/null','-i',str(key),'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(hosts),'-o','ConnectTimeout=10','-o','ServerAliveInterval=5','-o','ServerAliveCountMax=2','-T','iwh@100.88.40.125',f'iot-web-publish enqueue {run} {attempt} {sha}'],input=raw,capture_output=True,timeout=55,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
  if result.returncode or len(result.stdout)>65536:raise RuntimeError('NAS enqueue failed')
  response=json.loads(result.stdout)
  if response.get('ok') is not True or response.get('accepted') is not True or response.get('deployment_confirmed') is not False or not re.fullmatch('[a-f0-9]{32}',response.get('request_id','')):raise ValueError('enqueue receipt')
  print(json.dumps({'accepted':True,'request_id':response['request_id'],'deployment_confirmed':False,'note':'접수 완료. 실제 운영 결과는 NAS 릴리스 상태에서 별도 확인.'},ensure_ascii=False))
if __name__=='__main__':
 try:main()
 except Exception as error:print(type(error).__name__,file=sys.stderr);sys.exit(1)
