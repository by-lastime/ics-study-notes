import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
execFileSync(process.execPath,[path.join(root,'site/scripts/build.mjs')],{stdio:'inherit'});
const licenses=path.join(root,'site/vendor/licenses');fs.mkdirSync(licenses,{recursive:true});
for(const name of ['marked','katex','highlight.js']){
 const packageRoot=path.dirname(require.resolve(name+'/package.json'));
 const license=['LICENSE','LICENSE.md','LICENSE.txt'].map(f=>path.join(packageRoot,f)).find(f=>fs.existsSync(f));
 if(!license)throw new Error('Missing license: '+name);
 fs.copyFileSync(license,path.join(licenses,name+'.txt'));
}
const source=fs.readFileSync(path.join(root,'site/content.js'),'utf8');
const ctx={window:{}};vm.runInNewContext(source,ctx);
const data=ctx.window.ICS_CONTENT||ctx.window.VCI_CONTENT;
if(!data?.publicRelease || !data.docs?.length)throw new Error('Missing public reader payload');
if(Object.keys(data.sourceMap).length)throw new Error('Public readers must not contain local source maps');
if(data.docs.some(d=>path.isAbsolute(d.sourcePath)||d.id==='progress'))throw new Error('Private source path or learning record in release');
if(/\/Users\/|file:\/\/|为石一|对象：石一/.test(source))throw new Error('Local path or identity in release');
const diagnostics=JSON.parse(fs.readFileSync(path.join(root,'site/build-diagnostics.json')));
if(diagnostics.mathErrors.length)throw new Error('Invalid formulas');
console.log('Public release verified: '+data.docs.length+' documents, no local source paths, no formula errors.');
