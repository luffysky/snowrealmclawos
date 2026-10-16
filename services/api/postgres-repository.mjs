// PostgreSQL repository: actual parameterized queries, not a schema-only stub.
// Caller MUST supply an authenticated, authorized workspace ID. Do not expose directly to untrusted clients.
export class PostgresRepository {
  constructor(pool) { if (!pool?.query) throw new Error('PostgreSQL pool required'); this.pool=pool; }
  async health() { const {rows}=await this.pool.query('select 1 as ok'); return rows[0]?.ok===1; }
  async listWorkspaces(ownerId) {
    const {rows}=await this.pool.query('select id,name from public.workspaces where owner_id=$1 order by name',[ownerId]); return rows;
  }
  async createWorkspace(ownerId,name) {
    if(!/^[\s\S]{1,100}$/.test(name||'')) throw new Error('Invalid workspace name');
    const {rows}=await this.pool.query('insert into public.workspaces(owner_id,name) values ($1,$2) returning id,name',[ownerId,name]);return rows[0];
  }
  async requireOwner(workspaceId,ownerId) {
    const {rowCount}=await this.pool.query('select 1 from public.workspaces where id=$1 and owner_id=$2',[workspaceId,ownerId]);
    if(rowCount!==1)throw new Error('Workspace access denied');
  }
  async listTasks(workspaceId,ownerId){
    await this.requireOwner(workspaceId,ownerId);
    const {rows}=await this.pool.query('select id,title,status,created_at from public.tasks where workspace_id=$1 order by created_at desc limit 100',[workspaceId]);return rows;
  }
  async createTask(workspaceId,ownerId,title){
    if(typeof title!=='string'||title.trim().length<3||title.length>1000)throw new Error('Invalid task title');
    // Authorization and write are in one statement to avoid a check/use race.
    const {rows}=await this.pool.query(`insert into public.tasks(workspace_id,title,status)
      select id,$3,'queued' from public.workspaces where id=$1 and owner_id=$2
      returning id,title,status,created_at`,[workspaceId,ownerId,title.trim()]);
    if(!rows.length)throw new Error('Workspace access denied');return rows[0];
  }
  async enqueueJob(workspaceId,ownerId,title,key=null){
    if(typeof title!=='string'||title.trim().length<3||title.length>1000)throw new Error('Invalid job title');
    if(key!==null&&(typeof key!=='string'||key.length>128||!key.length))throw new Error('Invalid idempotency key');
    // DB function checks auth.uid(), so this method is for user-scoped DB connections only.
    await this.requireOwner(workspaceId,ownerId);
    const {rows}=await this.pool.query('select * from public.enqueue_agent_job($1,$2,$3::jsonb,$4)',[workspaceId,'plan.create',JSON.stringify({title:title.trim()}),key]);
    return rows[0];
  }
}
export async function openPostgresRepository(config={}){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL not configured');
  const {default:pg}=await import('pg');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:config.max||5,connectionTimeoutMillis:5000,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true}});
  return {repository:new PostgresRepository(pool),close:()=>pool.end()};
}

// Owner-scoped, atomic persistence operations for the future authenticated API.
// These methods must only receive ownerId from verified server-side identity.
PostgresRepository.prototype.addChatMessage = async function(workspaceId,ownerId,role,content){
  if(!['user','assistant'].includes(role))throw new Error('Invalid chat role');
  if(typeof content!=='string'||!content.trim()||content.length>20000)throw new Error('Invalid chat content');
  const {rows}=await this.pool.query(`insert into public.chat_messages(workspace_id,author_id,role,content)
    select w.id,$2,$3,$4 from public.workspaces w where w.id=$1 and w.owner_id=$2
    returning id,role,content,created_at`,[workspaceId,ownerId,role,content.trim()]);
  if(!rows.length)throw new Error('Workspace access denied');return rows[0];
};
PostgresRepository.prototype.listChatMessages = async function(workspaceId,ownerId){
  const {rows}=await this.pool.query(`select m.id,m.role,m.content,m.created_at
    from public.chat_messages m join public.workspaces w on w.id=m.workspace_id
    where m.workspace_id=$1 and w.owner_id=$2 order by m.created_at desc limit 100`,[workspaceId,ownerId]);
  return rows.reverse();
};
PostgresRepository.prototype.transitionTask = async function(workspaceId,ownerId,taskId,fromStatus,toStatus){
  const edges={queued:['running','cancelled','waiting_approval'],running:['completed','failed','waiting_approval'],waiting_approval:['running','cancelled'],failed:['queued','cancelled']};
  if(!edges[fromStatus]?.includes(toStatus))throw new Error('Invalid task transition');
  const {rows}=await this.pool.query(`update public.tasks t set status=$5
    from public.workspaces w where t.workspace_id=w.id and w.id=$1 and w.owner_id=$2
    and t.id=$3 and t.status=$4 returning t.id,t.status`,[workspaceId,ownerId,taskId,fromStatus,toStatus]);
  if(!rows.length)throw new Error('Task not found, access denied or stale state');return rows[0];
};
