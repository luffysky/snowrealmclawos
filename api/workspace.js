import pg from 'pg';
import {createRemoteJWKSet,jwtVerify} from 'jose';
let pool,jwks,jwksUrl;
const send=(res,status,data)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(data)};
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
async function identity(req){
 const url=process.env.CLAWOS_AUTH_JWKS_URL,issuer=process.env.CLAWOS_AUTH_ISSUER;
 if(!url||!issuer)throw Error('auth_not_configured');
 const h=req.headers.authorization;
 if(typeof h!=='string'||!/^Bearer [^\s]+$/.test(h))throw Error('unauthorized');
 if(!jwks||jwksUrl!==url){if(new URL(url).protocol!=='https:')throw Error('auth_not_configured');jwks=createRemoteJWKSet(new URL(url),{timeoutDuration:5000});jwksUrl=url}
 try{
   const opts={issuer,algorithms:['EdDSA','ES256','RS256']};
   if(process.env.CLAWOS_AUTH_AUDIENCE)opts.audience=process.env.CLAWOS_AUTH_AUDIENCE;
   const {payload}=await jwtVerify(h.slice(7),jwks,opts);
   if(typeof payload.sub!=='string'||payload.sub.length<3||payload.sub.length>255)throw Error('bad_claim');
   return payload.sub;
 }catch{throw Error('unauthorized')}
}
function database(){
 if(!process.env.DATABASE_URL)throw Error('database_not_configured');
 return pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:15000,connectionTimeoutMillis:5000,ssl:{rejectUnauthorized:true}});
}
const parse=req=>{
 const data=typeof req.body==='string'?JSON.parse(req.body):req.body;
 if(!data||Array.isArray(data)||typeof data!=='object'||Buffer.byteLength(JSON.stringify(data))>20000)throw Error('invalid_body');
 return data;
};
export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(res,405,{error:'method_not_allowed'})}
 let owner;
 try{owner=await identity(req)}catch(e){return send(res,e.message==='auth_not_configured'?503:401,{error:e.message})}
 const type=req.query?.resource;
 if(!['workspaces','tasks','messages'].includes(type))return send(res,400,{error:'invalid_resource'});
 let input={};
 try{if(req.method==='POST')input=parse(req)}catch{return send(res,400,{error:'invalid_body'})}
 const wid=req.method==='GET'?req.query?.workspaceId:input.workspaceId;
 if(type!=='workspaces'&&!uuid(wid))return send(res,400,{error:'invalid_workspace'});
 let sql,params;
 if(type==='workspaces'&&req.method==='GET'){sql='select id,name,created_at from public.workspaces where owner_subject=$1 order by created_at desc limit 100';params=[owner]}
 else if(type==='workspaces'){
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100)return send(res,400,{error:'invalid_name'});
  sql='insert into public.workspaces(owner_subject,name) values($1,$2) returning id,name,created_at';params=[owner,input.name.trim()]
 }else if(type==='tasks'&&req.method==='GET'){
  sql='select t.id,t.title,t.status,t.created_at from public.tasks t join public.workspaces w on w.id=t.workspace_id where t.workspace_id=$1 and w.owner_subject=$2 order by t.created_at desc limit 100';params=[wid,owner]
 }else if(type==='tasks'){
  if(typeof input.title!=='string'||input.title.trim().length<3||input.title.length>1000)return send(res,400,{error:'invalid_title'});
  sql='insert into public.tasks(workspace_id,title) select id,$3 from public.workspaces where id=$1 and owner_subject=$2 returning id,title,status,created_at';params=[wid,owner,input.title.trim()]
 }else if(type==='messages'&&req.method==='GET'){
  sql='select m.id,m.role,m.content,m.created_at from public.chat_messages m join public.workspaces w on w.id=m.workspace_id where m.workspace_id=$1 and w.owner_subject=$2 order by m.created_at desc limit 100';params=[wid,owner]
 }else{
  if(typeof input.content!=='string'||!input.content.trim()||input.content.length>12000)return send(res,400,{error:'invalid_content'});
  sql="insert into public.chat_messages(workspace_id,author_subject,role,content) select id,$2,'user',$3 from public.workspaces where id=$1 and owner_subject=$2 returning id,role,content,created_at";params=[wid,owner,input.content.trim()]
 }
 try{
  const {rows}=await database().query(sql,params);
  if(req.method==='POST'&&rows.length===0)return send(res,404,{error:'workspace_not_found'});
  if(type==='messages'&&req.method==='GET')rows.reverse();
  return send(res,req.method==='POST'?201:200,{items:rows});
 }catch(e){console.error('clawos.cloud_data.error',{code:e?.code||'unknown'});return send(res,503,{error:'database_unavailable'})}
}
