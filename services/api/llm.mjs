// Optional OpenAI-compatible chat adapter. No arbitrary tool execution.
export async function chatCompletion(messages, config=process.env, fetchImpl=fetch){
 const key=config.CLAWOS_LLM_API_KEY;
 if(!key)return {text:'目前尚未設定 AI API 金鑰。任務與組合包功能可在本機測試。',provider:'demo'};
 const endpoint=config.CLAWOS_LLM_ENDPOINT||'https://api.openai.com/v1/chat/completions';
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password)throw Error('LLM endpoint must use HTTPS');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetchImpl(url,{method:'POST',signal:controller.signal,headers:{'authorization':`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model:config.CLAWOS_LLM_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:'You are ClawOS, a helpful assistant. You cannot execute external actions. Clearly distinguish plans from completed work.'},...messages.slice(-12).map(m=>({role:m.role,content:m.text.slice(0,2000)}))],max_tokens:600})});
  if(!response.ok)throw Error(`LLM request failed (HTTP ${response.status})`);
  const result=await response.json();const text=result?.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw Error('LLM returned no text');
  return {text:text.slice(0,8000),provider:'api'};
 }finally{clearTimeout(timeout)}
}
