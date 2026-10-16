import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
export function createStore(file=process.env.CLAWOS_DATA_FILE||'./data/local-demo.json'){
 let state={tasks:[],messages:[],extensions:[],audit:[]};
 let queue=Promise.resolve();
 return {
  async load(){try{const value=JSON.parse(await readFile(file,'utf8'));if(!['tasks','messages','extensions','audit'].every(k=>Array.isArray(value[k])))throw Error('Invalid state');state=value}catch(e){if(e.code!=='ENOENT')throw e}return state},
  get(){return state},
  async save(){const snapshot=JSON.stringify(state,null,2);queue=queue.then(async()=>{await mkdir(dirname(file),{recursive:true});const tmp=file+'.tmp';await writeFile(tmp,snapshot,{mode:0o600});await rename(tmp,file)});await queue},
  audit(action,details={}){state.audit.push({action,details,at:new Date().toISOString()});if(state.audit.length>1000)state.audit.shift()}
 };
}
