import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresRepository} from '../services/api/postgres-repository.mjs';
const ws='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
test('repository uses parameterized SQL and owner-scoped insert',async()=>{
 const calls=[];const db=new PostgresRepository({query:async(sql,args)=>{calls.push({sql,args});return {rows:[{id:'task1',status:'queued'}],rowCount:1}}});
 const t=await db.createTask(ws,owner,"a'); drop table tasks;--");
 assert.equal(t.id,'task1');assert.match(calls[0].sql,/owner_id=\$2/);assert.equal(calls[0].args[2],"a'); drop table tasks;--");
 assert.ok(!calls[0].sql.includes('drop table'));
});
test('repository denies cross-owner access',async()=>{
 const db=new PostgresRepository({query:async()=>({rows:[],rowCount:0})});
 await assert.rejects(()=>db.listTasks(ws,owner),/access denied/);
});
test('repository validates input before querying',async()=>{
 const db=new PostgresRepository({query:async()=>{throw Error('must not query')}});
 await assert.rejects(()=>db.createTask(ws,owner,'x'),/Invalid task/);
 await assert.rejects(()=>db.createWorkspace(owner,''),/Invalid workspace/);
});
test('repository can query PostgreSQL health',async()=>{
 const db=new PostgresRepository({query:async()=>({rows:[{ok:1}]})});
 assert.equal(await db.health(),true);
});
