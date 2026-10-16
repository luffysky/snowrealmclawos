import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {createStore} from './store.mjs';
import {chatCompletion} from './llm.mjs';
import {execute,validateExtension,checkBundle} from './executor.mjs';
import {TOOL_REGISTRY,invokeTool} from './tools.mjs';
import {proposeTool} from './planner.mjs';
import {createJobQueue} from './job-queue.mjs';
const store=createStore();
const ready=store.load();
let jobs;
ready.then(()=>{jobs=createJobQueue(store)});
const token=process.env.CLAWOS_DEMO_TOKEN||'local-demo-token';
// Never expose this demo endpoint on a public interface.
const host='127.0.0.1';
const reply=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
const body=async req=>{let s='';for await(const c of req){s+=c;if(s.length>100000)throw Error('Request too large')}return JSON.parse(s||'{}')};
const authorized=req=>{const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+token);return a.length===b.length&&timingSafeEqual(a,b)};
const server=http.createServer(async(req,res)=>{
 await ready;const p=new URL(req.url,'http://localhost').pathname;
 if(p==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'"});return res.end(await readFile(new URL('../../apps/web/index.html',import.meta.url)))}
 if(p==='/assets/snowrealm-horizon.webp'){res.writeHead(200,{'content-type':'image/webp','cache-control':'public, max-age=86400'});return res.end(await readFile(new URL('../../apps/web/assets/snowrealm-horizon.webp',import.meta.url)))}
 if(p==='/health')return reply(res,200,{ok:true,mode:'local-demo',persistent:true,llmConfigured:Boolean(process.env.CLAWOS_LLM_API_KEY)});
 if(!p.startsWith('/api/'))return reply(res,404,{error:'Not found'});
 if(!authorized(req))return reply(res,401,{error:'Demo authorization required'});
 const {tasks,messages,extensions,audit}=store.get();
 try{
  if(p==='/api/jobs'&&req.method==='GET')return reply(res,200,jobs.list('local-demo-user'));
  if(p==='/api/jobs'&&req.method==='POST'){const b=await body(req);if(b.type!=='plan.create')throw Error('Unsupported job type');const j=jobs.enqueue({type:b.type,payload:{title:String(b.title||'').slice(0,1000)},idempotencyKey:b.idempotencyKey});await store.save();return reply(res,201,j)}
  if(p==='/api/tools'&&req.method==='GET')return reply(res,200,TOOL_REGISTRY);
  if(p==='/api/state'&&req.method==='GET')return reply(res,200,{tasks,messages,extensions,audit:audit.slice(-100)});
  if(p==='/api/chat'&&req.method==='POST'){
   const b=await body(req);if(typeof b.message!=='string'||!b.message.trim()||b.message.length>2000)throw Error('Invalid message');
   messages.push({id:randomUUID(),role:'user',text:b.message.trim()});
   let answer;try{answer=await chatCompletion(messages)}catch(e){answer={text:'AI 服務暫時不可用，請稍後重試。',provider:'error'};store.audit('llm.error',{message:e.message})}
   messages.push({id:randomUUID(),role:'assistant',text:answer.text,provider:answer.provider});
   store.audit('chat.message');await store.save();return reply(res,201,{messages});
  }
  if(p==='/api/tasks'&&req.method==='POST'){
   const b=await body(req);if(typeof b.title!=='string'||b.title.trim().length<3||b.title.length>1000)throw Error('Invalid title');
   const t={id:randomUUID(),title:b.title.trim(),status:'queued',approval:b.approval===true,events:[],result:null};tasks.unshift(t);store.audit('task.created',{id:t.id});await store.save();return reply(res,201,t);
  }
  const match=p.match(/^\/api\/tasks\/([\w-]+)\/(run|approve|cancel)$/);
  if(match&&req.method==='POST'){
   const t=tasks.find(x=>x.id===match[1]);if(!t)throw Error('Task not found');
   if(match[2]==='cancel'&&['queued','waiting_approval'].includes(t.status)){
    t.status='cancelled';t.events.push('使用者取消任務');
   }else if(match[2]==='run'&&t.status==='queued'){
    if(t.approval){t.status='waiting_approval';t.events.push('等待使用者批准產生執行計畫')}
    else{t.result=execute(t);t.status='completed';t.events.push('本機計畫產生完成，未執行外部操作')}
   }else if(match[2]==='approve'&&t.status==='waiting_approval'){
    if(t.toolRequest){
     try{t.result=await invokeTool({...t.toolRequest,approved:true});t.status='completed';t.events.push('已執行受控本機檔案工具')}
     catch(e){t.status='failed';t.events.push('工具失敗：'+e.message);t.result={error:e.message}}
    }else{t.result=execute(t);t.status='completed';t.events.push('人工批准後完成本機計畫，未執行外部操作');}
   }else throw Error('Invalid transition');
   store.audit('task.'+t.status,{id:t.id});await store.save();return reply(res,200,t);
  }
  if(p==='/api/agent/propose'&&req.method==='POST'){
   const b=await body(req);
   const proposal=await proposeTool(b.prompt);
   const t={id:randomUUID(),title:'AI proposal: '+proposal.args.filename,status:'waiting_approval',approval:true,toolRequest:proposal,events:['AI generated a tool proposal','Awaiting explicit human approval; no tool has run'],result:null};
   tasks.unshift(t);store.audit('agent.proposal.created',{id:t.id,name:proposal.name});await store.save();return reply(res,201,t);
  }
  if(p==='/api/tool-requests'&&req.method==='POST'){
   const b=await body(req);if(b.name!=='artifact.write_text')throw Error('Only write_text tool requests supported');
   if(typeof b.args?.filename!=='string'||typeof b.args?.content!=='string'||b.args.content.length>65536)throw Error('Invalid tool arguments');
   const t={id:randomUUID(),title:'Write artifact: '+b.args.filename,status:'waiting_approval',approval:true,toolRequest:{name:b.name,args:b.args},events:['等待人工批准工具操作'],result:null};
   tasks.unshift(t);store.audit('tool.requested',{id:t.id,name:b.name});await store.save();return reply(res,201,t);
  }
  if(p==='/api/extensions'&&req.method==='POST'){
   const m=validateExtension(await body(req));if(extensions.some(e=>e.id===m.id))throw Error('Already installed');checkBundle(m,extensions);
   const e={...m,enabled:false,installedAt:new Date().toISOString()};extensions.push(e);store.audit('extension.installed',{id:e.id});await store.save();return reply(res,201,e);
  }
  return reply(res,404,{error:'Unknown endpoint'});
 }catch(e){return reply(res,400,{error:e.message})}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT||3000),host,()=>console.log('ClawOS local prototype: http://localhost:3000'));
export {server,store};
