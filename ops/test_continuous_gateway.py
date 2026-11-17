"""root coordinator의 격리 다중 릴리스/원장/접수 경계. 네트워크·Docker 없음."""
import base64,io,json,os,tempfile,time,unittest,zipfile
from pathlib import Path
from unittest import mock
import continuous_gateway as gate
import continuous_release as engine
from test_continuous_release import tar_bytes
core=engine.core
class Crash(BaseException):pass

def profile():return {'schema':1,'profile':'production_candidate','nonce_tag':'f'*64,'required_names':list(gate.INPUT_NAMES),'all_required_present':True,'api_base_matches':True,'mock_disabled':True,'input_hmacs':{k:'a'*64 for k in gate.INPUT_NAMES},'verification_scope':'fixture'}
def zipper(value=None):
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:z.writestr('build-input-profile.json',json.dumps(value or profile()))
 return out.getvalue()
class Backend:
 def __init__(self):self.head=None;self.pending=False;self.calls=0
 def verify(self,request,raw):
  self.calls+=1
  if self.pending:raise gate.Pending('CI 대기')
  if request['sha']!=self.head:raise PermissionError('stale')
  return {'profile':gate.profile_zip(raw),'checked_at':time.monotonic(),'evidence':{'scope':'fixture','source':request['sha']}}
