import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProposal,proposeTool} from '../services/api/planner.mjs';
const valid={name:'artifact.write_text',args:{filename:'plan.txt',content:'A real plan'}};
test('model proposal allowlist',()=>{
 assert.deepEqual(validateProposal(valid),valid);
 assert.throws(()=>validateProposal({...valid,name:'shell.exec'}),/forbidden/);
 assert.throws(()=>validateProposal({name:valid.name,args:{filename:'../bad.txt',content:'x'}}),/filename/);
 assert.throws(()=>validateProposal({name:valid.name,args:{filename:'ok.txt',content:'x'.repeat(65537)}}),/content/);
});
test('model output only proposes and never invokes tools',async()=>{
 let called=0;
 const fake=async()=>{called++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(valid)}}]})}};
 const result=await proposeTool('Write a proposal',{CLAWOS_LLM_API_KEY:'test'},fake);
 assert.deepEqual(result,valid);assert.equal(called,1);
});
test('reject malformed AI responses',async()=>{
 const fake=async()=>({ok:true,json:async()=>({choices:[{message:{content:'not json'}}]})});
 await assert.rejects(proposeTool('Write a proposal',{CLAWOS_LLM_API_KEY:'test'},fake),/JSON/);
});
