import test from 'node:test';
import assert from 'node:assert/strict';
import {chatCompletion} from '../services/api/llm.mjs';
test('missing key falls back to explicitly labeled demo',async()=>{
 const result=await chatCompletion([],{});assert.equal(result.provider,'demo');
});
test('LLM adapter sends bounded messages and returns text',async()=>{
 let payload;
 const result=await chatCompletion([{role:'user',text:'hello'}],{CLAWOS_LLM_API_KEY:'test',CLAWOS_LLM_MODEL:'test-model'},async(_url,opts)=>{payload=JSON.parse(opts.body);return {ok:true,json:async()=>({choices:[{message:{content:'reply'}}]})}});
 assert.equal(result.text,'reply');assert.equal(payload.messages[1].content,'hello');
});
test('LLM adapter rejects insecure endpoints',async()=>{
 await assert.rejects(chatCompletion([],{CLAWOS_LLM_API_KEY:'x',CLAWOS_LLM_ENDPOINT:'http://example.com'},async()=>{throw Error('Should not fetch')}),/HTTPS/);
});
