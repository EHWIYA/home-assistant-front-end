import contextlib,hashlib,importlib.util,io,json,os,tempfile,unittest,urllib.request
from pathlib import Path
from unittest import mock
spec=importlib.util.spec_from_file_location('enqueue',Path(__file__).with_name('enqueue-front-release.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class EnqueueTests(unittest.TestCase):
 def setUp(self):
  self.env={'GITHUB_REPOSITORY':m.REPO,'GITHUB_REF':'refs/heads/main','GITHUB_SHA':'a'*40,'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'2','GH_TOKEN':'synthetic-read-token','NAS_PUBLISH_SSH_KEY':'synthetic-private-key','NAS_SSH_HOST_KEYS':'pin ssh-ed25519 YWJj'}
  self.raw=b'public-proof';self.item={'id':1,'name':'front-input-profile-123-2','expired':False,'digest':'sha256:'+hashlib.sha256(self.raw).hexdigest(),'workflow_run':{'id':123,'head_sha':'a'*40,'repository_id':1243065308,'head_repository_id':1243065308,'head_branch':'main'}}
 def test_main_only_identifiers_and_public_proof_no_credentials_in_child_env(self):
  with tempfile.TemporaryDirectory() as tmp,mock.patch.dict(os.environ,dict(self.env,RUNNER_TEMP=tmp),clear=True),mock.patch.object(m,'metadata',return_value={'total_count':1,'artifacts':[self.item]}),mock.patch.object(m,'download',return_value=self.raw),mock.patch.object(m.subprocess,'run') as run,contextlib.redirect_stdout(io.StringIO()) as out:
   run.return_value.returncode=0;run.return_value.stdout=json.dumps({'ok':True,'accepted':True,'request_id':'b'*32,'deployment_confirmed':False}).encode();m.main();args,kwargs=run.call_args
   self.assertEqual(kwargs['input'],self.raw);self.assertNotIn('GH_TOKEN',kwargs['env']);self.assertNotIn('NAS_PUBLISH_SSH_KEY',kwargs['env']);self.assertEqual(args[0][-1],'iot-web-publish enqueue 123 2 '+'a'*40);self.assertIn('deployment_confirmed',out.getvalue());self.assertNotIn(self.env['GH_TOKEN'],out.getvalue());self.assertNotIn(self.env['NAS_PUBLISH_SSH_KEY'],out.getvalue());self.assertEqual(list(Path(tmp).iterdir()),[])
 def test_wrong_ref_repo_context_rejected(self):
  for key,value in [('GITHUB_REF','refs/pull/1/merge'),('GITHUB_REPOSITORY','fork/repo'),('GITHUB_SHA','../bad'),('GITHUB_RUN_ATTEMPT','0')]:
   with self.assertRaises(PermissionError):m.context(dict(self.env,**{key:value}))
 def test_artifact_attempt_and_ambiguity_and_binding(self):
  self.assertEqual(m.select_artifact({'total_count':1,'artifacts':[self.item]},123,2,'a'*40)['id'],1)
  for obj in [{'total_count':2,'artifacts':[self.item,self.item]},{'total_count':1,'artifacts':[dict(self.item,name='front-input-profile-123-1')]},{'total_count':1,'artifacts':[dict(self.item,expired=True)]}]:
   with self.assertRaises((ValueError,PermissionError)):m.select_artifact(obj,123,2,'a'*40)
 def test_redirect_drops_authorization_and_rejects_arbitrary_hosts(self):
  req=urllib.request.Request('https://api.github.com',headers={'Authorization':'Bearer synthetic'})
  redirected=m.Redirect().redirect_request(req,None,302,'',{},'https://safe.blob.core.windows.net/a?sig=synthetic')
  self.assertFalse(redirected.has_header('Authorization'))
  for url in ['http://safe.blob.core.windows.net/a','https://evil.example/a']:
   with self.assertRaises(PermissionError):m.Redirect().redirect_request(req,None,302,'',{},url)
  with self.assertRaises(PermissionError):m.MetadataRedirect().redirect_request(req,None,302,'',{},'https://evil.example/')
 def test_workflow_stays_disabled_by_default_and_keeps_oidc_source(self):
  import yaml
  p=Path(__file__).parents[1]/'workflows/deploy.yml';value=yaml.load(p.read_text(),Loader=yaml.BaseLoader);jobs=value['jobs'];queue=jobs['enqueue-release'];self.assertIn("vars.FRONT_AUTO_PIPELINE_ENABLED == 'true'",queue['if']);self.assertEqual(queue['permissions']['actions'],'read');self.assertEqual(queue['permissions']['id-token'],'write');self.assertEqual(set(queue['needs']),{'oidc-connect','build-stage-artifact','verify-input-profile','stage-only'})
  text=p.read_text();self.assertIn('front-stage-${{ github.run_id }}-${{ github.run_attempt }}',text);self.assertIn('front-input-profile-${{ github.run_id }}-${{ github.run_attempt }}',text);self.assertIn('front-stage-receipt-${{ github.run_id }}-${{ github.run_attempt }}',text)
  source=Path(__file__).with_name('check-ci-oidc.py').read_text();self.assertIn("'workflow_ref': repo + '/.github/workflows/'",source)
 def test_manual_stage_and_readiness_never_enqueue_with_auto_flag_on(self):
  import re,yaml
  value=yaml.load((Path(__file__).parents[1]/'workflows/deploy.yml').read_text(),Loader=yaml.BaseLoader)
  def check(name,event,stage=False,verify=False,flag='true',needs=None):
   text=value['jobs'][name]['if'];values={'github.event_name':event,'github.ref':'refs/heads/main','vars.FRONT_AUTO_PIPELINE_ENABLED':flag,'inputs.stage_only':stage,'inputs.verify_build_inputs':verify}
   for key,item in values.items():text=text.replace(key,repr(item))
   text=re.sub(r"needs\['([^']+)'\]\.result",lambda m:repr((needs or {}).get(m[1],'success')),text);text=text.replace('&&',' and ').replace('||',' or ');text=re.sub(r'!(?!=)',' not ',text)
   return bool(eval(text,{'__builtins__':{}},{'always':lambda:True}))
  self.assertTrue(check('build-stage-artifact','workflow_dispatch',stage=True));self.assertFalse(check('verify-input-profile','workflow_dispatch',stage=True));self.assertTrue(check('stage-only','workflow_dispatch',stage=True,needs={'verify-input-profile':'skipped'}));self.assertFalse(check('enqueue-release','workflow_dispatch',stage=True))
  self.assertFalse(check('build-stage-artifact','workflow_dispatch'));self.assertFalse(check('enqueue-release','workflow_dispatch'));self.assertFalse(check('enqueue-release','push',flag=''));self.assertTrue(check('enqueue-release','push'))
if __name__=='__main__':unittest.main()
