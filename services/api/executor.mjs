// Allowlisted local executor: does not evaluate generated code, open URLs or invoke external services.
export function execute(task){
 const title=task.title.trim();
 const steps=[`確認工作目標：${title}`, '整理驗收條件與必要輸入', '等待使用者選擇後續工具或 Agent'];
 return {kind:'plan',summary:`已為「${title}」建立可檢查的執行計畫。`,steps,externalActions:0};
}
export function validateExtension(m){
 if(!m||typeof m!=='object'||!/^[a-z0-9.-]{3,80}$/.test(m.id||'')||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(m.version||'')||!['skill','bundle','plugin'].includes(m.kind)||!Array.isArray(m.permissions)||!m.permissions.every(p=>typeof p==='string'))throw Error('Invalid manifest');
 if(m.kind==='bundle'&&(!Array.isArray(m.items)||!m.items.every(x=>typeof x==='string')))throw Error('Bundle requires string item ids');
 return {id:m.id,version:m.version,kind:m.kind,permissions:[...new Set(m.permissions)],...(m.kind==='bundle'?{items:[...new Set(m.items)]}:{})};
}
export function checkBundle(m,installed){
 if(m.kind!=='bundle')return;
 if(m.items.includes(m.id))throw Error('Bundle cannot contain itself');
 const missing=m.items.filter(id=>!installed.some(x=>x.id===id));
 if(missing.length)throw Error('Missing bundle dependencies: '+missing.join(', '));
}
