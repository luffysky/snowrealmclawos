import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000});
const expected=['workspaces','tasks','chat_messages','agent_jobs','approval_requests','extension_installations','audit_events','task_events','bundle_catalog','bundle_versions','bundle_installations','user_theme_preferences'];
try{
 await client.connect();
 const {rows}=await client.query("select table_name from information_schema.tables where table_schema='public' and table_name=any($1::text[]) order by table_name",[expected]);
 const found=new Set(rows.map(r=>r.table_name));const missing=expected.filter(x=>!found.has(x));
 console.log(JSON.stringify({ok:missing.length===0,found:rows.map(r=>r.table_name),missing},null,2));
 if(missing.length)process.exitCode=1;
}finally{await client.end().catch(()=>{});}
