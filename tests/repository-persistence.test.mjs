import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresRepository} from '../services/api/postgres-repository.mjs';
const ws='workspace-a',owner='user-a';
test('chat insertion uses one owner-scoped statement',async()=>{
 const calls=[];const db=new PostgresRepository({query:async(sql,args)=>{calls.push({sql,args});return {rows:[{id:'m1'}]}}});
 assert.equal((await db.addChatMessage(ws,owner,'user','hello')).id,'m1');
 assert.match(calls[0].sql,/w.owner_id=\$2/);assert.deepEqual(calls[0].args,[ws,owner,'user','hello']);
});
test('chat read cannot omit owner condition',async()=>{
 let sql='';const db=new PostgresRepository({query:async(q)=>{sql=q;return {rows:[]}}});
 await db.listChatMessages(ws,owner);assert.match(sql,/w.owner_id=\$2/);
});
test('atomic compare and swap rejects stale transitions',async()=>{
 const calls=[];const db=new PostgresRepository({query:async(sql,args)=>{calls.push({sql,args});return {rows:[]}}});
 await assert.rejects(()=>db.transitionTask(ws,owner,'task1','queued','running'),/stale state/);
 assert.match(calls[0].sql,/t.status=\$4/);assert.equal(calls[0].args[4],'running');
 await assert.rejects(()=>db.transitionTask(ws,owner,'task1','completed','running'),/Invalid task transition/);
 assert.equal(calls.length,1);
});
test('invalid chat role and content blocked',async()=>{
 const db=new PostgresRepository({query:async()=>{throw Error('query should not run')}});
 await assert.rejects(()=>db.addChatMessage(ws,owner,'system','x'),/Invalid chat role/);
 await assert.rejects(()=>db.addChatMessage(ws,owner,'user',''),/Invalid chat content/);
});
test('SQL integrity migration has composite workspace references',async()=>{
 const {readFile}=await import('node:fs/promises');
 const sql=await readFile(new URL('../infra/supabase/004_task_workspace_integrity.sql',import.meta.url),'utf8');
 assert.equal((sql.match(/foreign key\(task_id,workspace_id\)/g)||[]).length,2);
 assert.match(sql,/revoke insert,update,delete on public.approval_requests/);
});
