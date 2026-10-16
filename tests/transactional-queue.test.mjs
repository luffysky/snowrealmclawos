import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../infra/supabase/003_transactional_queue.sql',import.meta.url),'utf8');
test('transactional worker uses skip locked to prevent duplicate claims',()=>{
 assert.match(sql,/for update skip locked/i);
 assert.match(sql,/lease_token uuid/i);
 assert.match(sql,/lease_token=p_token/g);
});
test('worker functions are not executable by public client roles',()=>{
 for(const name of ['worker_claim_job','worker_finish_job','worker_heartbeat_job'])
  assert.match(sql,new RegExp(`revoke all on function public\\.${name}\\([^;]+ from public,anon,authenticated`,'i'));
});
test('workspace isolation and deduplication are explicit',()=>{
 assert.match(sql,/is_workspace_owner\(p_workspace\)/);
 assert.match(sql,/unique index if not exists agent_jobs_idempotency_unique/i);
 assert.match(sql,/enable row level security/i);
});
test('jobs support bounded retries and time-based leases',()=>{
 assert.match(sql,/max_attempts between 1 and 20/);
 assert.match(sql,/lease_until<=now\(\)/);
 assert.match(sql,/available_at<=now\(\)/);
});