class CoordinatorTests(unittest.TestCase):
 def test_enqueue_rechecks_closed_window_inside_queue_lock(self):
  import contextlib
  @contextlib.contextmanager
  def close_window(layout,name):
   cfg=dict(self.config,allow_enqueue=False);gate.write_json(layout.config,cfg,layout,replace=True);yield
  with mock.patch.object(gate,'management_lock',close_window),self.assertRaises(PermissionError):self.submit('a',100)
  self.assertEqual(gate.queue_rows(self.layout),[])
  self.assertFalse((self.layout.store/'queue-payloads').exists())
 def test_exact_request_requires_closed_window_and_rejects_other_pending(self):
  self.submit('a',100);request={'run_id':100,'attempt':1,'sha':'a'*40}
  with self.assertRaises(PermissionError):self.tick(expected_request=request)
  self.submit('b',101);gate.write_json(self.layout.config,dict(self.config,allow_enqueue=False),self.layout,replace=True)
  with self.assertRaises(PermissionError):self.tick(expected_request=request)
  self.assertEqual(self.build_calls,0);self.assertEqual(self.exec_calls,0)
 def test_exact_request_promotes_only_approved_triple(self):
  self.submit('a',100);gate.write_json(self.layout.config,dict(self.config,allow_enqueue=False),self.layout,replace=True)
  with self.assertRaises(PermissionError):self.tick(expected_request={'run_id':100,'attempt':2,'sha':'a'*40})
  result=self.tick(expected_request={'run_id':100,'attempt':1,'sha':'a'*40})
  self.assertTrue(result['ok']);self.assertEqual(self.exec_calls,1)

 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.mask=os.umask(0o022);self.addCleanup(os.umask,self.mask)
  self.layout=engine.Layout.fixture(self.root,trust_uid=os.getuid(),live_uid=os.getuid());l=self.layout
  for p in [l.base,l.store,l.live]:p.mkdir(parents=True,exist_ok=True)
  l.lock.touch(mode=0o600);core.write_new(l.live,'index.html',b'initial');core.write_new(l.live,'assets/initial.js',b'initial')
  self.config={'schema':1,'auto_enabled':True,'allow_enqueue':True,'production':False,'repo':engine.adapter.REPO,'target':str(l.live),'scope':'rehearsal'}
  gate.write_json(l.config,self.config,l);gate.write_json(l.current,{'schema':1,'release_id':None,'source_revision':'0'*40,'live_sha':core.tree_sha(l.live),'proof_release':None},l)
  self.backend=Backend();self.exec_calls=0;self.build_calls=0;self.profile_zip=zipper()
 def submit(self,letter,number):
  request={'run_id':number,'attempt':1,'sha':letter*40};self.backend.head=request['sha'];return gate.enqueue(self.layout,request,self.profile_zip)
 def build(self,request,work,p):
  self.build_calls+=1;work.mkdir(mode=0o750);letter=request['sha'][0]
  files={'index.html':letter.encode(),'assets/'+letter+'.js':('asset-'+letter).encode(),'version.json':b'{"phase":"prepared_only","deployed_at":null}','manifest.webmanifest':b'{}','sw-v3.js':b'sw','firebase-messaging-sw.js':b'fcm'};raw=tar_bytes(files);receipt=json.dumps({'phase':'prepared_only','target_root':core.TARGET,'revision':request['sha'],'run_id':str(request['run_id']),'archive_sha256':core.digest(raw),'production_changed':False,'deployment_enabled':False,'files':{k:core.digest(v) for k,v in files.items()},'candidate_kind':'production_candidate_unpublished','build_input_profile':p}).encode();digest=core.digest(json.dumps(p,sort_keys=True).encode());provenance={'schema':1,'archive_sha256':core.digest(raw),'source_revision':request['sha'],'build_mode':'private-local-build','input_profile_digest':digest}
  for n,data in [('candidate.tar',raw),('receipt.json',receipt),('provenance.json',json.dumps(provenance).encode())]:gate.write_bytes(work/n,data,self.layout)
  return {'archive_path':str(work/'candidate.tar'),'receipt_path':str(work/'receipt.json'),'provenance_path':str(work/'provenance.json'),'profile_sha256':digest}
 def execute(self,rid,action):
  self.exec_calls+=1;return (engine.execute_release if action=='execute' else engine.recover_release)(self.layout,rid)
 def tick(self,**kwargs):return gate.process_one(self.layout,backend=self.backend,builder=self.build,executor=self.execute,**kwargs)
 def test_a_b_c_and_release_evidence_preserved(self):
  ids=[]
  for n,letter in enumerate('abc',100):
   self.submit(letter,n);result=self.tick();self.assertTrue(result['ok'],result);ids.append(result['release_id']);self.assertEqual((self.layout.live/'index.html').read_bytes(),letter.encode())
  self.assertEqual(len(set(ids)),3)
  for rid in ids:
   for name in ['plan.json','parent-current.json','verified-ci.json','inbox/backup.tar']:self.assertTrue((self.layout.store/'releases'/rid/name).is_file())
  self.assertEqual(gate.status(self.layout)['pending'],0)
 def test_failed_c_restores_b_enriched_then_d(self):
  for n,letter in enumerate('ab',100):self.submit(letter,n);self.assertTrue(self.tick()['ok'])
  self.submit('c',102);gate.write_json(self.root/'verification.json',{'schema':1,'mode':'fail_candidate'},self.layout);result=self.tick();self.assertEqual(result['state'],'rolled_back');self.assertEqual((self.layout.live/'index.html').read_bytes(),b'b');self.assertTrue((self.layout.live/'assets/c.js').exists());self.assertEqual(gate.status(self.layout)['current']['live_sha'],core.tree_sha(self.layout.live))
  gate.write_json(self.root/'verification.json',{'schema':1,'mode':'pass'},self.layout,replace=True);self.submit('d',103);self.assertTrue(self.tick()['ok'])
 def test_duplicate_has_one_build_and_one_promotion(self):
  first=self.submit('a',100);self.assertTrue(self.tick()['ok']);again=self.submit('a',100);self.assertTrue(again['duplicate']);self.assertEqual(first['request_id'],again['request_id']);self.assertEqual(self.tick()['state'],'idle');self.assertEqual(self.build_calls,1)
 def test_maintenance_wait_does_not_build_then_resumes(self):
  self.submit('a',100);self.layout.markers[0].touch();self.assertEqual(self.tick()['state'],'waiting');self.assertEqual(self.build_calls,0);self.layout.markers[0].unlink();self.assertTrue(self.tick()['ok'])
 def test_pending_ci_then_success(self):
  self.submit('a',100);self.backend.pending=True;self.assertEqual(self.tick()['state'],'waiting');self.assertEqual(self.exec_calls,0);self.backend.pending=False;self.assertTrue(self.tick()['ok'])
 def test_old_request_rejected_before_build(self):
  self.submit('a',100);self.backend.head='b'*40;self.assertEqual(self.tick()['state'],'rejected');self.assertEqual(self.build_calls,0)
 def test_disabled_enqueue_and_tick_write_no_live(self):
  old=core.tree_sha(self.layout.live);self.config.update(auto_enabled=False,allow_enqueue=False);gate.write_json(self.layout.config,self.config,self.layout,replace=True)
  with self.assertRaises(PermissionError):self.submit('a',100)
  self.assertEqual(self.tick()['state'],'disabled');self.assertEqual(core.tree_sha(self.layout.live),old)
 def test_interrupted_payload_same_request_recovers_without_overwrite(self):
  request={'run_id':100,'attempt':1,'sha':'a'*40};qid=core.digest(json.dumps(request,sort_keys=True).encode())[:32];gate.managed_dir(self.layout.store/'queue-payloads',self.layout);raw=zipper();gate.write_bytes(self.layout.store/'queue-payloads'/(qid+'.zip'),raw,self.layout,mode=0o600)
  self.assertEqual(gate.enqueue(self.layout,request,raw)['request_id'],qid)
 def test_temp_queue_evidence_ignored_but_preserved(self):
  gate.managed_dir(self.layout.base/'queue',self.layout);p=self.layout.base/'queue'/('.next-'+'a'*32);gate.write_bytes(p,b'{}',self.layout);self.assertEqual(gate.status(self.layout)['pending'],0);self.assertTrue(p.exists())
 def test_unhealthy_rollback_disables_both_gates(self):
  self.submit('a',100);self.assertTrue(self.tick()['ok']);self.submit('b',101);gate.write_json(self.root/'verification.json',{'schema':1,'mode':'fail'},self.layout);self.assertEqual(self.tick()['state'],'unhealthy_rollback');self.assertFalse(gate.status(self.layout)['auto_enabled']);self.assertEqual((self.layout.live/'index.html').read_bytes(),b'a')
 def test_crash_after_executor_recovers_before_new_head(self):
  self.submit('a',100);self.assertTrue(self.tick()['ok']);self.submit('b',101)
  def crash(point,rid):
   if point=='after_executor':raise Crash()
  with self.assertRaises(Crash):self.tick(fault=crash)
  self.submit('c',102);self.assertEqual(self.tick()['outcome'],'rolled_back');self.assertEqual((self.layout.live/'index.html').read_bytes(),b'a');self.assertTrue(self.tick()['ok']);self.assertEqual((self.layout.live/'index.html').read_bytes(),b'c')
 def test_receipt_pointer_intent_crash_reconciles_without_reexecution(self):
  for point in ['after_receipt','after_current','before_intent_close']:
   with self.subTest(point=point):
    self.submit('a',100+len(gate.queue_rows(self.layout)))
    def crash(when,rid):
     if when==point:raise Crash()
    with self.assertRaises(Crash):self.tick(fault=crash)
    calls=self.exec_calls;self.assertEqual(self.tick()['outcome'],'healthy');self.assertEqual(self.exec_calls,calls);self.assertEqual(gate.status(self.layout)['pending'],0)
 def test_build_crash_closed_interrupted_not_hidden(self):
  self.submit('a',100)
  def broken(request,work,profile):raise Crash()
  with self.assertRaises(Crash):gate.process_one(self.layout,backend=self.backend,builder=broken,executor=self.execute)
  cleaned=[];self.assertEqual(self.tick(cleanup=cleaned.append)['state'],'idle');self.assertEqual(len(cleaned),1);self.assertEqual(gate.status(self.layout)['last_request']['state'],'interrupted')
 def test_zip_and_request_attacks(self):
  for raw in [b'x',zipper(dict(profile(),nonce='never')),b'0'*(gate.PROFILE_LIMIT+1)]:
   with self.assertRaises((ValueError,zipfile.BadZipFile)):gate.profile_zip(raw)
  with self.assertRaises(ValueError):gate.dispatch_request({'operation':'continuous-enqueue','run_id':True,'attempt':1,'sha':'a'*40,'profile_zip_b64':base64.b64encode(zipper()).decode()},self.layout)
  with self.assertRaises(ValueError):gate.dispatch_request({'operation':'continuous-enqueue','run_id':1,'attempt':1,'sha':'a'*40,'profile_zip_b64':'!!!!'},self.layout)
 def test_root_managed_dir_symlink_target_untouched(self):
  outside=self.root/'outside';outside.mkdir();before=outside.stat().st_mode;p=self.root/'linked';p.symlink_to(outside,target_is_directory=True)
  with self.assertRaises(OSError):gate.managed_dir(p,self.layout)
  self.assertEqual(outside.stat().st_mode,before)
