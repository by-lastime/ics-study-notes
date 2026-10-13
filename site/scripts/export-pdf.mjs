import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workspace=path.dirname(root);
const out=path.join(root,'downloads');
const temp=process.env.ICS_PDF_TEMP||path.join(workspace,'.build/pdf');
const bundled=path.join(process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ICS_PLAYWRIGHT||'playwright');
execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{stdio:'inherit'});
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'content.js'),'utf8'),ctx);
const data=ctx.window.ICS_CONTENT;
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(temp,{recursive:true});
const byId=new Map(data.docs.map(d=>[d.id,d]));
const names={d1:'第1讲-整数与汇编入门.pdf',d2:'第2讲-浮点与条件分支.pdf',d3:'第3讲-循环与过程调用.pdf',d4:'第4讲-数据布局与内存安全.pdf',d5:'第5讲-完整测验与考前整理.pdf',d6:'第6讲-测后重点补强.pdf','command-reference':'ICS第一次小测-汇编命令三栏速查表.pdf'};
const onlyBank=process.argv.includes('--bank');
const onlyRepair=process.argv.includes('--repair');
const baseConfigs=[...Object.keys(names).map(id=>({ids:[id],name:names[id],title:byId.get(id).title})),{ids:['a1','a2','a3','a4','repair-answers'],name:'独立练习答案册.pdf',title:'ICS 第一次小测 · 独立练习答案册'},{ids:['mock-answers'],name:'2025保留卷解析-完成测验后阅读.pdf',title:'2025 第一次阶段测验 · 核对与解析'}];
names['past-bank']='往年题精选-题目册.pdf';
names['past-bank-answers']='往年题精选-独立解析.pdf';
const bankConfigs=[{ids:['past-bank'],name:names['past-bank'],title:'ICS前8讲·往年题精选·题目册'},{ids:['past-bank-answers'],name:names['past-bank-answers'],title:'ICS前8讲·往年题精选·独立解析'}];
const configs=onlyRepair?baseConfigs.filter(c=>['d6','command-reference'].includes(c.ids[0])):onlyBank?bankConfigs:[...baseConfigs,...bankConfigs];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles=['vendor/katex/katex.min.css','vendor/highlight.css','diagrams/d1d2.css','diagrams/d3d4d5.css','print-dense.css'];
const browserCache=path.join(process.env.HOME,'Library/Caches/ms-playwright');
const localChromium=(fs.existsSync(browserCache)?fs.readdirSync(browserCache):[]).filter(n=>n.startsWith('chromium_headless_shell-')).sort((a,b)=>Number(b.split('-').at(-1))-Number(a.split('-').at(-1))).map(n=>path.join(browserCache,n,'chrome-headless-shell-mac-arm64/chrome-headless-shell')).find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,executablePath:process.env.ICS_CHROMIUM||localChromium});
const report=[];
try {
 for(const config of configs) {
  const htmlPath=path.join(temp,config.name.replace(/\.pdf$/,'.html'));
  const sections=config.ids.map(id=>{const doc=byId.get(id);if(!doc)throw new Error('Missing document '+id);return `<article class="print-book-section" data-doc="${id}">${doc.html}</article>`;}).join('');
  fs.writeFileSync(htmlPath,`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><base href="${pathToFileURL(root+'/').href}"><title>${escape(config.title)}</title>${styles.map(s=>`<link rel="stylesheet" href="${s}">`).join('')}</head><body>${sections}</body></html>`);
  const page=await browser.newPage({viewport:{width:794,height:1123}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>/^(file:|data:)/.test(route.request().url())?route.continue():route.abort());
  await page.goto(pathToFileURL(htmlPath).href,{waitUntil:'load'});
  await page.emulateMedia({media:'print'});
  await page.evaluate(async()=>{await document.fonts.ready;});
  const metrics=await page.evaluate(({sourceMap,names,out})=>{
   const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   document.querySelectorAll('.mock-inline-review, details.exercise-answer').forEach(el=>el.remove());
   document.querySelectorAll('article').forEach(article=>{
    const h1=article.querySelector('h1');
    const meta=document.createElement('p');meta.className='print-meta';meta.textContent='ICS 第一次小测复习 · 发布版 · 2026-10-13 · 独立答案另册';h1?.after(meta);
    if(['d6','command-reference'].includes(article.dataset.doc))meta.textContent='ICS 测后补强 · 发布版 · 2026-10-13 · 知识讲解与三栏命令表';
    if(article.dataset.doc==='past-bank-answers')meta.textContent='历年题精选 · 独立解析 · 请先完成题目再核对';
    if(article.dataset.doc==='mock-answers')meta.textContent='2025 第一次阶段测验 · 完整解析 · 请在独立完成测验后阅读';
    if(['a1','a2','a3','a4','repair-answers'].includes(article.dataset.doc))meta.textContent='ICS 第一次小测复习 · 独立练习答案 · 请先完成题目再核对';
    const heads=[...article.querySelectorAll('h2')];
    if(heads.length>3&&article.dataset.doc.startsWith('d')){const toc=document.createElement('div');toc.className='print-toc';toc.innerHTML=heads.map(h=>`<div>${esc(h.textContent)}</div>`).join('');meta.after(toc);}
   });
   document.querySelectorAll('p').forEach(p=>{
    if(p.textContent.trim().startsWith('图 ')||/^图\d/.test(p.textContent.trim()))p.classList.add('print-figure-label');
    if(/^(来源：|编写日期：|本讲的文字、图和教学推导)/.test(p.textContent))p.classList.add('print-source-note');
   });
   for(const figure of [...document.querySelectorAll('[data-stepper]')]) {
    const steps=[...figure.querySelectorAll('.diagram-step')];
    if(figure.querySelector('svg [id^="d345-call-"]')) {
     const panels=steps.map(step=>{const desc=step.querySelector('desc').textContent;const rsp=desc.match(/rsp=([^；，]+)/)[1];const texts=[...step.querySelectorAll('svg text')].map(t=>t.textContent);const low=texts[texts.indexOf('0x0ff8')+1];return `<div class="print-call-frame"><h4>${esc(step.dataset.label)}</h4><div class="print-slot ${rsp==='0x1000'?'active':''}"><code>0x1000</code><span>原有栈数据${rsp==='0x1000'?' ← rsp':''}</span></div><div class="print-slot ${rsp==='0x0ff8'?'active':''}"><code>0x0ff8</code><span>${esc(low)}${rsp==='0x0ff8'?' ← rsp':''}</span></div><p>${esc(step.querySelector('.d345-reason').textContent)}</p></div>`;});
     figure.innerHTML='<figcaption class="d345-title">一次 call 与 ret 的三个时刻</figcaption><div class="print-call-columns">'+panels.join('')+'</div><p class="d345-caption">每栏中地址由高到低排列。粗边框指出 rsp 当前指向的位置；弹栈不等于清空旧字节。</p>';
    } else if(figure.querySelector('svg [id^="d345-rop-"]')) {
     const rows=steps.map(step=>{const desc=step.querySelector('desc').textContent;const match=desc.match(/rsp=([^，]+)，rax=([^，]+)，rbx=([^，]+)，下一执行位置(.+)。/);if(!match)throw new Error('ROP state not parsed');return `<tr><td>${esc(step.dataset.label)}</td><td><code>${esc(match[1])}</code></td><td>${esc(match[2])}</td><td>${esc(match[3])}</td><td>${esc(match[4])}</td></tr>`;});
     const reasons=steps.map(step=>`<li>${esc(step.querySelector('.d345-reason').textContent)}</li>`).join('');
     figure.innerHTML='<figcaption class="d345-title">ROP 返回链：初始栈与完整执行状态</figcaption><div class="print-rop-memory"><div>0x1018</div><div>STOP</div><div>G2 末尾 ret 读取</div><div>0x1010</div><div>G2</div><div>G1 末尾 ret 读取</div><div>0x1008</div><div>7</div><div>G1 的 pop 读取，这是数据</div><div>0x1000</div><div>G1 ← rsp</div><div>初始 ret 读取</div></div><table class="print-step-table"><thead><tr><th>步骤</th><th>rsp</th><th>rax</th><th>rbx</th><th>下一位置</th></tr></thead><tbody>'+rows.join('')+'</tbody></table><ol class="print-small-reasons">'+reasons+'</ol>';
    } else {
     const title=figure.querySelector('.d12-heading')?.textContent||'分步解释';
     const caption=figure.querySelector('figcaption')?.outerHTML||'';
     steps.forEach((step,i)=>{step.hidden=false;step.removeAttribute('hidden');const part=document.createElement('figure');part.className='d12-figure print-float-step';part.innerHTML=`<div class="d12-heading">${esc(title)}（${i+1}/${steps.length}）</div>`;part.append(step);if(i===steps.length-1)part.insertAdjacentHTML('beforeend',caption);figure.before(part);});figure.remove();
    }
   }
   for(const figure of document.querySelectorAll('[data-bit-demo]')) {
    figure.querySelector('.d12-heading').textContent='同一位模式的两种数值解释';
    figure.querySelectorAll('[data-bit-index]').forEach(button=>{const cell=document.createElement('span');for(const a of button.attributes)if(!a.name.startsWith('data-')&&a.name!=='type')cell.setAttribute(a.name,a.value);cell.textContent=button.textContent;button.replaceWith(cell);});
    figure.querySelectorAll('.d12-row-label').forEach(x=>x.textContent=x.textContent.replace(' · 可点击',''));
    const note=document.createElement('p');note.className='print-note';note.textContent='对照：只把最高位由 1 改成 0，位串成为 01011011，两种解释都等于 91。';figure.append(note);
   }
   document.querySelectorAll('.d12-control-row,.d12-step-controls,.d345-controls,.d345-scroll-hint,button').forEach(el=>el.remove());
   document.querySelectorAll('[hidden]').forEach(el=>el.removeAttribute('hidden'));
   for(const a of document.querySelectorAll('a')) {
    if(a.dataset.sourceId&&sourceMap[a.dataset.sourceId])a.href='file://'+encodeURI(sourceMap[a.dataset.sourceId].path);
    else if(a.getAttribute('href')?.startsWith('#doc=')){const id=new URLSearchParams(a.getAttribute('href').slice(1)).get('doc');const name=names[id]||(id==='mock-answers'?'2025保留卷解析-完成测验后阅读.pdf':/^(a[1-4]|repair-answers)$/.test(id)?'独立练习答案册.pdf':null);if(name)a.href='https://by-lastime.github.io/ics-study-notes/downloads/'+encodeURIComponent(name);}
   }
   document.querySelectorAll('.d12-numberline .d12-svg-tick').forEach(label=>{if(label.textContent==='15/32')label.setAttribute('x','579');if(label.textContent==='16/32')label.setAttribute('x','625');});
   document.querySelectorAll('article[data-doc="past-bank"] > h3').forEach(h=>{const wrapper=document.createElement('section');wrapper.className='print-exercise';h.before(wrapper);let node=h;while(node&&!/^H[23]$/.test(node===h?'':node.tagName)){const next=node.nextElementSibling;wrapper.append(node);node=next;}if(wrapper.getBoundingClientRect().height>940)wrapper.classList.add('print-exercise-long');});
   document.querySelectorAll('svg').forEach(svg=>{const box=svg.viewBox.baseVal;if(box.height>750)svg.classList.add('tall-svg');});
   return {math:document.querySelectorAll('.katex').length,mathErrors:document.querySelectorAll('.katex-error').length,figures:document.querySelectorAll('figure').length,answerBlocks:document.querySelectorAll('details.exercise-answer').length,hidden:document.querySelectorAll('[hidden]').length,wide:[...document.querySelectorAll('pre,table,figure,.katex-display')].filter(el=>el.scrollWidth>el.clientWidth+3).map(el=>({tag:el.tagName,width:el.clientWidth,scroll:el.scrollWidth,text:el.textContent.slice(0,60)})),oversized:[...document.querySelectorAll('figure,pre')].filter(el=>el.getBoundingClientRect().height>1000).map(el=>({tag:el.tagName,height:el.getBoundingClientRect().height,text:el.textContent.slice(0,80)}))};
  },{sourceMap:data.sourceMap,names,out});
  if(metrics.mathErrors||metrics.answerBlocks||errors.length)throw new Error(JSON.stringify({metrics,errors}));
  fs.writeFileSync(htmlPath,await page.content());
  await page.pdf({path:path.join(out,config.name),format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,headerTemplate:'<div></div>',footerTemplate:`<div style="width:100%;font-size:8px;color:#666;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>${escape(config.title)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,tagged:true,outline:true});
  report.push({file:config.name,...metrics,errors});console.log(config.name,JSON.stringify(metrics));await page.close();
 }
} finally {await browser.close();}
fs.writeFileSync(path.join(temp,'export-report.json'),JSON.stringify(report,null,2));
const python=process.env.ICS_PDF_PYTHON||'python3';
if(!onlyBank&&!onlyRepair)execFileSync(python,[path.join(root,'scripts/merge-lecture-pdfs.py')],{stdio:'inherit'});
console.log('PDF files:',out,'QA:',temp);
