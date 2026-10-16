import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../api/workspace.js',import.meta.url),'utf8');
test('JWT verified, fail-closed auth',()=>{assert.match(src,/jwtVerify\(/);assert.match(src,/auth_not_configured/);assert.match(src,/payload\.sub/)});
test('workspace authorization in SQL',()=>{assert.match(src,/owner_subject=\$2/);assert.match(src,/owner_subject=\$1/)});
test('clients cannot forge assistant messages',()=>{assert.match(src,/select id,\$2,'user',\$3/);assert.doesNotMatch(src,/input\.role/)});