if __name__=='__main__':unittest.main()

class OfficialEvidenceTests(unittest.TestCase):
 def setUp(self):
  self.raw=zipper();self.request={'run_id':123,'attempt':1,'sha':'a'*40};repo={'id':1243065308,'full_name':engine.adapter.REPO}
  self.run={'id':123,'run_attempt':1,'repository':repo,'head_repository':repo,'head_branch':'main','head_sha':'a'*40,'path':'.github/workflows/deploy.yml','status':'completed','conclusion':'success','event':'push'}
  self.jobs={'total_count':5,'jobs':[{'id':i+1,'name':n,'status':'completed','conclusion':'success'} for i,n in enumerate(sorted(engine.adapter.REQUIRED_JOBS|{'enqueue-release'}))]}
  self.artifact={'id':99,'name':'front-input-profile-123-1','expired':False,'digest':'sha256:'+core.digest(self.raw),'workflow_run':{'id':123,'repository_id':1243065308,'head_repository_id':1243065308,'head_branch':'main','head_sha':'a'*40}}
  self.calls=[]
 def get(self,suffix):
  self.calls.append(suffix)
  if suffix=='':return {'id':1243065308,'full_name':engine.adapter.REPO}
  if suffix=='/git/ref/heads/main':return {'object':{'sha':'a'*40}}
  if suffix.endswith('/artifacts?per_page=100'):return {'total_count':1,'artifacts':[self.artifact]}
  if suffix.endswith('/jobs?per_page=100'):return self.jobs
  return self.run
 def test_official_evidence_cached_but_head_rechecked(self):
  with mock.patch.object(engine.adapter,'github_get',side_effect=self.get):
   backend=gate.GitHub();first=backend.verify(self.request,self.raw);second=backend.verify(self.request,self.raw);third=backend.verify(self.request,self.raw)
  self.assertEqual(len(self.calls),7);self.assertEqual(first['evidence']['scope'],'github_api');self.assertIn('head_rechecked_at',second['evidence']);self.assertEqual(third['artifact_id'],99)
 def test_manual_stage_and_attempt_or_digest_mismatch_rejected(self):
  with mock.patch.object(engine.adapter,'github_get',side_effect=self.get):
   self.run['event']='workflow_dispatch'
   with self.assertRaises(PermissionError):gate.GitHub().verify(self.request,self.raw)
   self.run['event']='push';self.artifact['name']='front-input-profile-123-2'
   with self.assertRaises(PermissionError):gate.GitHub().verify(self.request,self.raw)
   self.artifact['name']='front-input-profile-123-1';self.artifact['digest']='sha256:'+'b'*64
   with self.assertRaises(PermissionError):gate.GitHub().verify(self.request,self.raw)
 def test_rate_limit_is_pending_not_rejected(self):
  import urllib.error
  error=urllib.error.HTTPError('https://api.github.com',403,'rate limited',{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':str(int(time.time())+100)},None)
  with mock.patch.object(engine.adapter,'github_get',side_effect=error):
   with self.assertRaises(gate.Pending) as caught:gate.GitHub().verify(self.request,self.raw)
  self.assertEqual(caught.exception.reason,'source_service');self.assertGreater(caught.exception.retry_after,90)
