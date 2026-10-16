import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {invokeTool} from '../services/api/tools.mjs';
test('tool requires approval and produces real artifact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'clawos-tools-'));
 const req={name:'artifact.write_text',args:{filename:'proposal.txt',content:'ClawOS proposal'},outputDir:dir};
 await assert.rejects(invokeTool(req),/approval/);
 const r=await invokeTool({...req,approved:true});assert.equal(r.bytes,15);
 assert.equal(await readFile(join(dir,'proposal.txt'),'utf8'),'ClawOS proposal');
 await assert.rejects(invokeTool({...req,approved:true}),/EEXIST/);
});
test('path traversal and unlisted tools rejected',async()=>{
 await assert.rejects(invokeTool({name:'artifact.write_text',args:{filename:'../secret.txt',content:'x'},approved:true}),/Invalid artifact filename/);
 await assert.rejects(invokeTool({name:'shell.exec',args:{filename:'ok.txt'},approved:true}),/not allowlisted/);
});
