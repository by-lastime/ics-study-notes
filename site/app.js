(() => {
  'use strict';
  const data = window.ICS_CONTENT;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const article = $('#article');
  if (!data || !Array.isArray(data.docs)) { article.innerHTML = '<h1>还没有生成讲义</h1><p>请双击本目录的“启动阅读网站.command”，完成生成后重新打开。</p>'; return; }
  const docs = new Map(data.docs.map(doc => [doc.id, doc]));
  const storage = {get(key, fallback) {try {return JSON.parse(localStorage.getItem('ics-reader-'+key)) ?? fallback;} catch {return fallback;}}, set(key, value) {try {localStorage.setItem('ics-reader-'+key, JSON.stringify(value));} catch {}}};
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titles = ['整数与汇编入门','浮点与条件分支','循环与过程调用','数据布局与内存安全','完整测验与考前整理','测后重点补强'];
  let currentDoc = null, observer = null, scrollTimer, toastTimer, mockUnlocked = false;
  let fontSize = Math.min(23, Math.max(16, storage.get('font', 18)));
  const positions = storage.get('positions', {});
  const headingTargets = new Map();
  $('#lesson-links').innerHTML = titles.map((title,i) => `<a class="nav-link" href="#doc=d${i+1}" data-doc-id="d${i+1}"><span class="nav-number">第${i+1}讲</span><span class="nav-title">${title}</span></a>`).join('');
  function notify(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2300);}
  async function copy(text) {
    try {await navigator.clipboard.writeText(text);} catch {
      const box=document.createElement('textarea');box.value=text;box.style.position='fixed';box.style.opacity='0';document.body.append(box);box.select();const ok=document.execCommand('copy');box.remove();if(!ok){notify('请选中文字后复制');return;}
    }
    notify('已复制，可以带着这一节继续提问');
  }
  function setFont(value) {fontSize=Math.min(23,Math.max(16,value));document.documentElement.style.setProperty('--body-size',fontSize+'px');$('#font-value').textContent=fontSize;$('#font-smaller').disabled=fontSize<=16;$('#font-larger').disabled=fontSize>=23;storage.set('font',fontSize);}
  function setTheme(theme) {document.body.dataset.theme=theme;$$('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.themeChoice===theme));storage.set('theme',theme);}
  setFont(fontSize);setTheme(storage.get('theme','light'));
  document.body.classList.toggle('rail-hidden',storage.get('rail-hidden',false));
  function toggleRail(force) {
    if(matchMedia('(max-width:760px)').matches){document.body.classList.toggle('mobile-rail',force ?? !document.body.classList.contains('mobile-rail'));}
    else {const hidden=force===undefined?!document.body.classList.contains('rail-hidden'):!force;document.body.classList.toggle('rail-hidden',hidden);storage.set('rail-hidden',hidden);}
  }
  $('#collapse-sidebar').onclick=()=>{document.body.classList.remove('mobile-rail');if(!matchMedia('(max-width:760px)').matches)toggleRail(false);};
  $('#expand-sidebar').onclick=()=>toggleRail(true);
  $('#mobile-scrim').onclick=()=>document.body.classList.remove('mobile-rail');
  $('#focus-toggle').onclick=()=>{toggleRail();closePanels();};
  $('#reset-reading').onclick=()=>{for(const key of Object.keys(positions))delete positions[key];storage.set('positions',positions);closePanels();window.scrollTo({top:0,behavior:'instant'});notify('阅读位置已清除，讲义和学习记录没有改变');};
  $('#font-smaller').onclick=()=>setFont(fontSize-1);$('#font-larger').onclick=()=>setFont(fontSize+1);
  $$('[data-theme-choice]').forEach(button=>button.onclick=()=>setTheme(button.dataset.themeChoice));
  $('#print-page').onclick=()=>{closePanels();window.print();};
  function closePanels(except) {['toc-panel','appearance-panel'].forEach(id=>{if(id!==except){$('#'+id).hidden=true;$('#'+(id==='toc-panel'?'toc-toggle':'appearance-toggle')).setAttribute('aria-expanded','false');}});}
  function togglePanel(id,button) {const next=$('#'+id).hidden;closePanels(id);$('#'+id).hidden=!next;button.setAttribute('aria-expanded',String(next));}
  $('#toc-toggle').onclick=e=>togglePanel('toc-panel',e.currentTarget);$('#appearance-toggle').onclick=e=>togglePanel('appearance-panel',e.currentTarget);
  $$('.close-panel').forEach(b=>b.onclick=()=>closePanels());
  document.addEventListener('click',e=>{if(!e.target.closest('.floating-panel,.topbar-actions'))closePanels();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePanels();document.body.classList.remove('mobile-rail');}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}});
  function route() {const params=new URLSearchParams(location.hash.slice(1));return {id:params.get('doc')||storage.get('last-doc','d1'),section:params.get('section')};}
  function savePosition() {if(currentDoc){positions[currentDoc.id]=Math.round(window.scrollY);storage.set('positions',positions);}}
  function go(id, section) {savePosition();location.hash='doc='+encodeURIComponent(id)+(section?'&section='+encodeURIComponent(section):'');}
  function cleanTitle(doc) {return doc.title.replace(/^第\s*[1-6]\s*讲\s*[:：]?\s*/,'');}
  function render() {
    const {id,section}=route();const doc=docs.get(id)||docs.get('d1')||data.docs[0];
    if(currentDoc?.id===doc.id){if(section)scrollToSection(section);return;}
    currentDoc=doc;storage.set('last-doc',doc.id);document.title=cleanTitle(doc)+' · ICS 复习讲义';
    document.body.classList.remove('mobile-rail');closePanels();observer?.disconnect();
    $('#current-label').textContent=doc.day?`第${doc.day}讲`:(doc.kind==='answers'?'练习解析':doc.shortTitle||doc.title);
    $$('.sidebar a').forEach(link=>{if(link.hash===`#doc=${doc.id}`)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    if(doc.id==='mock-answers'&&!mockUnlocked){renderGate();return;}
    article.innerHTML=doc.html;
    const h1=$('h1',article);if(h1)h1.textContent=cleanTitle(doc);
    prepareContent(article);buildTOC();renderFooter();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(section)scrollToSection(section);else window.scrollTo({top:positions[doc.id]||0,behavior:'instant'});}));
  }
  function prepareContent(root) {
    $$('p',root).forEach(p=>{if(p.textContent.startsWith('来源：')||p.textContent.startsWith('编写日期：')||p.textContent.startsWith('本讲的文字、图和教学推导'))p.classList.add('source-note');});
    if(location.protocol==='file:')$$('[data-offline-href]',root).forEach(link=>link.href=link.dataset.offlineHref);
    $$('table',root).forEach(table=>{if(table.closest('figure,.table-scroll'))return;const wrap=document.createElement('div');wrap.className='table-scroll';wrap.setAttribute('tabindex','0');wrap.setAttribute('aria-label','表格，可横向滚动');table.before(wrap);wrap.append(table);});
    $$('pre',root).forEach(pre=>{if(pre.closest('figure'))return;const code=$('code',pre);if(!code)return;const toolbar=document.createElement('div');toolbar.className='code-toolbar';const language=code.className.match(/language-([\w-]+)/)?.[1]||'示例';toolbar.innerHTML=`<span>${escapeHTML(language==='x86asm'?'汇编':language==='text'?'过程':language.toUpperCase())}</span><button class="copy-code">复制</button>`;$('.copy-code',toolbar).onclick=()=>copy(code.textContent);pre.prepend(toolbar);});
    initDiagrams(root);
  }
  function renderGate() {
    article.innerHTML='<h1>保留卷核对与解析</h1><div class="mock-gate"><h2>完成整卷后，再打开答案</h2><p>这里包含 2025 第一次阶段测验的全部解析。如果你还没有独立作答，先返回第五讲查看测验说明，保留这套题的检验价值。</p><button class="primary-button" id="unlock-mock">我已完成测验，查看解析</button><button class="text-button" id="back-mock">返回测验说明</button></div>';
    $('#unlock-mock').onclick=()=>{mockUnlocked=true;currentDoc=null;render();};$('#back-mock').onclick=()=>go('d5');$('#toc-links').innerHTML='<p class="search-empty">打开解析后显示目录。</p>';$('#lesson-footer').innerHTML='';window.scrollTo({top:0,behavior:'instant'});
  }
  function buildTOC() {
    headingTargets.clear();const headings=$$('h2,h3',article).filter(h=>!h.closest('.exercise-answer'));
    $('#toc-links').innerHTML=headings.map((h,i)=>{if(!h.id)h.id=`${currentDoc.id}-section-${i}`;const title=h.textContent;headingTargets.set(h.id,title);const button=document.createElement('button');button.className='heading-copy';button.textContent='引用本节';button.title='复制讲次、标题和仓库内讲义路径';button.onclick=()=>copy(`我在学习 ICS 复习讲义「${currentDoc.title}」的「${title}」。\n讲义文件：${currentDoc.sourcePath}\n我的问题：`);h.append(button);return `<a class="toc-link${h.tagName==='H3'?' sub':''}" href="#doc=${encodeURIComponent(currentDoc.id)}&section=${encodeURIComponent(h.id)}" data-section="${escapeHTML(h.id)}">${escapeHTML(title)}</a>`;}).join('')||'<p class="search-empty">本页无需分节。</p>';
    observer=new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).forEach(e=>{$$('.toc-link').forEach(link=>link.classList.toggle('active',link.dataset.section===e.target.id));});},{rootMargin:'-75px 0px -68% 0px'});headings.forEach(h=>observer.observe(h));
  }
  function scrollToSection(id) {const target=document.getElementById(id);if(target){target.scrollIntoView({behavior:'smooth',block:'start'});closePanels();}}
  function renderFooter() {const day=Number(currentDoc.day);if(currentDoc.kind!=='lesson'||!day){$('#lesson-footer').innerHTML='<a href="#doc=d1">回到第一讲</a>';return;}$('#lesson-footer').innerHTML=(day>1?`<a href="#doc=d${day-1}"><small>上一讲</small>← ${titles[day-2]}</a>`:'')+(day<titles.length?`<a href="#doc=d${day+1}"><small>下一讲</small>${titles[day]} →</a>`:'<a href="#doc=progress"><small>下一步</small>记录真实作答情况 →</a>');}
  function initDiagrams(root) {
    $$('[data-stepper]',root).forEach(figure=>{
      const steps=$$('.diagram-step',figure), label=$('[data-step-label]',figure), prev=$('[data-prev]',figure),next=$('[data-next]',figure);let index=0;
      const show=()=>{steps.forEach((step,i)=>step.hidden=i!==index);const active=steps[index];if(label)label.textContent=`${index+1} / ${steps.length}`+(active?.dataset.label?` · ${active.dataset.label}`:'');if(prev){prev.disabled=index===0;prev.textContent=active?.dataset.prevLabel||'上一步';}if(next){next.disabled=index===steps.length-1;next.textContent=active?.dataset.nextLabel||'下一步';}figure.dataset.currentStep=String(index);};
      if(prev)prev.onclick=()=>{if(index>0){index--;show();}};if(next)next.onclick=()=>{if(index<steps.length-1){index++;show();}};show();
    });
    $$('[data-bit-demo]',root).forEach(figure=>{
      const buttons=$$('[data-bit-index]',figure);const initial=figure.dataset.initialBits||'11011011';
      function update(reset=false){let value=0;buttons.forEach(button=>{const index=Number(button.dataset.bitIndex);if(reset)button.dataset.bitValue=initial[7-index];const bit=Number(button.dataset.bitValue||button.textContent.trim());button.textContent=bit;button.dataset.bitValue=String(bit);button.setAttribute('aria-pressed',String(bit===1));button.setAttribute('aria-label',`第${index}位：${bit}，点击切换`);value+=bit*2**index;});const signed=value>=128?value-256:value;const u=$('[data-unsigned]',figure),s=$('[data-signed]',figure),f=$('[data-bit-formula]',figure);if(u)u.textContent=String(value);if(s)s.textContent=String(signed).replace('-','−');if(f)f.textContent=value>=128?`${value} − 256 = ${signed.toString().replace('-','−')}；最高位的补码权重是 −128。`:`最高位为 0，两种解释都是 ${value}。`;}
      buttons.forEach(button=>button.onclick=()=>{button.dataset.bitValue=button.dataset.bitValue==='1'?'0':'1';update();});const reset=$('[data-reset-bits]',figure);if(reset)reset.onclick=()=>update(true);update(true);
    });
  }
  const searchable=data.docs.filter(doc=>doc.kind!=='answers'&&!doc.id.includes('answers')).sort((a,b)=>Number(b.kind==='lesson')-Number(a.kind==='lesson')).map(doc=>{const holder=document.createElement('div');holder.innerHTML=doc.html;$$('.exercise-answer',holder).forEach(x=>x.remove());const sections=[];let section={id:null,title:doc.title,text:''};for(const child of holder.children){if(/^H[1-4]$/.test(child.tagName)){if(section.text)sections.push(section);section={id:child.id,title:child.textContent,text:child.textContent+' '};}else section.text+=' '+child.textContent;}if(section.text)sections.push(section);return {doc,sections:sections.map(s=>({...s,text:s.text.replace(/\s+/g,' ')}))};});
  function openSearch() {if(supplementDialog.open)return;if(!$('#search-dialog').open)$('#search-dialog').showModal();$('#search-input').value='';search('');setTimeout(()=>$('#search-input').focus(),10);}
  $('#search-launch').onclick=openSearch;$('#doc-switch').onclick=openSearch;$('#close-search').onclick=()=>$('#search-dialog').close();
  $('#search-dialog').addEventListener('click',e=>{if(e.target===$('#search-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('#search-input').addEventListener('input',e=>search(e.target.value));
  function search(term) {
    const q=term.trim().toLocaleLowerCase();const found=[];
    for(const item of searchable){if(!q){if(item.doc.kind==='lesson')found.push({doc:item.doc,context:'打开这一讲',section:null});continue;}let count=0;for(const section of item.sections){const i=section.text.toLocaleLowerCase().indexOf(q);if(i>=0&&count<3){found.push({doc:item.doc,context:section.text.slice(Math.max(0,i-30),i+110),section:section.id,sectionTitle:section.title});count++;}}}
    const holder=$('#search-results');holder.innerHTML=found.length?found.slice(0,24).map((r,i)=>`<button class="search-result" data-result="${i}"><strong>${escapeHTML(r.sectionTitle||r.doc.title)}</strong><p>${r.sectionTitle?escapeHTML(r.doc.shortTitle||r.doc.title)+' · ':''}${escapeHTML(r.context)}</p></button>`).join(''):'<p class="search-empty">没有找到这个词。可以试试“补码”“调用栈”或题号。</p>';
    $$('[data-result]',holder).forEach(button=>button.onclick=()=>{const r=found[Number(button.dataset.result)];$('#search-dialog').close();if(currentDoc?.id===r.doc.id&&!r.section){window.scrollTo({top:0,behavior:'smooth'});}else go(r.doc.id,r.section);});
  }
  const supplementDialog = $('#supplement-dialog');
  const supplementBody = $('#supplement-body');
  let supplementTrigger = null;
  let supplementScroll = 0;
  function openSupplement(link) {
    const doc = docs.get(link.dataset.docLink);
    if(!doc)return false;
    const holder = document.createElement('div');holder.innerHTML=doc.html;
    const question = link.dataset.supplementQuestion;
    const heading = $$('h2',holder).find(h=>/^Q\d+\b/i.exec(h.textContent.trim())?.[0].toUpperCase()===question);
    if(!heading)return false;
    const nodes=[];
    for(let node=heading.nextElementSibling;node&&!/^H[12]$/.test(node.tagName);node=node.nextElementSibling)nodes.push(node);
    // Q records keep provenance before their first answer subheading.
    const answerStart=nodes.findIndex(node=>node.tagName==='H3');
    supplementBody.replaceChildren(...nodes.slice(answerStart<0?0:answerStart));
    // Keep copied heading IDs separate from a supplement also open underneath.
    $$('[id]',supplementBody).forEach(node=>node.id='popup-'+node.id);
    $('#supplement-title').textContent=heading.textContent;
    prepareContent(supplementBody);
    if(!supplementDialog.open){supplementTrigger=link;supplementScroll=window.scrollY;document.documentElement.classList.add('supplement-open');supplementDialog.showModal();}
    supplementBody.scrollTop=0;
    return true;
  }
  $('#close-supplement').onclick=()=>supplementDialog.close();
  supplementDialog.addEventListener('close',()=>{
    document.documentElement.classList.remove('supplement-open');
    supplementTrigger?.focus({preventScroll:true});supplementTrigger=null;
    window.scrollTo({top:supplementScroll,behavior:'instant'});
    supplementBody.replaceChildren();
  });
  supplementDialog.addEventListener('click',event=>{
    if(event.target!==supplementDialog)return;
    const r=supplementDialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)supplementDialog.close();
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#doc="]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(link.dataset.supplementQuestion&&openSupplement(link)){event.preventDefault();return;}
    if(supplementDialog.open)supplementDialog.close();
    savePosition();document.body.classList.remove('mobile-rail');
    if(link.hash===location.hash){const section=new URLSearchParams(link.hash.slice(1)).get('section');if(section)scrollToSection(section);}
  });
  window.addEventListener('hashchange',render);window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(savePosition,240);},{passive:true});window.addEventListener('beforeunload',savePosition);
  $('#reload-content').onclick=()=>{savePosition();location.reload();};
  if(!data.publicRelease && location.protocol!=='file:'){let baseline=data.version||null;setInterval(async()=>{try{const response=await fetch('/api/version',{cache:'no-store'});const status=await response.json();if(status.service!=='ics-local-review')return;if(!baseline)baseline=status.version;else if(status.version&&status.version!==baseline)$('#update-notice').hidden=false;}catch{}},5000);}
  render();
})();
