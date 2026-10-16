import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../infra/supabase/002_tenant_foundation.sql',import.meta.url),'utf8');
test('tenant tables enable row level security',()=>{
 for(const table of ['workspace_members','chat_messages','task_events','approval_requests','extension_installations','audit_events']){
  assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));
 }
 assert.match(sql,/enable row level security/);
 assert.match(sql,/to authenticated using \(public\.is_workspace_owner\(workspace_id\)\)/);
});
test('extension installations default to disabled and scoped to workspace',()=>{
 assert.match(sql,/unique\(workspace_id,extension_id\)/);
 assert.match(sql,/enabled boolean not null default false/);
});
test('no broad anonymous table grants',()=>{
 assert.doesNotMatch(sql,/grant\s+(all|select|insert|update|delete)\s+on\s+.*\s+to\s+anon/i);
});
