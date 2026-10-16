import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';

// Strict allowlist: the model cannot choose an arbitrary executable or filesystem path.
export const TOOL_REGISTRY=Object.freeze({
 'artifact.write_text':{description:'Write a UTF-8 text artifact inside the dedicated local output directory',approvalRequired:true},
 'artifact.read_text':{description:'Read a text artifact previously produced inside the dedicated output directory',approvalRequired:false}
});
const safeName=name=>typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}\.txt$/.test(name)&&!name.includes('..');
export async function invokeTool({name,args,approved=false,outputDir=process.env.CLAWOS_ARTIFACT_DIR||'./data/artifacts'}){
 if(!Object.hasOwn(TOOL_REGISTRY,name))throw Error('Tool not allowlisted');
 if(!args||!safeName(args.filename))throw Error('Invalid artifact filename');
 const base=resolve(outputDir),file=resolve(base,args.filename);
 if(!file.startsWith(base+sep))throw Error('Path escape denied');
 if(name==='artifact.write_text'){
  if(!approved)throw Error('Explicit approval required');
  if(typeof args.content!=='string'||Buffer.byteLength(args.content)>65536)throw Error('Invalid content size');
  await mkdir(base,{recursive:true,mode:0o700});await writeFile(file,args.content,{flag:'wx',mode:0o600});
  return {tool:name,filename:args.filename,bytes:Buffer.byteLength(args.content),receipt:randomUUID()};
 }
 const content=await readFile(file,'utf8');return {tool:name,filename:args.filename,content};
}
