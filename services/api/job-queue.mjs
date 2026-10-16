import {randomUUID} from 'node:crypto';

// Single-process durable queue: state is persisted by caller via createStore.save().
// This is NOT a distributed queue and must not be shared by multiple API instances.
export function createJobQueue(store,{clock=()=>Date.now(),leaseMs=30_000,maxAttempts=3}={}){
 const state=store.get();state.jobs??=[];
 const stamp=()=>new Date(clock()).toISOString();
 function enqueue({type,payload={},owner='local-demo-user',idempotencyKey}={}){
  if(typeof type!=='string'||!/^[a-z][a-z0-9_.-]{1,63}$/.test(type))throw Error('Invalid job type');
  if(typeof owner!=='string'||!owner)throw Error('Invalid owner');
  if(idempotencyKey){const old=state.jobs.find(j=>j.owner===owner&&j.idempotencyKey===idempotencyKey);if(old)return old;}
  const job={id:randomUUID(),owner,type,payload,status:'queued',attempts:0,maxAttempts,idempotencyKey:idempotencyKey||null,leaseUntil:null,workerId:null,createdAt:stamp(),updatedAt:stamp(),result:null,error:null};
  state.jobs.push(job);store.audit('job.enqueued',{id:job.id,type});return job;
 }
 function claim(workerId){
  if(typeof workerId!=='string'||!workerId)throw Error('Worker id required');
  const now=clock();
  const j=state.jobs.find(x=>x.status==='queued'||(x.status==='running'&&Date.parse(x.leaseUntil)<=now));
  if(!j)return null;
  if(j.attempts>=j.maxAttempts){j.status='failed';j.error='Maximum attempts reached';j.updatedAt=stamp();return claim(workerId)}
  j.status='running';j.attempts++;j.workerId=workerId;j.leaseUntil=new Date(now+leaseMs).toISOString();j.updatedAt=stamp();store.audit('job.claimed',{id:j.id,workerId});return j;
 }
 function owned(id,workerId){const j=state.jobs.find(x=>x.id===id);if(!j||j.status!=='running'||j.workerId!==workerId||Date.parse(j.leaseUntil)<=clock())throw Error('Lease not owned or expired');return j}
 function heartbeat(id,workerId){const j=owned(id,workerId);j.leaseUntil=new Date(clock()+leaseMs).toISOString();j.updatedAt=stamp();return j}
 function complete(id,workerId,result){const j=owned(id,workerId);j.status='completed';j.result=result??null;j.leaseUntil=null;j.workerId=null;j.updatedAt=stamp();store.audit('job.completed',{id});return j}
 function fail(id,workerId,error){const j=owned(id,workerId);j.status=j.attempts>=j.maxAttempts?'failed':'queued';j.error=String(error).slice(0,500);j.leaseUntil=null;j.workerId=null;j.updatedAt=stamp();store.audit('job.failed',{id,status:j.status});return j}
 return {enqueue,claim,heartbeat,complete,fail,list:(owner)=>state.jobs.filter(j=>j.owner===owner)};
}
