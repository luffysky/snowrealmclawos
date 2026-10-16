import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true,force:true});
console.log('ClawOS Web preview built into dist/');
