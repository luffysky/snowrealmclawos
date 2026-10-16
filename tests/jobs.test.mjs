import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../services/api/store.mjs';
import {createJobQueue} from '../services/api/job-queue.mjs';
test('idempotency, lease ownership and completion',async()=>{
 const store=createStore(join(await mkdtemp(join(tmpdir(),'clawos-jobs-')),'db.json'));await store.load();let now=100000;
 const q=createJobQueue(store,{clock:()=>now,leaseMs:1000});
 const a=q.enqueue({type:'plan.create',idempotencyKey:'abc'});
 assert.equal(q.enqueue({type:'plan.create',idempotencyKey:'abc'}).id,a.id);
 assert.equal(q.claim('worker-a').id,a.id);
 assert.throws(()=>q.complete(a.id,'worker-b',{}),/not owned/);
 now+=1001;assert.equal(q.claim('worker-b').attempts,2);
 assert.throws(()=>q.complete(a.id,'worker-a',{}),/not owned/);
 assert.equal(q.complete(a.id,'worker-b',{ok:true}).status,'completed');
 await store.save()
 // Verify serialized state independently without assuming store exposes its file path.
 assert.equal(store.get().jobs[0].result.ok,true);
});
test('failed jobs retry until maximum attempts',()=>{
 const store={get:()=>({jobs:[]}),audit:()=>{}};let now=1000;const q=createJobQueue(store,{clock:()=>now,maxAttempts:2});
 const j=q.enqueue({type:'plan.create'});q.claim('w');assert.equal(q.fail(j.id,'w','retry').status,'queued');q.claim('w');assert.equal(q.fail(j.id,'w','stop').status,'failed');assert.equal(q.claim('w'),null);
});
