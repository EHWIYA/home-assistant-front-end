"""단발 검증의 exact 요청과 종료 복구. 네트워크/서비스 실행 없는 격리 검증."""
import json,time,unittest,threading
from unittest import mock
import oneoff_verify as one
import test_continuous_gateway as fixtures
Crash=fixtures.Crash
from continuous_release import core

class OneoffTests(unittest.TestCase):
 def setUp(self):
  self.f=fixtures.CoordinatorTests('test_a_b_c_and_release_evidence_preserved');self.f.setUp();self.addCleanup(self.f.doCleanups)
  self.l=self.f.layout;one.flags(self.l,False,False);self.calls=[]
 def enqueue(self,letter='a',run=100):
  return self.f.submit(letter,run)
 def queued_submit(self,letter='a',run=100):
  value=one.load(self.l);self.enqueue(letter,run);request={'run_id':run,'attempt':1,'sha':letter*40};one.submit(self.l,request);return request
 def role(self,layout,rid,action):
  value=one.load(layout);p=layout.runtime(rid)/'result.json';value.update(release_id=rid,last_execution={'release_id':rid,'action':action,'intent_sha256':core.digest(one.g.raw_read(layout.intent_path(rid),layout)),'before':one._identity(p)});one.save(layout,value)
  self.calls.append(action);result=self.f.execute(rid,action);result.update(action=action,intent_sha256=core.digest(one.g.raw_read(layout.intent_path(rid),layout)))
  p.write_text(json.dumps(result));p.chmod(0o600);return result
 def processor(self,fault=None):
  return lambda layout,**kw:one.g.process_one(layout,backend=self.f.backend,builder=self.f.build,executor=kw['executor'],fault=fault,expected_request=kw['expected_request'])
 def run_watch(self,fault=None):
  one.arm(self.l,'a'*40)
  def ready(_):self.queued_submit()
  with mock.patch.object(one,'execute',side_effect=self.role):
   return one.watch(self.l,processor=self.processor(fault),sleeper=ready)
 def assert_closed(self):
  cfg,_=one.engine.read_config(self.l,require_enabled=False);self.assertFalse(cfg['auto_enabled']);self.assertFalse(cfg['allow_enqueue']);self.assertIn(one.load(self.l)['phase'],{'closed','closed_error'})
 def test_normal_exact_request_runs_once_and_closes(self):
  result=self.run_watch();self.assertTrue(result['deployment_confirmed']);self.assertEqual(self.calls,['execute']);self.assertEqual((self.l.live/'index.html').read_bytes(),b'a');self.assert_closed()
 def test_arm_and_intake_never_open_auto_gate(self):
  one.arm(self.l,'a'*40)
  def stop(_):
   cfg,_=one.engine.read_config(self.l,require_enabled=False);self.assertFalse(cfg['auto_enabled']);self.assertTrue(cfg['allow_enqueue']);raise one.StopRequested()
  with self.assertRaises(one.StopRequested):one.watch(self.l,sleeper=stop)
  self.assertEqual((self.l.live/'index.html').read_bytes(),b'initial');self.assert_closed()
 def test_different_source_submit_and_other_pending_refused(self):
  one.arm(self.l,'a'*40);value=one.load(self.l);value['phase']='waiting_ci';one.save(self.l,value);one.flags(self.l,False,True);self.enqueue('b',101)
  with self.assertRaises(PermissionError):one.submit(self.l,{'run_id':101,'attempt':1,'sha':'b'*40})
  self.enqueue('a',100)
  with self.assertRaises(PermissionError):one.submit(self.l,{'run_id':100,'attempt':1,'sha':'a'*40})
  one.cleanup(self.l);self.assert_closed();self.assertEqual(self.f.exec_calls,0)
 def test_finished_role_result_is_committed_without_rollback(self):
  def crash(point,rid):
   if point=='after_executor':raise Crash()
  with self.assertRaises(Crash):self.run_watch(crash)
  self.assertEqual(self.calls,['execute']);self.assertEqual((self.l.live/'index.html').read_bytes(),b'a');self.assertEqual(one.g.status(self.l)['last_request']['state'],'healthy');self.assert_closed()
 def test_interrupted_role_recovers_and_pointer_uses_enriched_hash(self):
  one.arm(self.l,'a'*40)
  def ready(_):self.queued_submit()
  def fail_role(layout,rid,action):
   if action=='recover':return self.role(layout,rid,action)
   self.calls.append(action)
   def crash(stage):
    if stage=='after_exchange':raise Crash()
   return one.engine.execute_release(layout,rid,fault=crash)
  with mock.patch.object(one,'execute',side_effect=fail_role),self.assertRaises(Crash):one.watch(self.l,processor=self.processor(),sleeper=ready)
  current,_=one.engine.read_pointer(self.l);self.assertEqual((self.l.live/'index.html').read_bytes(),b'initial');self.assertEqual(current['live_sha'],one.g.live_sha(self.l));self.assertIsNone(current['release_id']);self.assertIsNotNone(current['proof_release']);self.assertEqual(self.calls,['execute','recover']);self.assert_closed()
 def test_cleanup_waits_for_role_before_config_fingerprint_changes(self):
  one.arm(self.l,'a'*40)
  def ready(_):self.queued_submit()
  def stop(point,rid):
   if point=='before_executor':raise Crash()
  def waiter(layout,rid):self.assertTrue(one.engine.read_config(layout,require_enabled=False)[0]['auto_enabled'])
  with mock.patch.object(one,'execute',side_effect=self.role),mock.patch.object(one,'wait_roles',side_effect=waiter),self.assertRaises(Crash):one.watch(self.l,processor=self.processor(stop),sleeper=ready)
  self.assertEqual((self.l.live/'index.html').read_bytes(),b'initial');self.assert_closed()
 def test_cleanup_idempotent_after_healthy(self):
  self.run_watch();before=one.g.live_sha(self.l);one.cleanup(self.l);self.assertEqual(before,one.g.live_sha(self.l));self.assertEqual(self.calls,['execute']);self.assert_closed()
 def test_expired_intake_closes_without_execution(self):
  one.arm(self.l,'a'*40)
  def expire(_):value=one.load(self.l);value['expires_ns']=time.time_ns()-1;one.save(self.l,value)
  with self.assertRaises(TimeoutError):one.watch(self.l,sleeper=expire)
  self.assertEqual(self.calls,[]);self.assert_closed()
 def test_busy_controller_cleanup_has_no_gate_or_ledger_changes(self):
  one.arm(self.l,'a'*40);one.flags(self.l,True,False)
  config=self.l.config.read_bytes();state=one.path(self.l).read_bytes();history=list((self.l.store/'oneoff-history').rglob('*.json'))
  with one.g.management_lock(self.l,'controller'),self.assertRaises(BlockingIOError):one.cleanup(self.l)
  self.assertEqual(config,self.l.config.read_bytes());self.assertEqual(state,one.path(self.l).read_bytes());self.assertEqual(history,list((self.l.store/'oneoff-history').rglob('*.json')))
  one.cleanup(self.l);self.assert_closed()
 def test_gate_close_waits_for_inflight_queue_lock(self):
  one.arm(self.l,'a'*40);one.flags(self.l,False,True);held=threading.Event()
  def inflight():
   with one.g.management_lock(self.l,'queue'):held.set();time.sleep(.1)
  worker=threading.Thread(target=inflight);worker.start();self.assertTrue(held.wait(1));start=time.monotonic();one.flags(self.l,False,False);worker.join(timeout=1)
  self.assertFalse(worker.is_alive());self.assertGreaterEqual(time.monotonic()-start,.075)
  self.assertFalse(one.engine.read_config(self.l,require_enabled=False)[0]['allow_enqueue'])
 def test_gate_queue_timeout_preserves_config(self):
  one.arm(self.l,'a'*40);one.flags(self.l,False,True);before=self.l.config.read_bytes()
  with one.g.management_lock(self.l,'queue'),mock.patch.object(one.time,'monotonic',side_effect=[0,4]),self.assertRaises(BlockingIOError):one.flags(self.l,False,False)
  self.assertEqual(before,self.l.config.read_bytes())
if __name__=='__main__':unittest.main()
