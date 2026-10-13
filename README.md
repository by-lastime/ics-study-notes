# ICS 计算机系统复习笔记

围绕整数、浮点、汇编、控制流、过程调用、数据布局与内存安全整理的复习讲义，包含例题、独立练习、答案、图解和补充问答。

> **持续更新中｜课程尚未结束**
> 
> 内容更新至：2026-10-12 · 本次发布整理：2026-10-13

## 当前范围

当前覆盖课程前 8 讲：五讲基础复习，加第六讲测后重点补强；尚未覆盖整门课程。复习讲次与原课程讲次不同。

统一使用课程的 x86-64、Linux、AT&T 汇编与常见 System V 调用约定；具体题目另给条件时以题目为准。

## 开始阅读

- [在线 HTML 阅读](https://by-lastime.github.io/ics-study-notes/)：无需安装。
- [下载完整仓库 ZIP](https://github.com/by-lastime/ics-study-notes/archive/refs/heads/main.zip)：解压后打开 `site/index.html`，保留同目录的资源文件。
- [Markdown 源稿](content/)：用于查看原文与追溯修订。

## 内容目录

- [阅读指南](https://by-lastime.github.io/ics-study-notes/#doc=overview)
- [第1讲：整数与汇编入门](https://by-lastime.github.io/ics-study-notes/#doc=d1)
- [第2讲：浮点与条件分支](https://by-lastime.github.io/ics-study-notes/#doc=d2)
- [第3讲：循环与过程调用](https://by-lastime.github.io/ics-study-notes/#doc=d3)
- [第4讲：数据布局与内存安全](https://by-lastime.github.io/ics-study-notes/#doc=d4)
- [第5讲：完整测验与考前整理](https://by-lastime.github.io/ics-study-notes/#doc=d5)
- [第6讲：测后重点补强](https://by-lastime.github.io/ics-study-notes/#doc=d6)
- [汇编命令三栏速查表](https://by-lastime.github.io/ics-study-notes/#doc=command-reference)
- [往年题精选 · 44题](https://by-lastime.github.io/ics-study-notes/#doc=past-bank)
- [往年题筛选说明](https://by-lastime.github.io/ics-study-notes/#doc=past-bank-guide)
- [五天复习计划](https://by-lastime.github.io/ics-study-notes/#doc=plan)
- [补充问答目录 · Q001–Q034](https://by-lastime.github.io/ics-study-notes/#doc=supplements)

## 答案入口

建议先独立尝试，再展开或打开答案。
- [第1讲练习答案](https://by-lastime.github.io/ics-study-notes/#doc=a1)
- [第2讲练习答案](https://by-lastime.github.io/ics-study-notes/#doc=a2)
- [第3讲练习答案](https://by-lastime.github.io/ics-study-notes/#doc=a3)
- [第4讲练习答案](https://by-lastime.github.io/ics-study-notes/#doc=a4)
- [第5讲纠错题答案](https://by-lastime.github.io/ics-study-notes/#doc=repair-answers)
- [2025保留卷完整解析](https://by-lastime.github.io/ics-study-notes/#doc=mock-answers)
- [往年精选题解析](https://by-lastime.github.io/ics-study-notes/#doc=past-bank-answers)

## 使用方式

### 在线与离线 HTML

左侧切换讲次或章节，右上「目录」定位小节，「Aa」调整字号与深浅色。Q 编号链接在当前页面弹窗展示补充解答，关闭后返回阅读位置。公式、字体、代码样式和图表资源随阅读器提供，离线阅读无需联网。

下载 ZIP 后须完整解压，再双击 `site/index.html`。直接双击模式读取已生成内容；源稿修改后需要重新构建并刷新。阅读位置与外观保存在当前浏览器，不代表学习进度。

### PDF 与打印

五讲正文合订本与第六讲补强分开，独立练习答案、保留卷解析和往年题解析另册。

- [ICS第一次小测-正文合订本](https://by-lastime.github.io/ics-study-notes/downloads/ICS%E7%AC%AC%E4%B8%80%E6%AC%A1%E5%B0%8F%E6%B5%8B-%E6%AD%A3%E6%96%87%E5%90%88%E8%AE%A2%E6%9C%AC.pdf)
- [第6讲-测后重点补强](https://by-lastime.github.io/ics-study-notes/downloads/%E7%AC%AC6%E8%AE%B2-%E6%B5%8B%E5%90%8E%E9%87%8D%E7%82%B9%E8%A1%A5%E5%BC%BA.pdf)
- [ICS第一次小测-汇编命令三栏速查表](https://by-lastime.github.io/ics-study-notes/downloads/ICS%E7%AC%AC%E4%B8%80%E6%AC%A1%E5%B0%8F%E6%B5%8B-%E6%B1%87%E7%BC%96%E5%91%BD%E4%BB%A4%E4%B8%89%E6%A0%8F%E9%80%9F%E6%9F%A5%E8%A1%A8.pdf)
- [往年题精选-题目册](https://by-lastime.github.io/ics-study-notes/downloads/%E5%BE%80%E5%B9%B4%E9%A2%98%E7%B2%BE%E9%80%89-%E9%A2%98%E7%9B%AE%E5%86%8C.pdf)
- [独立练习答案册](https://by-lastime.github.io/ics-study-notes/downloads/%E7%8B%AC%E7%AB%8B%E7%BB%83%E4%B9%A0%E7%AD%94%E6%A1%88%E5%86%8C.pdf)
- [2025保留卷解析-完成测验后阅读](https://by-lastime.github.io/ics-study-notes/downloads/2025%E4%BF%9D%E7%95%99%E5%8D%B7%E8%A7%A3%E6%9E%90-%E5%AE%8C%E6%88%90%E6%B5%8B%E9%AA%8C%E5%90%8E%E9%98%85%E8%AF%BB.pdf)
- [往年题精选-独立解析](https://by-lastime.github.io/ics-study-notes/downloads/%E5%BE%80%E5%B9%B4%E9%A2%98%E7%B2%BE%E9%80%89-%E7%8B%AC%E7%AB%8B%E8%A7%A3%E6%9E%90.pdf)

## 来源与使用约定

参考 CS:APP 对应章节、课程前 8 讲课件、普通研讨材料与已标明出处的往年题。原题、截取、改编和补充题在正文中区分；整理解析不是官方评分答案。

本仓库发布整理后的复习笔记、教学问答、必要插图和对应阅读器。原始教材、课件、扫描试卷、实验工程和个人学习记录未随仓库分发；来源名称、章节及页码保留供核对。原内容署名与权利按来源保留。阅读器依赖说明见 [ORIGIN.md](ORIGIN.md)。

## 更新与维护

Markdown 是内容源稿。补充、更正先改 `content/`，随后构建 HTML；需要更新打印版时再导出 PDF。生成的 `site/content.js` 不单独维护。

```sh
npm ci
npm run build
npm start
```

本地 HTTP 阅读入口为 `http://127.0.0.1:8765`；也可直接打开 `site/index.html`。

导出 PDF 需要 Playwright 的 Chromium 与 Python `pypdf`：

```sh
npx playwright install chromium
npm run pdf
```

推送 `main` 后，GitHub Actions 构建并更新 HTML 阅读网站。PDF 为已核对的发布副本；网页构建不会自动重排 PDF。后续新增课程范围与修订记录会在此更新。

## 发布记录

- 2026-10-13：整理当前阶段笔记，建立独立仓库，提供在线与离线 HTML、PDF 和补充问答入口；标记持续更新。
