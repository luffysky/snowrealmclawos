import {createStore} from './store.mjs';
import {createJobQueue} from './job-queue.mjs';
import {execute} from './executor.mjs';
// One-shot local worker. Never run concurrently with API server against same JSON file.
const store=createStore();await store.load();const q=createJobQueue(store);
const job=q.claim('local-worker');
if(!job){console.log('No jobs queued');process.exit(0)}
await store.save();
try{
 if(job.type!=='plan.create')throw Error('Unsupported job type');
 const result=execute({title:job.payload.title});
 q.complete(job.id,'local-worker',result);await store.save();console.log('Completed',job.id);
}catch(e){q.fail(job.id,'local-worker',e.message);await store.save();console.error('Job failed',job.id,e.message);process.exitCode=1}
