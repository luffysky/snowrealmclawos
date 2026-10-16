import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../services/api/store.mjs';
import {execute,validateExtension,checkBundle} from '../services/api/executor.mjs';
test('local store survives reload',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'clawos-'));const file=join(dir,'state.json');
 const a=createStore(file);await a.load();a.get().tasks.push({id:'one'});a.audit('created');await a.save();
 const b=createStore(file);await b.load();assert.equal(b.get().tasks[0].id,'one');assert.equal(b.get().audit[0].action,'created');
});
test('executor produces real deterministic plan without external actions',()=>{
 const r=execute({title:'Build landing page'});assert.equal(r.kind,'plan');assert.equal(r.externalActions,0);assert.equal(r.steps.length,3);
});
test('bundle cannot install missing dependencies or itself',()=>{
 const m=validateExtension({id:'demo.bundle',version:'1.0.0',kind:'bundle',permissions:[],items:['demo.skill']});
 assert.throws(()=>checkBundle(m,[]),/Missing bundle dependencies/);
 assert.doesNotThrow(()=>checkBundle(m,[{id:'demo.skill'}]));
 assert.throws(()=>checkBundle({...m,items:['demo.bundle']},[]),/cannot contain itself/);
});
