#!/usr/bin/env node
/** Build the local reader. No document data is sent to a network service. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Marked, Renderer } from 'marked';
import katex from 'katex';
import hljs from 'highlight.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = path.dirname(ROOT);
const SOURCES = path.join(PROJECT, 'content');
const PLAN = path.join(SOURCES, '复习计划.md');
const DIAGRAMS = path.join(ROOT, 'diagrams');
const diagnostics = { mathCount: 0, mathErrors: [], mathWarnings: [], diagrams: [], answers: [], missingSources: [], filteredLines: [] };
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const encodeRelative = value => value.split(path.sep).map(part => encodeURIComponent(part)).join('/');
const atomicWrite = (target, data) => { const temp = `${target}.${process.pid}.tmp`; fs.writeFileSync(temp, data); fs.renameSync(temp, target); };
function filesBelow(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => !e.name.startsWith('.')).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? filesBelow(full, ext) : e.isFile() && (!ext || full.endsWith(ext)) ? [full] : [];
  }).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
function titleOf(md, fallback) { return /^#\s+(.+)$/m.exec(md)?.[1]?.trim() || fallback; }
function plain(text) { return text.replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').trim(); }
function inferDay(name) {
  const m = /第?\s*([一二三四五六1-6])\s*讲/.exec(name);
  return m ? ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }[m[1]] || Number(m[1])) : null;
}
const descriptors = [
  ['overview', 'README.md', 'guide', null, '阅读指南'],
  ...[1, 2, 3, 4, 5, 6].map(day => [`d${day}`, fs.readdirSync(SOURCES).find(n => n.startsWith(`第${day}讲-`) && n.endsWith('.md')), 'lesson', day, ['整数与汇编入门','浮点与条件分支','循环与过程调用','数据布局与内存安全','完整测验与考前整理','测后重点补强'][day - 1]]),
  ...[1, 2, 3, 4].map(day => [`a${day}`, `答案/第${day}讲-练习答案.md`, 'answers', day, `第 ${day} 讲答案`]),
  ['mock-answers', '答案/第5讲-保留卷核对与解析.md', 'answers', 5, '保留卷核对与解析'],
  ['repair-answers', '答案/第5讲-纠错题答案.md', 'answers', 5, '纠错题答案'],
  ['command-reference', '汇编命令速查表-三栏版.md', 'supplement', 6, '汇编命令三栏速查'],
  ['plan', PLAN, 'guide', null, '五天复习计划'],
  ['past-bank', '往年题精选/往年题精选-题目.md', 'supplement', null, '往年题精选·44题'],
  ['past-bank-answers', '答案/往年题精选-解析.md', 'answers', null, '往年题精选解析'],
  ['past-bank-guide', '往年题精选/README.md', 'guide', null, '往年题筛选说明'],
  ['supplements', '补充讲义/README.md', 'guide', null, '补充讲义']
];
const docs = descriptors.map(([id, filename, kind, day, shortTitle]) => {
  if (!filename) throw new Error(`没有找到 ${id} 的源 Markdown。`);
  const sourcePath = path.isAbsolute(filename) ? filename : path.join(SOURCES, filename);
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  return { id, title: plain(titleOf(markdown, shortTitle)), shortTitle, kind, day, sourcePath, markdown };
});
const known = new Set(docs.map(d => d.sourcePath));
const extra = [...filesBelow(SOURCES, '.md'), ...fs.readdirSync(PROJECT).filter(n => /^第[一二三四五六1-6].*讲.*补充.*\.md$/.test(n)).map(n => path.join(PROJECT, n))];
for (const sourcePath of extra) {
  if (known.has(sourcePath)) continue;
  known.add(sourcePath);
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const title = plain(titleOf(markdown, path.basename(sourcePath, '.md')));
  docs.push({ id: `supp-${digest(path.relative(PROJECT, sourcePath)).slice(0, 10)}`, title, shortTitle: title, kind: 'supplement', day: inferDay(title), sourcePath, markdown });
}
const pathToDoc = new Map(docs.map(d => [d.sourcePath, d.id]));
const sourceMap = {};
const sourcePaths = new Map();
function registerSource(fullPath) {
  const resolved = path.resolve(fullPath);
  // Public releases never recursively import local reference materials.
  diagnostics.missingSources.push(path.relative(PROJECT, resolved));
  return null;
}

const mappings = filesBelow(DIAGRAMS, '.json').flatMap(file => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`图表映射应为数组：${file}`);
  return data.map((entry, index) => {
    if (!entry.doc || !['code', 'table', 'insertAfter'].includes(entry.kind) || !entry.needle || typeof entry.html !== 'string') throw new Error(`图表映射格式错误：${file} 第 ${index + 1} 项`);
    return { ...entry, file: path.basename(file), index: index + 1, hits: 0 };
  });
});

function cleanMarkdown(md, doc) {
  const lines = md.split('\n').filter(line => {
    if (/^\s*\[返回总目录\]/.test(line) || /^本讲尚无用户追问记录[；;]/.test(line)) {
      diagnostics.filteredLines.push({ doc: doc.id, text: line });
      return false;
    }
    return true;
  });
  // Remove only the date metadata itself, not surrounding teaching text.
  return lines.join('\n').replace(/编写日期[：:]\s*\d{4}-\d{2}-\d{2}[。.]?\s*/g, '');
}
function canonicalExercise(text) {
  const m = /\bD([1-5])-([A-Z])0*(\d+)\b/i.exec(text);
  return m ? `D${m[1]}-${m[2].toUpperCase()}${Number(m[3])}` : null;
}
const answerParts = new Map();
for (const doc of docs.filter(d => /^a[1-4]$/.test(d.id))) {
  const headings = [...doc.markdown.matchAll(/^##\s+(.+)$/gm)];
  headings.forEach((match, i) => {
    const id = canonicalExercise(match[1]);
    if (!id) return;
    answerParts.set(id, { markdown: doc.markdown.slice(match.index + match[0].length, headings[i + 1]?.index ?? doc.markdown.length).trim(), doc });
  });
}
const repairDoc = docs.find(d => d.id === 'repair-answers');
const repairMarkers = [...repairDoc.markdown.matchAll(/^\*\*([A-G][12])\*\*[：:]/gm)];
repairMarkers.forEach((m, i) => {
  const raw = repairDoc.markdown.slice(m.index + m[0].length, repairMarkers[i + 1]?.index ?? repairDoc.markdown.length);
  answerParts.set(`D5-${m[1]}`, { markdown: raw.split(/^##\s+/m)[0].trim(), doc: repairDoc });
});

function mathHtml(tex, display, context) {
  diagnostics.mathCount++;
  try {
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: true, trust: false, output: 'htmlAndMathml', strict: (code, message) => { diagnostics.mathWarnings.push({ doc: context.id, code, message }); return 'ignore'; } });
    return display ? `<div class="math-display">${html}</div>\n` : html;
  } catch (error) {
    diagnostics.mathErrors.push({ doc: context.id, tex, message: error.message });
    return `<span class="math-error">${esc(tex)}</span>`;
  }
}
function mathExtensions(context) {
  return [
    { name: 'icsMathBlock', level: 'block', start: src => src.search(/(?:^|\n)[ \t]*(?:\$\$|\\\[)/), tokenizer(src) {
      const m = /^(?: {0,3})\$\$[ \t]*\n?([\s\S]*?)\n?\$\$[ \t]*(?:\n|$)/.exec(src) || /^(?: {0,3})\\\[\s*\n?([\s\S]*?)\\\][ \t]*(?:\n|$)/.exec(src);
      if (m) return { type: 'icsMathBlock', raw: m[0], text: m[1].trim() };
    }, renderer(token) { return mathHtml(token.text, true, context); } },
    { name: 'icsMathInline', level: 'inline', start: src => src.search(/\$|\\\(/), tokenizer(src) {
      const m = /^\$(?!\$)((?:\\.|[^\n$])+?)\$(?!\$)/.exec(src) || /^\\\(([\s\S]+?)\\\)/.exec(src);
      if (m) return { type: 'icsMathInline', raw: m[0], text: m[1].trim() };
    }, renderer(token) { return mathHtml(token.text, false, context); } }
  ];
}
function rewriteLink(href, doc) {
  if (/^(?:https?:|mailto:|tel:|data:)/i.test(href)) return { href };
  if (href.startsWith('#doc=')) return { href };
  if (href.startsWith('#') && href.length > 1) return { href: `#doc=${doc.id}&section=${encodeURIComponent(href.slice(1))}`, docId: doc.id };
  if (href === '#') return { href };
  if (/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith('file:')) return { href: '#' };
  let decoded;
  try { decoded = decodeURI(href.replace(/^file:\/\//, '')); } catch { decoded = href; }
  const hash = decoded.indexOf('#');
  const fragment = hash >= 0 ? decoded.slice(hash) : '';
  const local = hash >= 0 ? decoded.slice(0, hash) : decoded;
  const full = path.resolve(path.dirname(doc.sourcePath), local);
  if (full === SOURCES) return { href: '#doc=overview', docId: 'overview' };
  if (pathToDoc.has(full)) return { href: `#doc=${pathToDoc.get(full)}`, docId: pathToDoc.get(full) };
  const id = registerSource(full);
  return id ? { href: `/source/${id}${fragment}`, sourceId: id, offline: sourceMap[id].relativePath + fragment } : { href: '#', missing: full };
}
function makeRenderer(context, headings) {
  const renderer = new Renderer();
  const baseTable = renderer.table;
  const usedIds = new Map();
  renderer.heading = function(token) {
    const text = plain(token.text);
    const exercise = canonicalExercise(text);
    const slug = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 90) || 'section';
    const base = `${context.id}-${exercise ? exercise.toLowerCase() : slug}`;
    const count = usedIds.get(base) || 0;
    usedIds.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    if (headings) headings.push({ id, text, level: token.depth });
    return `<h${token.depth} id="${esc(id)}"${exercise ? ` data-exercise-id="${exercise}"` : ''}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  };
  renderer.code = function(token) {
    if (token.diagramHtml) return token.diagramHtml + '\n';
    const original = (token.lang || 'text').split(/\s+/)[0].toLowerCase();
    const language = ({ asm: 'x86asm', assembly: 'x86asm', sh: 'bash', js: 'javascript' })[original] || original;
    let html = esc(token.text);
    if (hljs.getLanguage(language)) html = hljs.highlight(token.text, { language, ignoreIllegals: true }).value;
    return `<pre class="code-block" data-language="${esc(original)}"><code class="hljs language-${esc(original)}">${html}</code></pre>\n`;
  };
  renderer.table = function(token) { return token.diagramHtml ? token.diagramHtml + '\n' : `<div class="table-scroll" tabindex="0" role="region" aria-label="可横向滚动的表格">${baseTable.call(this, token)}</div>\n`; };
  renderer.link = function(token) {
    const mapped = rewriteLink(token.href, context);
    const target = docs.find(doc => doc.id === mapped.docId);
    const question = target?.sourcePath.startsWith(path.join(SOURCES, '补充讲义') + path.sep)
      ? /\bQ\d+\b/i.exec(plain(token.text))?.[0].toUpperCase() : null;
    return `<a href="${esc(mapped.href)}"${token.title ? ` title="${esc(token.title)}"` : ''}${mapped.docId ? ` data-doc-link="${esc(mapped.docId)}"` : ''}${question ? ` data-supplement-question="${question}" aria-haspopup="dialog" aria-controls="supplement-dialog"` : ''}${mapped.sourceId ? ` data-source-id="${mapped.sourceId}" data-offline-href="${esc(mapped.offline)}" target="_blank" rel="noopener"` : ''}${mapped.missing ? ' class="source-unavailable" aria-disabled="true"' : ''}>${this.parser.parseInline(token.tokens)}</a>`;
  };
  return renderer;
}
function renderMarkdown(markdown, context, { headings = null, injectAnswers = false, applyDiagrams = false } = {}) {
  let source = markdown;
  if (applyDiagrams) {
    for (const mapping of mappings.filter(m => m.doc === context.id && m.kind === 'insertAfter')) {
      const positions = [...source.matchAll(new RegExp(mapping.needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
      mapping.hits += positions.length;
      if (positions.length === 1) source = source.replace(mapping.needle, `${mapping.needle}\n\n${mapping.html}\n\n`);
    }
  }
  if (context.id === 'd6' && source.includes('<!-- ICS_COMMAND_REFERENCE -->')) {
    const ref = docs.find(d => d.id === 'command-reference');
    const body = ref.markdown.slice(ref.markdown.indexOf('## '), ref.markdown.indexOf('## 使用提醒与来源'));
    const nested = body.replace(/^## /gm, '### ');
    source = source.replace('<!-- ICS_COMMAND_REFERENCE -->', '<div class="command-reference">\n\n' + nested + '\n</div>');
  }
  if (context.id === 'd5') source = source.replace(/^- \*\*(D5-[A-G][12])\*\*[：:]\s*/gm, '#### $1\n\n');
  const marked = new Marked({ gfm: true, breaks: false, renderer: makeRenderer(context, headings), extensions: mathExtensions(context) });
  const tokens = marked.lexer(source);
  if (applyDiagrams) {
    marked.walkTokens(tokens, token => {
      for (const mapping of mappings.filter(m => m.doc === context.id && (m.kind === 'table' && token.type === 'table' || m.kind === 'code' && token.type === 'code' && (!token.lang || token.lang === 'text')))) {
        if ((token.raw || '').includes(mapping.needle) || (token.text || '').includes(mapping.needle)) { mapping.hits++; token.diagramHtml = mapping.html; }
      }
    });
  }
  if (injectAnswers) {
    const insertions = [];
    tokens.forEach((token, i) => {
      if (token.type !== 'heading') return;
      const id = canonicalExercise(token.text);
      const part = id && answerParts.get(id);
      if (!part) return;
      let end = i + 1;
      while (end < tokens.length && !(tokens[end].type === 'heading' && tokens[end].depth <= token.depth)) end++;
      const html = renderMarkdown(part.markdown, { ...part.doc, id: `inline-${id.toLowerCase()}` });
      insertions.push({ end, token: { type: 'html', raw: '', text: `<details class="exercise-answer" data-exercise="${id}"><summary>查看答案与解析 <span aria-hidden="true">＋</span></summary><div class="answer-body">${html}</div></details>\n`, block: true } });
      diagnostics.answers.push({ doc: context.id, exercise: id, answerDoc: part.doc.id });
    });
    for (const item of insertions.reverse()) tokens.splice(item.end, 0, item.token);
  }
  return marked.parser(tokens);
}

// Keep the full mock-exam answers in one Markdown source, while allowing
// readers to expand each answer directly within lesson 5.
function renderMockReview(headings) {
  const answerDoc = docs.find(doc => doc.id === 'mock-answers');
  const source = answerDoc.markdown;
  const questions = [...source.matchAll(/^### 第(\d+)题([^\n]*)\n/gm)];
  if (questions.length !== 24 || questions.some((m, i) => Number(m[1]) !== i + 1)) {
    throw new Error('保留卷解析应按顺序完整包含第1至24题。');
  }
  const topics = ['位运算与逻辑非','有符号与无符号比较','符号扩展与首字节','浮点编码','最近偶数舍入','浮点表达式判断','寄存器名称','寄存器与内存访问次数','有效地址计算','cmp与test','setle与零扩展','条件跳转与条件传送','从汇编恢复循环','跳转表','pop的三个步骤','调用、返回与寄存器保存','变量的存储位置','固定长度二维数组','运行时行长与寻址','二维数组逐项求值','由偏移反推结构体','混合类型参数','联合与大端字节序','防护方法与实现前提'];
  const context = { ...answerDoc, id: 'd5-mock' };
  return '<section class="mock-inline-review" aria-label="2025第一次阶段测验逐题解析">\n' + questions.map(match => {
    const number = Number(match[1]);
    const rest = source.slice(match.index + match[0].length);
    const boundary = /^#{2,3} /m.exec(rest);
    const body = boundary ? rest.slice(0, boundary.index) : rest;
    const title = `第${number}题：${topics[number - 1]}`;
    const heading = renderMarkdown(`### ${title}\n`, context, { headings });
    const answer = renderMarkdown(body, { ...context, id: `d5-mock-${number}` });
    diagnostics.answers.push({ doc: 'd5', exercise: `MOCK-${number}`, answerDoc: answerDoc.id });
    return `${heading}<p class="mock-source-note">${esc(match[2].trim())} · 无答案版PDF页序</p>\n<details class="exercise-answer" data-mock-question="${number}"><summary>展开本题答案与完整解析 <span aria-hidden="true">＋</span></summary><div class="answer-body">${answer}</div></details>\n`;
  }).join('\n') + '</section>\n';
}

const outputDocs = docs.map(doc => {
  const headings = [];
  let html = renderMarkdown(cleanMarkdown(doc.markdown, doc), doc, { headings, applyDiagrams: true, injectAnswers: doc.kind === 'lesson' });
  if (doc.id === 'd5' && html.includes('<!-- ICS_MOCK_REVIEW -->')) {
    html = html.replace('<!-- ICS_MOCK_REVIEW -->', renderMockReview(headings));
  }
  return { id: doc.id, title: doc.title, shortTitle: doc.shortTitle, kind: doc.kind, day: doc.day, html, headings, sourcePath: path.relative(PROJECT, doc.sourcePath).split(path.sep).join('/') };
});
diagnostics.diagrams = mappings.map(({ doc, kind, needle, file, index, hits }) => ({ doc, kind, needle: needle.slice(0, 120), file, index, hits, status: hits === 1 ? 'matched' : hits === 0 ? 'missing' : 'ambiguous' }));
diagnostics.missingSources = [...new Set(diagnostics.missingSources.map(p => path.isAbsolute(p) ? path.relative(PROJECT, p) : p))];
diagnostics.filteredLines = diagnostics.filteredLines.map(item => ({...item, text: item.text.replaceAll(PROJECT, '.') }));
const badDiagrams = diagnostics.diagrams.filter(d => d.hits !== 1);
fs.mkdirSync(path.join(ROOT, 'vendor', 'katex'), { recursive: true });
const katexRoot = path.dirname(require.resolve('katex/package.json'));
fs.copyFileSync(path.join(katexRoot, 'dist', 'katex.min.css'), path.join(ROOT, 'vendor', 'katex', 'katex.min.css'));
fs.cpSync(path.join(katexRoot, 'dist', 'fonts'), path.join(ROOT, 'vendor', 'katex', 'fonts'), { recursive: true });
fs.copyFileSync(path.join(path.dirname(require.resolve('highlight.js/package.json')), 'styles', 'github.css'), path.join(ROOT, 'vendor', 'highlight.css'));
fs.copyFileSync(path.join(katexRoot, 'LICENSE'), path.join(ROOT, 'vendor', 'katex', 'LICENSE'));
atomicWrite(path.join(ROOT, 'build-diagnostics.json'), JSON.stringify(diagnostics, null, 2));
for (const item of diagnostics.diagrams) console.log(`[diagram] ${item.doc}/${item.kind} ${item.file}:${item.index}: ${item.hits} hit(s) ${item.status}`);
if (diagnostics.mathErrors.length || badDiagrams.length) {
  console.error(JSON.stringify({ mathErrors: diagnostics.mathErrors, diagramErrors: badDiagrams }, null, 2));
  throw new Error('构建校验未通过，未覆盖上一次成功的 content.js。请检查 build-diagnostics.json。');
}
const generatedAt = new Date().toISOString();
const payload = { docs: outputDocs, generatedAt, sourceMap, publicRelease: true };
const version = digest(JSON.stringify({ docs: outputDocs, sourceMap })).slice(0, 20);
payload.version = version;
atomicWrite(path.join(ROOT, 'content.js'), `/* Generated locally by scripts/build.mjs. Edit Markdown sources instead. */\nwindow.ICS_CONTENT = ${JSON.stringify(payload).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};\n`);
atomicWrite(path.join(ROOT, 'source-map.json'), JSON.stringify(sourceMap, null, 2));
atomicWrite(path.join(ROOT, 'build-version.json'), JSON.stringify({ version, generatedAt, docs: outputDocs.length, mathCount: diagnostics.mathCount, diagrams: mappings.length }));
console.log(`[build] ${outputDocs.length} documents; ${diagnostics.mathCount} math renderings; ${mappings.length} diagrams; ${diagnostics.answers.length} collapsed answers; ${Object.keys(sourceMap).length} source entries.`);
console.log(`[build] version=${version}; mathErrors=0; missingSources=${diagnostics.missingSources.length}`);
if (diagnostics.missingSources.length) console.warn('[source warnings]', diagnostics.missingSources);
