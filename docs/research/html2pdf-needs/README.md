# html2pdf.js 用户需求调研报告

> 调研对象：[eKoopmans/html2pdf.js](https://github.com/eKoopmans/html2pdf.js)（npm `latest` = 0.14.0）
> 采集时间：2026-11-03　|　一手来源：GitHub Issues / Issue Comments / PRs / Releases / 源码
> 用途：为 Web Printer 3.0 的差异化定位提供需求侧依据
> 配套文件：[对照基线](./00-web-printer-baseline.md) · [分页主题深度调研](./01-pagination.md) · [机读索引](./needs-index.json)

---

## 0. 方法与口径（先读这一节，否则下面的数字会被误用）

### 0.1 语料范围

| 项 | 数量 | 来源 |
| --- | ---: | --- |
| Issue（含 PR 共 1031 条） | **681** | `gh api repos/eKoopmans/html2pdf.js/issues`（全量拉取） |
| Pull Request | 350 | 同上（`pull_request` 字段区分） |
| Issue 评论 | **1972** | 681 个 issue 的 comments 全量拉取 |
| 独立 Issue 作者 | **597** | `user.login` 去重 |
| 维护者评论 | **345**（占 17.5%） | 仅 `eKoopmans` 一人 |

**去重规则**：同一根因的多个 issue（如「页数太多」散落在 #19/#71/#161/#311/#517）合并为一个「需求项」，
报告人数按**该需求项下不重复的 Issue 作者数**统计。评论区参与人数另计为参考值（噪声更大，本报告以作者数为准）。

### 0.2 「已确认缺陷」的判定标准 —— 本报告最重要的纪律

**用户投诉 ≠ 已确认缺陷。** 全库 681 条 issue 中：

- 只有 **23 条**带 `bug` 标签、26 条 `enhancement`、15 条 `question`（标签覆盖率仅 11%）；
- 只有 **163 条** issue 收到过维护者回复，**194 条零评论**；
- 维护者极少使用「这是 bug」这类明确措辞（用正则扫描 345 条维护者评论，仅 5 条命中）。

因此本报告**不以标签判定**，而按以下四级分类，每条都给出判定依据：

| 分类 | 判定依据 |
| --- | --- |
| **已确认缺陷** | 维护者明确承认（"that looks like a problem"、"a known issue"、承认是自己的克隆逻辑问题）或已合并修复 PR |
| **设计限制** | 维护者说明这是架构的必然结果（"that's intended behaviour"、"canvases have a maximum size that I can't fix"） |
| **配置错误** | 维护者指出根因在用户侧（错误配置、缺 CORS、错用 `y` 选项、用例与文档不符） |
| **未决** | issue 仍 open，维护者从未回复或未给结论 |

### 0.3 局限

1. 需求强度用**关键词聚类 + 人工核对**得出。**误差带随需求口径宽度变化**，已实测：
   - 窄口径需求（如 N06 页码、N24 可搜索文本）误差 ±2 条；
   - **宽口径需求误差可达 ±12 条**——以 N20（Node/打包器）为例，关键词聚类得 42 条，
     用严格正则（`SSR|node|webpack|require\(|window is not defined|self is not defined…`）复算只有 **30 条**，
     被误纳的 12 条包含阿拉伯文空格（#425/#490/#544）、CSS 未生效（#219）等明显不相关项。
     §4 已按此给出严格复算后的对照列。**结论不受影响**：N20 复算后仍居前列，但本就判定为"配置错误为主、不构成机会"。
2. 报告人数只统计**公开 GitHub 账号**，沉默用户不可见；issue 活跃度本身受项目热度影响（见第 1 节）。
3. 2020–2026 年维护者几乎不回复，本报告对"当前是否仍存在"的判断基于**当前 issue 状态 + 维护者最后一次明确表态**，
   而非实际复现。标注为"未决"的不等于"仍然有 bug"。
4. **2 条 issue 的评论无法通过 API 取回**（#999、#981）：issue 载荷显示 `comments: 1`，
   但 `/comments` 与 `/timeline` 均返回空数组（疑似 GitHub 计数残留）。两条均与本报告结论无关。

---

## 1. 项目状态与维护者立场（决定所有需求的天花板）

### 1.1 维护活跃度：单点维护 + 功能停滞

| 指标 | 值 | 来源 |
| --- | --- | --- |
| Stars / Forks | 4933 / 1716 | `repos/eKoopmans/html2pdf.js` |
| License | MIT | 同上 |
| 仓库创建 | 2017-03-29 | 同上 |
| 最后一次功能发布 | **v0.14.0 · 2026-01-12T01:18Z** | `releases` |
| `main` 最后一次提交 | 2026-07-22（仅 `package-lock.json`） | `commits?sha=main` |
| v0.14.0 发布**之后**的合并 | **仅 2 次**，均为发布工具链（2026-02-09：OIDC 发布 [#909](https://github.com/eKoopmans/html2pdf.js/pull/909)、semantic-release 升级 [#910](https://github.com/eKoopmans/html2pdf.js/pull/910)） | `pulls?state=closed` |
| 非机器人合并 PR（按年） | 2018:4 / 2019:2 / 2021:5 / 2024:5 / **2025:17** / 2026:4（其中 2 次属 v0.14.0 本身） | `pulls?state=closed` |
| 未合并 PR | **29 条，最早 #41（2017-10-16）、#170（2018-11-04）** | `pulls?state=open` |

> `pushed_at` 停在 2026-11-02 看似活跃，但那是 `ghworkflow/package_lock_auto_update` 分支每日提交
> `package-lock.json` 造成的噪音。**实测：v0.14.0（2026-01-12）之后 `main` 上的 100+ 次提交，
> 全部是 `Updating package-lock.json (#NNNN)`，代码变更数为 0。**
>
> 需要区分清楚的是：2026-01-11/12 确有两次真实改动（[#876](https://github.com/eKoopmans/html2pdf.js/pull/876) 测试工具、
> [#877](https://github.com/eKoopmans/html2pdf.js/pull/877) 修复 XSS 漏洞），但它们**被打进 v0.14.0 本身**，
> 不构成发布后的持续开发。

**维护者本人对状态的表述**（一手原文）：

> "Not abandoned, but it was fairly dormant." —— [#750](https://github.com/eKoopmans/html2pdf.js/issues/750)（2025-08-27）

> "…about a year ago I committed to not making further changes until I had some reliable automated testing. The task proved larger than I expected… I'm sorry this repo has been silent recently." —— [#426](https://github.com/eKoopmans/html2pdf.js/issues/426)（2021-04-25）

### 1.2 维护者回应能力随时间衰减

| 年份 | 新建 issue | 维护者评论 |
| --- | ---: | ---: |
| 2017 | 61 | 126 |
| 2018 | 104 | 79 |
| 2019 | 71 | 86 |
| 2020 | 93 | 4 |
| 2021 | 112 | 17 |
| 2022 | 96 | 2 |
| 2023 | 48 | 0 |
| 2024 | 47 | 2 |
| 2025 | 32 | 25 |
| 2026 | 17 | 4 |

**新建 issue 逐年下降（112 → 17），积压却涨到 473 条 open**；维护者 2020 年后基本不再回应。
这是典型的"功能停滞 + 社区自建 workaround"形态。

### 1.3 维护者主动劝退：官方推荐换库

这是本次调研对定位**最关键**的发现。维护者在多个 issue 中明确把用户导向服务端方案：

> "The de facto standard for html->PDF generation is **wkhtmltopdf**." —— [#56](https://github.com/eKoopmans/html2pdf.js/issues/56)（2018-01-27）

> "Server-side options are a lot more robust right now - wkhtmltopdf is a great tool. **Sorry html2pdf didn't work out!**" —— [#66](https://github.com/eKoopmans/html2pdf.js/issues/66)（2018-02-03）

> "…I strongly recommend using a server-side solution - you can setup wkhtmltopdf on your server and call it using PHP/etc, **it will produce better results than html2pdf**." —— [#148](https://github.com/eKoopmans/html2pdf.js/issues/148)（2018-09-15）、[#5](https://github.com/eKoopmans/html2pdf.js/issues/5)

> "…my advice is always to **favour a backend PDF tool like wkhtmltopdf** if it fits your use case - html2pdf.js is specifically for projects that need to generate the PDF in the frontend." —— [#478](https://github.com/eKoopmans/html2pdf.js/issues/478)（2021-09-17）

**含义**：html2pdf.js 官方并未把"浏览器端高质量 PDF"当成自己的战场。需求强度评估必须扣除"服务端/换库"这条官方背书的出路，
否则会系统性高估浏览器端方案的机会。

### 1.4 用户实际的迁出方向

> 口径：对 681 条 issue 的正文 + 1963 条评论做全量正则扫描（关键词表见附录），命中即计入该 issue。
> ⚠️ **该计数含"维护者劝退"造成的间接提及**——例如 wkhtmltopdf 的 8 条命中里，只有 #106 出现在 issue 正文
> （用户自己提出），其余多为维护者回复中的建议（见 §1.3）。§6 已把这一项列为待定。

| 去向 | 出现 issue 数 | 代表 issue |
| --- | ---: | --- |
| 服务端渲染（泛指 server-side / backend） | 20 | [#397](https://github.com/eKoopmans/html2pdf.js/issues/397)、[#19](https://github.com/eKoopmans/html2pdf.js/issues/19)、[#181](https://github.com/eKoopmans/html2pdf.js/issues/181)、[#5](https://github.com/eKoopmans/html2pdf.js/issues/5) |
| wkhtmltopdf | 8 | [#66](https://github.com/eKoopmans/html2pdf.js/issues/66)、[#148](https://github.com/eKoopmans/html2pdf.js/issues/148)、[#181](https://github.com/eKoopmans/html2pdf.js/issues/181)、[#478](https://github.com/eKoopmans/html2pdf.js/issues/478) |
| 浏览器原生打印（明确改用） | 2 | [#44](https://github.com/eKoopmans/html2pdf.js/issues/44)（改用 PrintThis，触发浏览器打印命令）、[#285](https://github.com/eKoopmans/html2pdf.js/issues/285)（iframe + `contentWindow.print()`） |
| 浏览器原生打印（仅作**对照预期**，未改用） | 2 | [#341](https://github.com/eKoopmans/html2pdf.js/issues/341)（"print the page using chrome print command I get Thead on every page"）、[#372](https://github.com/eKoopmans/html2pdf.js/issues/372) |
| pdfmake | 2 | [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)、[#56](https://github.com/eKoopmans/html2pdf.js/issues/56) |
| Puppeteer | 1 | [#332](https://github.com/eKoopmans/html2pdf.js/issues/332)（"I finally didn't use html2pdf instead of this I use Puppeteer"） |
| **浏览器内 fork `html3pdf`** | **5** | [#599](https://github.com/eKoopmans/html2pdf.js/issues/599)、[#601](https://github.com/eKoopmans/html2pdf.js/issues/601)、[#643](https://github.com/eKoopmans/html2pdf.js/issues/643)、[#661](https://github.com/eKoopmans/html2pdf.js/issues/661)、[#721](https://github.com/eKoopmans/html2pdf.js/issues/721) |
| react-to-pdf | 1 | [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) |
| dompdf.js | 2 | [#721](https://github.com/eKoopmans/html2pdf.js/issues/721)、[#733](https://github.com/eKoopmans/html2pdf.js/issues/733) ⚠️ 两条均由 dompdf.js 作者本人（`lmn1919`）发出，属自我推荐 |

最直白的迁出证词（[#397](https://github.com/eKoopmans/html2pdf.js/issues/397)，iOS 空白 PDF，2025-04-20）：

> "No solution, I changed the pdf library to server side i am also moving to server side"

### 1.5 库自己承认的限制：README "Known issues"（最强的"已确认"证据）

html2pdf.js 的 README 自带 "Known issues" 章节，**官方逐条承认了本报告中的主要缺口**。
这是本次调研中最硬的一手证据——不需要推断维护者意图：

> **1. Rendering:** The rendering engine html2canvas isn't perfect (though it's pretty good!). **If html2canvas isn't rendering your content correctly, I can't fix it.**

> **2. Node cloning (CSS etc):** **The way html2pdf.js clones your content before sending to html2canvas is buggy.** A fix is currently being developed…

> **3. Resizing:** Currently, html2pdf.js resizes the root element to fit onto a PDF page (causing internal content to "reflow")… **There are plans to add alternate behaviour (e.g. "shrink-to-page"), but nothing that's ready to test yet.**

> **4. Rendered as image:** html2pdf.js renders all content into an image, then places that image into a PDF. This means **text is *not selectable or searchable***, and causes large file sizes. **This is currently unavoidable**…

> **6. Maximum size:** HTML5 canvases have a maximum height/width. **Anything larger will fail to render.** This is a limitation of HTML5 itself, and **results in large PDFs rendering completely blank in html2pdf.js.**

（来源：`repos/eKoopmans/html2pdf.js/readme`，2026-11-03 抓取）

**这张表直接给出四类缺口的官方定性**：

| README Known issue | 对应本报告需求 | 官方定性 |
| --- | --- | --- |
| #1 Rendering | N12 / N13 / N14 / N15 / N17 | **上游天花板，"我修不了"** |
| #2 Node cloning | N11 CSS 未生效 | **自身缺陷，"is buggy"** |
| #3 Resizing | N16 fit-to-width / 单页 PDF | 计划中，无可测版本 |
| #4 Rendered as image | N24 可搜索文本 | "currently unavoidable" |
| #5 Promise clashes | N20 集成 | 已知冲突 |
| #6 Maximum size | N01 长文档空白 | **"results in large PDFs rendering completely blank"** |

### 1.6 真实迁出方向 ≠ 维护者建议方向（重要修正）

§1.3 说维护者反复劝用户去服务端；但**用户实际的迁出方向是浏览器内的 fork**。

社区 fork **`html3pdf`**（合并了大量未合入的 PR）是最集中的迁出目标，其解法正是
**"每页独立渲染一个 canvas"**：

> "html2pdf.js creates one single html canvas with all of the content and then converts that to a pdf. The problem is that browsers have a limit on how big a canvas can be, so for large documents the pdf ends up just being blank. **html3pdf … solves this by rendering each page on its own canvas** (although this is much slower)." —— davidnbooth，[#599](https://github.com/eKoopmans/html2pdf.js/issues/599)（2023-08-09）

> "**For me the fix for iOS was simply to change html2pdf to html3pdf.**" —— LuuHoangVu，[#601](https://github.com/eKoopmans/html2pdf.js/issues/601)（2024-01-26）

> "You could try html3pdf, which is **a fork of this library with a lot of the existing PRs merged into it**" —— davidnbooth，[#643](https://github.com/eKoopmans/html2pdf.js/issues/643)

> "I've searched about this problem and **many users mentioned html3pdf package**" —— pouryasanboy，[#721](https://github.com/eKoopmans/html2pdf.js/issues/721)（2024-10-01）

其他迁出目标：[#509](https://github.com/eKoopmans/html2pdf.js/issues/509)（DKpdf，"I decided to use DKpdf für my project"）、
[#227](https://github.com/eKoopmans/html2pdf.js/issues/227)（react-to-pdf）、
[#489](https://github.com/eKoopmans/html2pdf.js/issues/489)（放弃内建 pagebreak，改 flex 横排 + html-to-image 自行截图）、
[#721](https://github.com/eKoopmans/html2pdf.js/issues/721) 与 [#733](https://github.com/eKoopmans/html2pdf.js/issues/733)（dompdf.js，
⚠️ **两条推荐均由 dompdf.js 作者本人发出**，属自我推荐，采信需注意）。

**这条发现修正了 §1.4 的读法**：服务端是维护者的**建议**，而浏览器内 fork 是用户的**实际选择**。
对 Web Printer 3.0 的含义是——**"把分页做对的浏览器端替代品"有明确且未被满足的受众**，
且 `html3pdf` 的核心解法（逐页渲染）与 Web Printer 的技术路线一致，说明这条路已被市场验证。

### 1.7 维护者自己做过正确解法，但没有发布

仓库里仍留着四个长期未合并的维护者分支，其中两个**正是本报告最大缺口的正确答案**：

| 分支 | 最后提交 | 内容 | 对应缺口 |
| --- | --- | --- | --- |
| **`feature/jspdf-canvas`** | **2019-02-10**（"Update jsPDF for canvas functionality"） | 改用 jsPDF 的 canvas renderer 逐页渲染，**绕开单张超大 canvas** | N01 长文档空白 + N24 位图输出 |
| **`bugfix/pagebreak-tables`** | **2019-01-22** | 表格专用分页修复（曾向 [#184](https://github.com/eKoopmans/html2pdf.js/issues/184) 用户提供） | N04 表格跨页 |
| `bugfix/clone-nodes` | 2025-08-23 | 节点克隆修复（实际已由 PR #792 在 main 落地） | N11 CSS 未生效 |
| `pdf-callback` | 2017-11-30 | 早期取 jsPDF 对象的 API（已被新 API 取代） | N09 |

**含义**：维护者早在 2019-02 就把"不用单张超大 canvas"的方案写出来了（对应 README Known issue #6
提到的"The jsPDF canvas renderer may be able to fix this issue!"），**此后 7 年未发布**。
这从维护者一侧再次确认：(a) 缺口真实且官方早已识别；(b) Web Printer 走的逐页渲染路线是
**被官方认可但始终没落地**的方向。

维护者本人对这条路线（含矢量输出）的表态，一字不改地摘录：

> "Second, the central issue here is that **HTML canvases are just broken, and have a maximum size that I can't fix**. I've investigated creating a 'fake' canvas that stitches together multiple canvases… **However**, there's a recent development that may fix this issue as well as a few other big problems. **jsPDF has a built-in canvas 'engine', which means we could draw straight into jsPDF! This would also mean vector graphics (highlightable text, small files, all that jazz). It's very promising and it's high on my to-do list for this project.**" —— [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)（2019-01-20）

> **这段话同时支撑 §5.2 的 O1（逐页渲染解法）与 O5（矢量 PDF）**——两者都是维护者亲口认定的方向，
> 且明确说"on my to-do list"，但至今未出现在任何 release 里。

---

## 2. 需求主题分类

按用户请求的四类主题归并，**同一 issue 可能同时命中多个需求项**（如 #19 既属性能又属分页），
故下表 issue 数之和大于 681。

### 2.1 分页与页面结构

| 需求 | 独立作者 | issue | open | 维护者回复 | 状态 | 分类 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| N02 内容被截断 / 跨页切开 | 33 | 33 | 28 | 8 | **仍存在** | 设计限制 |
| N03 pagebreak / avoid 配置不生效 | 23 | 23 | 20 | 8 | **仍存在** | 设计限制 |
| N04 表格跨页：表头不重复 / 行被劈开 | 18 | 18 | 15 | 2 | **仍存在** | 设计限制 |
| N05 页眉 / 页脚 | 22 | 22 | 13 | 6 | **仍存在** | 能力缺失 |
| N06 页码 | 13 | 13 | 11 | 5 | **仍存在** | 能力缺失 |
| N23 超链接失效 | 14 | 14 | 12 | 2 | 部分配置错误 | 混合 |

> **N23 的人工复核说明**：该需求用"标题级显式超链接语义"逐条筛出 14 条（#61/#132/#155/#174/#283/#335/#344/#389/#395/#520/#585/#611/#669/#725），
> 剔除了 #366（cdn links 指图片链接）与 #853（"linked to" 习语），也剔除了关键词误纳的 9 条
> （#19/#33/#72/#139/#142/#281/#311/#465/#659）。**N23 是本报告中唯一一条经过逐条人工复核的需求**——
> 它同时是 §5.2 的 O2，所以值得这份额外成本。其余需求采用关键词聚类，误差带见 §0.3。

**根因（维护者原话）**：

> "At the moment that's intended behaviour. All html2pdf is doing is converting the webpage into an image, and then slicing that image onto separate PDF pages. If your text (or any other component) straddles two pages, it will appear sliced." —— [#13](https://github.com/eKoopmans/html2pdf.js/issues/13)（2017-06-03）

**分页配置为何不管用**：

> "…tables are tricky and don't behave like most other elements, they may still need some work. My guess is it boils down to **tables not behaving like everything else, and I may need to program in a special case for that. No promises on timeline though, there's a long list of things that need work!**" —— [#184](https://github.com/eKoopmans/html2pdf.js/issues/184)（2019-01-17）

> "Page-breaks are still not perfect, especially when tables are involved" —— [#227](https://github.com/eKoopmans/html2pdf.js/issues/227)（2019-05-19）

**页码是"关闭"而非"修复"**：[#21](https://github.com/eKoopmans/html2pdf.js/issues/21) 于 2019-01-19 被维护者以
"Closing as resolved by [社区帖]"关闭 —— 即**靠用户手写 jsPDF 遍历页对象的 workaround 关闭**，库本身从未提供该能力。

**仍然活跃的现场（2026 年）**：
[#83](https://github.com/eKoopmans/html2pdf.js/issues/83)「text is cut in the middle」2026-10-21 仍有讨论；
[#1043](https://github.com/eKoopmans/html2pdf.js/issues/1043)（2026-08-18 创建）「pagebreak.avoid can split elements across page boundaries」**零评论**；
[#393](https://github.com/eKoopmans/html2pdf.js/issues/393) 每页偏移 1px，2026-10-21 仍有活动。

**页眉页脚/页码的典型绕行成本**：
[#208](https://github.com/eKoopmans/html2pdf.js/issues/208)、[#230](https://github.com/eKoopmans/html2pdf.js/issues/230)、
[#526](https://github.com/eKoopmans/html2pdf.js/issues/526)（"header and footer are not showing on every page"）、
[#278](https://github.com/eKoopmans/html2pdf.js/issues/278)（"How to add page numbers at the top"）——
**全部零维护者回复**，社区靠手写 jsPDF 分页回调解决。

### 2.2 视觉保真

| 需求 | 独立作者 | issue | open | 分类 |
| --- | ---: | ---: | ---: | --- |
| N12 图片 / SVG / 跨域不渲染 | 38 | 38 | 26 | 多为 html2canvas 上游 + 配置错误 |
| N13 字体 / CJK / 阿拉伯文 | 18 | 18 | 16 | 上游 + 字体栈配置 |
| N17 现代 CSS（oklch / grid / flex） | 21 | 21 | 17 | **上游天花板** |
| N10 `@media print` 被忽略 | 6 | 6 | 5 | **上游天花板** |
| N11 CSS 未生效 / 外部样式表 | 5 | 5 | 5 | 部分已修 |
| N14 背景色 / 打印背景 | 7 | 7 | 7 | 上游天花板 |
| N15 `position:absolute` 错乱 | 4 | 4 | 4 | 上游天花板 |
| N16 表格宽度自适应 | 4 | 4 | 3 | 设计限制 |
| N24 可搜索 / 可选中文本 | 6 | 6 | 4 | **架构天花板** |
| N18 表单字段 | 11 | 11 | 8 | 能力缺失 |

**上游归因是本主题的关键结论**：

> "…the black bars are caused by an html2canvas issue with offscreen rendering… **that offscreen rendering issue is an unavoidable bug in html2canvas. There's no way I could fix it from the outside.**" —— [#2](https://github.com/eKoopmans/html2pdf.js/issues/2)（2017-05-12）

> "It's a known issue in html2canvas, I have submitted a pull request to try to resolve the problem, but it hasn't been accepted yet" —— [#10](https://github.com/eKoopmans/html2pdf.js/issues/10)（2017-05-15）

> "…it sounds like it's a defect there [in html2canvas], so the only immediate solution would be using an earlier version of html2canvas or **switching to an entirely different dependency**." —— [#751](https://github.com/eKoopmans/html2pdf.js/issues/751)（2025-07-10）

**`@media print` 是维护者想做但没做的功能**：

> "…creating a PDF is like printing, and it would be best to support printing-related features. That said, if we want the feature then we have to implement it! I've investigated and I think this is doable. It would require altering the stylesheets in html2canvas's clone." —— [#79](https://github.com/eKoopmans/html2pdf.js/issues/79)（2019-01-26）　**至今 open，维护者只有一次回复。**

**文本层缺失**：

> "Yeah, right now the PDF is generated first as an image, so any text information is lost, unfortunately. Rendering the text straight to PDF would be ideal but **there aren't really any client-side options for that**." —— [#56](https://github.com/eKoopmans/html2pdf.js/issues/56)（2017-12-07）

**CSS 克隆问题（维护者认领为自身缺陷，后部分修复）**：

> "I suspect this is related to **the way nodes are currently cloned in html2pdf.js**. If so, it's something I've been meaning to fix for ages." —— [#219](https://github.com/eKoopmans/html2pdf.js/issues/219)（2019-05-19）
> → 后由 [#792](https://github.com/eKoopmans/html2pdf.js/pull/792)（2025-08-31，改用 `@zumer/snapdom` deepClone）修复。

### 2.3 性能、规模与长文档可靠性

| 需求 | 独立作者 | issue | open | 分类 |
| --- | ---: | ---: | ---: | --- |
| N01 长文档导出失败 / 空白 | 32 | 34 | 26 | **设计限制（维护者明言无解）** |
| N19 导出卡死 / UI 无响应 | 13 | 13 | 9 | 设计限制 + 部分配置错误 |
| N25 滚动容器导出 | 38 | 39 | 30 | 多为配置错误 |

**这是全库最高信号、且被维护者明确承认无解的缺口**（[#19](https://github.com/eKoopmans/html2pdf.js/issues/19)，64 条评论，全库第一）：

> "Yes, I see the problem. I've reproduced it here using only html2canvas, which html2pdf relies on. The problem is in fact deeper than that - it's a problem directly in how canvases work. **Canvases have a maximum height/width, and once you exceed that the canvas becomes unusable!**" —— 2017-07-16

> "**HTML canvases are just broken, and have a maximum size that I can't fix.** I've investigated creating a 'fake' canvas that stitches together multiple canvases, and it might be worth the effort to try to create such a thing, but I haven't had the chance to." —— 2019-01-20

同一结论在 [#71](https://github.com/eKoopmans/html2pdf.js/issues/71)、
[#161](https://github.com/eKoopmans/html2pdf.js/issues/161)（"There is no current fix!"）、
[#311](https://github.com/eKoopmans/html2pdf.js/issues/311)、[#517](https://github.com/eKoopmans/html2pdf.js/issues/517)、
[#397](https://github.com/eKoopmans/html2pdf.js/issues/397)（iOS）反复出现。

**用户在 workaround 之外还提出了"库应该自己先检测"的要求**（[#351](https://github.com/eKoopmans/html2pdf.js/issues/351)，
Firefox `NS_ERROR_FAILURE`，2020-09 起 6 条评论，维护者从未回复）：

> "Can you add code that checks whether the size of html canvas exceeds the canvas size supported by browser. If yes, then the rendering should stop." —— kirtipriya，2020-09-11

> 这条诉求的性质值得注意：用户要的**不是"别失败"，而是"失败前先告诉我"**——
> 即"明确报错而非静默产出空白页"。Web Printer 3.0 在这一点上已有对应能力
> （导出失败语义明确，见 `docs/output-formats.md`），但**没有"画布尺寸预检"这一具体形态**。

**规模类 issue 的现状**：26 条仍 open，最近活动集中在 2024–2026；
[#83](https://github.com/eKoopmans/html2pdf.js/issues/83)、[#393](https://github.com/eKoopmans/html2pdf.js/issues/393) 2026-10-21 仍有讨论。

### 2.4 API、集成与使用体验

| 需求 | 独立作者 | issue | open | 分类 |
| --- | ---: | ---: | ---: | --- |
| N21 框架集成（React/Vue/Angular） | 85 | 87 | 61 | **多为使用问题** |
| N20 Node / 打包器 / SSR | 42 | 42 | 25 | **多为配置错误** |
| N22 隐藏 / 排除部分内容 | 28 | 28 | 21 | 已有解法 |
| N09 拿 Blob 而非自动下载 | 17 | 17 | 11 | **已修复（v0.9.0 起）** |
| N07 进度反馈 | 6 | 6 | 4 | 能力缺失 |

**已修复的 API 能力**（维护者 2017–2018 年给出分支与新 API，最终随 v0.9.0 / v0.11.0 落地）：
[#14](https://github.com/eKoopmans/html2pdf.js/issues/14)、[#5](https://github.com/eKoopmans/html2pdf.js/issues/5)、
[#54](https://github.com/eKoopmans/html2pdf.js/issues/54)、[#181](https://github.com/eKoopmans/html2pdf.js/issues/181)、
[#89](https://github.com/eKoopmans/html2pdf.js/issues/89) —— 统一为 `.output()` / `.save()` 返回 Promise。

**配置错误实例（维护者纠正根因在用户侧）**：

> "The issue is in your use of `y: 0` (or any explicit value for `y`). If you leave it unset, html2canvas should automatically determine the correct y value for the element." —— [#175](https://github.com/eKoopmans/html2pdf.js/issues/175)（2019-02-03）

> "Try out this test Fiddle, which showcases all the different kinds of page-breaks you can use." —— [#184](https://github.com/eKoopmans/html2pdf.js/issues/184)

**"项目是否被弃用"被反复问到**：[#750](https://github.com/eKoopmans/html2pdf.js/issues/750)（维护者："Not abandoned, but it was fairly dormant."）、
[#426](https://github.com/eKoopmans/html2pdf.js/issues/426)（Add new maintainers，仍 open）、
[#668](https://github.com/eKoopmans/html2pdf.js/issues/668)（"Who wasted their time on this?"，6 条评论）。
**社区 PR 不是可行出路**：29 条未合并 PR 中最早的可追溯到 2017 年。

---

## 3. 四分类：已修复 / 旧版本问题 / 配置错误 / 当前仍存在的缺口

### 3.1 已修复（当前版本已具备）

| 需求 | 证据 | 修复版本（按合并日期对齐 release） |
| --- | --- | --- |
| 返回 Blob / dataURL 而非自动下载 | [#89](https://github.com/eKoopmans/html2pdf.js/issues/89)、[#14](https://github.com/eKoopmans/html2pdf.js/issues/14)、[#54](https://github.com/eKoopmans/html2pdf.js/issues/54)、[#181](https://github.com/eKoopmans/html2pdf.js/issues/181) | **v0.9.0**（2018-05 新 API；维护者 2018-09-15 在 [#5](https://github.com/eKoopmans/html2pdf.js/issues/5) 确认 "fully resolved with v0.9.0"）；2025 年由 [#758](https://github.com/eKoopmans/html2pdf.js/pull/758) 重构为原生 Promise（v0.11.0） |
| 外部样式表 / 节点克隆 | [#219](https://github.com/eKoopmans/html2pdf.js/issues/219) | **v0.11.3**（[#792](https://github.com/eKoopmans/html2pdf.js/pull/792) 改用 snapdom deepClone，合并于 2025-08-31） |
| TypeScript 类型 | [#795](https://github.com/eKoopmans/html2pdf.js/pull/795)、[#794](https://github.com/eKoopmans/html2pdf.js/pull/794) | **v0.11.3**（两者合并于 2025-08-31） |
| 资源加载时序（内容未渲染完就截图） | [#770](https://github.com/eKoopmans/html2pdf.js/pull/770) | **v0.11.1**（合并于 2025-08-24） |
| npm 包内缺类型文件 | [#814](https://github.com/eKoopmans/html2pdf.js/pull/814) | **v0.12.1**（合并于 2025-09-17） |

### 3.2 旧版本问题（用户当时的版本已修，当前版本不再复现）

| 症状 | 证据 | 说明 |
| --- | --- | --- |
| 页面出现暗色竖条 / 离屏渲染黑边 | [#2](https://github.com/eKoopmans/html2pdf.js/issues/2)、[#31](https://github.com/eKoopmans/html2pdf.js/issues/31)、[#10](https://github.com/eKoopmans/html2pdf.js/issues/10) | 维护者给出 `html2pdf.bundle.js`（内置已修复的 html2canvas/jsPDF）作为解法；问题在旧版 html2canvas |
| `toPdf()` 在 Chrome 138+ 失效 | [#751](https://github.com/eKoopmans/html2pdf.js/issues/751) | 维护者确认是 html2canvas 缺陷；解法＝回退 html2canvas 版本或换依赖。**该类问题随 html2canvas 版本漂移反复出现，不是"修好了"** |
| jsPDF 回调参数不可用 | [#5](https://github.com/eKoopmans/html2pdf.js/issues/5) | v0.9.0 新 API 后解决 |

### 3.3 配置错误（根因在用户侧，不构成产品缺口）

| 现象 | 维护者指出的根因 | Issue |
| --- | --- | --- |
| 内容整页不显示 | `margin: 10` 配 `unit: 'in'` —— "your margin is **10 inches, which is larger than the page**… Try changing to `margin: 1`" | [#1](https://github.com/eKoopmans/html2pdf.js/issues/1) |
| 滚动容器导出多出空白页 | 显式设置了 `y` 选项 | [#175](https://github.com/eKoopmans/html2pdf.js/issues/175) |
| pagebreak 无效 | "you've set `pagebreak` to `css` mode, which will apply breaks based on CSS properties **which aren't present in your HTML**" | [#752](https://github.com/eKoopmans/html2pdf.js/issues/752) |
| 元素位置异常 | "There is a **good chance** that your `ignoreElements` setting is causing problems. Try removing that" | [#232](https://github.com/eKoopmans/html2pdf.js/issues/232) |
| 图片不显示 | 缺 CORS 头 / `useCORS` 未开 | [#105](https://github.com/eKoopmans/html2pdf.js/issues/105)、[#93](https://github.com/eKoopmans/html2pdf.js/issues/93) |
| 页面太宽压不进一页 | 需业务侧改为自适应宽度 | [#44](https://github.com/eKoopmans/html2pdf.js/issues/44) |
| pagebreak 无效 | 只用了 `mode`、没配 `before/after/avoid` | [#184](https://github.com/eKoopmans/html2pdf.js/issues/184) |
| SSR 下 `self is not defined` | html2pdf.js 面向浏览器，SSR 需动态导入 | [#522](https://github.com/eKoopmans/html2pdf.js/issues/522)、[#644](https://github.com/eKoopmans/html2pdf.js/issues/644) |
| 阿拉伯文尾词前空格丢失 | 业务侧需把空格替换为 `\u00a0` | [#425](https://github.com/eKoopmans/html2pdf.js/issues/425) |

### 3.4 当前仍存在的缺口（**维护者承认、至今未实现**）

| 缺口 | 判定 | 证据 | 状态 |
| --- | --- | --- | --- |
| **长文档超过画布上限 → 空白/失败** | 设计限制 | [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)、[#161](https://github.com/eKoopmans/html2pdf.js/issues/161)、[#71](https://github.com/eKoopmans/html2pdf.js/issues/71)、[#311](https://github.com/eKoopmans/html2pdf.js/issues/311)、[#517](https://github.com/eKoopmans/html2pdf.js/issues/517)、[#397](https://github.com/eKoopmans/html2pdf.js/issues/397) | open |
| **内容被跨页腰斩** | 设计限制（明示 intended behaviour） | [#13](https://github.com/eKoopmans/html2pdf.js/issues/13)、[#83](https://github.com/eKoopmans/html2pdf.js/issues/83)、[#274](https://github.com/eKoopmans/html2pdf.js/issues/274)、[#139](https://github.com/eKoopmans/html2pdf.js/issues/139) | open |
| **表格跨页语义（行被劈开 / 表头不重复）** | 设计限制 | [#184](https://github.com/eKoopmans/html2pdf.js/issues/184)、[#227](https://github.com/eKoopmans/html2pdf.js/issues/227)、[#281](https://github.com/eKoopmans/html2pdf.js/issues/281)、[#1043](https://github.com/eKoopmans/html2pdf.js/issues/1043) | open |
| **页眉 / 页脚 / 页码** | 能力缺失（API 中不存在） | [#21](https://github.com/eKoopmans/html2pdf.js/issues/21)、[#208](https://github.com/eKoopmans/html2pdf.js/issues/208)、[#230](https://github.com/eKoopmans/html2pdf.js/issues/230)、[#526](https://github.com/eKoopmans/html2pdf.js/issues/526)、[#278](https://github.com/eKoopmans/html2pdf.js/issues/278) | open |
| **`@media print` 支持** | 能力缺失（维护者说可行但未做） | [#79](https://github.com/eKoopmans/html2pdf.js/issues/79) | open |
| **进度 / 取消** | 能力缺失 | [#305](https://github.com/eKoopmans/html2pdf.js/issues/305)、[#527](https://github.com/eKoopmans/html2pdf.js/issues/527)、[#197](https://github.com/eKoopmans/html2pdf.js/issues/197) | open |
| **fit-to-width / 表格宽度自适应** | 设计限制（想做未做） | [#44](https://github.com/eKoopmans/html2pdf.js/issues/44) | open |
| **可搜索文本 / 矢量 PDF** | 架构天花板 | [#56](https://github.com/eKoopmans/html2pdf.js/issues/56)「Selectable/Highlightable text?」、[#282](https://github.com/eKoopmans/html2pdf.js/issues/282)「Can you generat real pdf or just as one big image inside pdf?」、[#657](https://github.com/eKoopmans/html2pdf.js/issues/657) | open |
| **可填写表单字段** | 能力缺失 | [#372](https://github.com/eKoopmans/html2pdf.js/issues/372)、[#566](https://github.com/eKoopmans/html2pdf.js/issues/566) | open |
| **跨页表格表头不重复** | 设计限制（单 canvas 架构无法实现） | [#281](https://github.com/eKoopmans/html2pdf.js/issues/281)、[#341](https://github.com/eKoopmans/html2pdf.js/issues/341)、[#554](https://github.com/eKoopmans/html2pdf.js/issues/554)、[#361](https://github.com/eKoopmans/html2pdf.js/issues/361)、[#619](https://github.com/eKoopmans/html2pdf.js/issues/619) | open |
| **逐页累积漂移（每页内容上移 1px）** | **未决**（多位用户独立复现，但维护者未给结论；[#393](https://github.com/eKoopmans/html2pdf.js/issues/393) 作者本人推测"可能是浏览器渲染 glitch"） | [#393](https://github.com/eKoopmans/html2pdf.js/issues/393)（标题即 "every page is off by 1px (per page)"）、[#227](https://github.com/eKoopmans/html2pdf.js/issues/227)（作者 2019-05-14："the top of each page appears to creep up from the start"）、[#583](https://github.com/eKoopmans/html2pdf.js/issues/583)（"Issue of pixel spillover to next page"，2024-03-08 仍有人回"This issue isn't fixed"）、[#708](https://github.com/eKoopmans/html2pdf.js/issues/708) | open |
| **多余空白页 / 分页后额外空白间隙** | 未决（现象明确，机制未定位） | 空白页：[#408](https://github.com/eKoopmans/html2pdf.js/issues/408)（"extra blank page at the end"）、[#672](https://github.com/eKoopmans/html2pdf.js/issues/672)（"avoid-all creates a blank first page"）；空白间隙：[#907](https://github.com/eKoopmans/html2pdf.js/issues/907)（"Large blank space after html2pdf__page-break"，零评论） | open |
| **隐藏元素破坏分页计算** | **维护者已认领为待修**（[#232](https://github.com/eKoopmans/html2pdf.js/issues/232)："If so, I am working on a fix already"，2019-06-03）；**现象本身仍未定论**（[#139](https://github.com/eKoopmans/html2pdf.js/issues/139)、[#466](https://github.com/eKoopmans/html2pdf.js/issues/466) 零维护者结论） | [#139](https://github.com/eKoopmans/html2pdf.js/issues/139)（用户归因 `data-html2canvas-ignore`）、[#466](https://github.com/eKoopmans/html2pdf.js/issues/466)（"Page breaks and hiding elements"，零评论）、[#232](https://github.com/eKoopmans/html2pdf.js/issues/232)（维护者认领修复） | open |
| **混合纸张尺寸 / 纵横向混排** | 设计限制 | [#117](https://github.com/eKoopmans/html2pdf.js/issues/117)、[#437](https://github.com/eKoopmans/html2pdf.js/issues/437)、[#504](https://github.com/eKoopmans/html2pdf.js/issues/504) | open |
| **用户掌控分页（每逻辑页一个 DOM）后合并** | 功能请求 | [#483](https://github.com/eKoopmans/html2pdf.js/issues/483)、[#488](https://github.com/eKoopmans/html2pdf.js/issues/488)、[#187](https://github.com/eKoopmans/html2pdf.js/issues/187) | open |

---

## 4. 需求强度排序

**打分方法**（可复算，权重与上限见 `needs-index.json`）：

```
需求强度 = 0.45 × min(独立报告人数, 60)/60
         + 0.35 × 严重性/3
         + 0.20 × 替代方案成本/3

严重性:   3=导出失败/内容静默丢失  2=布局错误但内容可读  1=体验便利
替代成本: 3=必须换库或自建服务端  2=需改业务源码/DOM hack  1=改配置即可  0=无需绕行
```

> 权重设定理由：独立报告人数权重最高（需求真实性的最强信号），但封顶 60 人以免"框架集成"这类宽口径需求霸榜；
> 严重性次之（导出失败 vs 体验问题对业务是量级差异）；替代方案成本权重最低但作为调节项，
> 因为存在服务端出路的需求，浏览器端方案的价值天然打折。

| # | 需求 | 独立作者 | issue | open | 严重性 | 替代成本 | 强度 | 当前状态 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | N20 Node / 打包器集成 | 42 | 42 | 25 | 3 | 2 | 0.80 | **配置错误为主，不构成机会** |
| 2 | N02 内容被截断 / 跨页切开 | 33 | 33 | 28 | 3 | 3 | 0.80 | **仍存在（高价值）** |
| 3 | N01 长文档失败 / 空白 | 32 | 34 | 26 | 3 | 3 | 0.79 | **仍存在（高价值）** |
| 4 | N21 框架集成 | 85 | 87 | 61 | 2 | 1 | 0.75 | **多为使用问题，不构成机会** |
| 5 | N04 表格跨页（表头 / 行） | 18 | 18 | 15 | 3 | 3 | 0.69 | **仍存在** |
| 6 | N03 pagebreak 不生效 | 23 | 23 | 20 | 3 | 2 | 0.66 | **仍存在** |
| 7 | N25 滚动容器导出 | 38 | 39 | 30 | 2 | 2 | 0.65 | 多为配置错误 |
| 8 | N12 图片 / SVG / 跨域 | 38 | 38 | 26 | 2 | 2 | 0.65 | 上游 + 配置错误 |
| 9 | N05 页眉 / 页脚 | 22 | 22 | 13 | 2 | 3 | 0.60 | **仍存在** |
| 10 | N19 导出卡死 / UI 无响应 | 13 | 13 | 9 | 3 | 2 | 0.58 | **仍存在（部分）** |
| 11 | N06 页码 | 13 | 13 | 11 | 2 | 3 | 0.53 | **仍存在** |
| 12 | N18 表单字段 | 11 | 11 | 8 | 2 | 3 | 0.52 | 仍存在（超出两者范围） |
| 13 | N15 position:absolute 错乱 | 4 | 4 | 4 | 3 | 2 | 0.51 | 上游天花板 |
| 14 | N22 隐藏 / 排除内容 | 28 | 28 | 21 | 2 | 1 | 0.51 | 已有解法 |
| 15 | N13 字体 / CJK / 阿拉伯文 | 18 | 18 | 16 | 2 | 2 | 0.50 | 上游 + 配置 |
| 16 | N24 可搜索文本 | 6 | 6 | 4 | 2 | 3 | 0.48 | 架构天花板 |
| 18 | N17 现代 CSS | 21 | 21 | 17 | 2 | 1 | 0.46 | 上游天花板 |
| 17 | N23 超链接失效 | 14 | 14 | 12 | 2 | 2 | 0.47 | **部分未覆盖** |
| 19 | N09 拿 Blob | 17 | 17 | 11 | 2 | 1 | 0.43 | 已修复 |
| 20 | N10 `@media print` | 6 | 6 | 5 | 2 | 2 | 0.41 | 上游天花板 |
| 21 | N16 表格宽度自适应 | 4 | 4 | 3 | 2 | 2 | 0.40 | 仍存在 |
| 22 | N14 背景色 | 7 | 7 | 7 | 2 | 1 | 0.35 | 上游天花板 |
| 23 | N11 CSS 未生效 | 5 | 5 | 5 | 2 | 1 | 0.34 | 部分已修 |
| 24 | N07 进度反馈 | 6 | 6 | 4 | 1 | 1 | 0.23 | **仍存在（低成本补齐）** |

**对宽口径需求做了严格复算**（见 §0.3 局限 1）：

| 需求 | 关键词聚类 | 严格复算 | 复算后得分 | 排名变化 | 结论是否改变 |
| --- | ---: | ---: | ---: | --- | --- |
| N20 Node / 打包器集成 | 42 | **30** | 0.71（原 0.80） | 仍第 1 | 否 —— 本就判定为"配置错误为主"，§5.3 已明确排除 |
| N21 框架集成 | 85 | **79** | 0.73（原 0.75） | 仍第 4 | 否 —— 同上 |
| N09 拿 Blob | 17 | **17** | 0.43 | 不变 | 否 —— 已修复 |

> 复算只针对**会进入 §5 机会评估**的需求做；窄口径需求（N01/N02/N04/O1 相关）经人工核对，
> 逐条 issue 均落在其需求描述内，误差 ±2 条。**§5.2 的五个机会（O1–O5）不受此误差影响**：
> O1 的 5 条 issue 全部人工复核过正文与评论。

### 4.1 真实业务场景（原文引用）

| 场景 | Issue | 原文 |
| --- | --- | --- |
| 动态生成报表（iOS 空白） | [#397](https://github.com/eKoopmans/html2pdf.js/issues/397) | "js library to produce a dynamically generated report" |
| 发票（HTML 模板 → PDF） | [#219](https://github.com/eKoopmans/html2pdf.js/issues/219) | `filename: 'Invoice.` |
| 发票列表，每条一页 | [#203](https://github.com/eKoopmans/html2pdf.js/issues/203) | "I have invoices list, each has its own page /invoice/id" |
| 发票导出后隐藏原页面 | [#431](https://github.com/eKoopmans/html2pdf.js/issues/431) | "I made an invoice via HTML, and I want to people just see pdf or image not whole of html too" |
| 开票 PDF | [#58](https://github.com/eKoopmans/html2pdf.js/issues/58) | `html2pdf($("#template #template_invoice")[0],{` |
| 分析报表页脚 | [#692](https://github.com/eKoopmans/html2pdf.js/issues/692) | `.../images/analytical_report_images/report_footer.` |

### 4.2 用户现有的绕行办法（原文）

| 绕行 | Issue | 成本 |
| --- | --- | --- |
| 拿 jsPDF 实例手动遍历每页画页码 | [#21](https://github.com/eKoopmans/html2pdf.js/issues/21) | 高：依赖 jsPDF 内部 API |
| 把 Chart.js canvas 换成图片再换回来 | [#10](https://github.com/eKoopmans/html2pdf.js/issues/10) | 高：维护者自称"a bit of a hack" |
| 手动插入 spacer `div` 制造分页 | [#200](https://github.com/eKoopmans/html2pdf.js/issues/200) | 中：需自建分页逻辑 |
| 把长文档拆成多段分别导出再合并 | [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)、[#187](https://github.com/eKoopmans/html2pdf.js/issues/187) | 高：需业务侧重排 |
| 空格替换为 `\u00a0` 修阿拉伯文 | [#425](https://github.com/eKoopmans/html2pdf.js/issues/425) | 中：需遍历 DOM |
| 换成 wkhtmltopdf 服务端 | [#66](https://github.com/eKoopmans/html2pdf.js/issues/66)、[#148](https://github.com/eKoopmans/html2pdf.js/issues/148) | 高：需部署服务端 |

---

## 5. 对照 Web Printer 3.0：值得验证的差异化机会

判断基准见 [对照基线](./00-web-printer-baseline.md)。**首要纪律：html2pdf.js 与 Web Printer 3.0 共用
html2canvas 1.4.1 + jsPDF 4.x 光栅化后端**，因此**光栅化层的保真度缺口对两者一视同仁，不是 Web Printer 的机会。**

### 5.1 已由 Web Printer 3.0 覆盖（可直接作为定位主张，无需新投入）

| html2pdf.js 缺口 | Web Printer 3.0 现状 | 依据 | 证据强度 |
| --- | --- | --- | --- |
| N01 长文档超画布上限 → 空白 | **逐页渲染**，不依赖超长截图 | `README.md` 逐页渲染；`docs/benchmark.md` long-50 通过、html2pdf 全空白 | 强（已实测） |
| N02 内容跨页腰斩 | **内容感知分页**，按文字行/表格行边界断开 | `src/lib/core/pagination/` | 强（已实测） |
| N03 pagebreak 不生效 | **atomic / splittable 显式分类**替代选择器 | `src/lib/core/types.ts:64-80` | 强 |
| N04 表格行被劈开 | 表格行整体保护，超高则递归拆内部行 | `docs/migration-to-v3.md` | 强 |
| N05 页眉页脚 | **声明式 `header` / `footer`** | `src/lib/core/types.ts:28,52-53` | 强（库无此 API） |
| N06 页码 | **独立页码系统**（含中文格式） | `src/lib/core/types.ts:36,54` | 强（库无此 API） |
| N07 进度 | `onProgress(completed, total)` | `src/lib/application/print-service.ts:13,70,77` | 强（库无此 API） |
| N08 取消 | `AbortSignal` + `checkCancelled` | `src/lib/application/cancellation.ts` | 强（库无此 API） |
| N09 拿 Blob | `download: false` + 返回 `blob` | `docs/migration-to-v3.md` 输出语义 | 强 |
| N25 滚动容器 | 内部滚动区保留裁剪尺寸与 `scrollTop/scrollLeft` | `docs/migration-to-v3.md` | 中（需业务复测） |
| — 分页可诊断 | 分页线 / 保护区间 / 测量信息 | `src/lib/overlay/page-break-overlay.ts` | 强（库无此 API） |

**已实测的对照数据**（`docs/benchmark.md`，Apple M1 Pro / 16GB 内存，3 次独立重复取中位数）：

| 样本 | html2pdf.js | Web Printer current |
| --- | --- | --- |
| layout（Flex/Grid） | 0/3 通过 PDF 校验（1 页空白） | 3/3 通过 |
| long-20 | 0/3（标记出现 205 次 / 期望 200 次，内容重复） | 3/3，20 页 |
| long-50 | 0/3（50 页全空白，0/500 标记） | 3/3，50 页，约 35 s |
| 短文档耗时（≤5 页） | 本库 1.9–2.5 倍 | 更短 |

### 5.2 真正仍存在的差异化空白（Web Printer 3.0 尚未覆盖）

| # | 空白 | 需求依据 | Web Printer 现状 | 建议动作（待验证） |
| --- | --- | --- | --- | --- |
| **O1** | **跨页表格表头不重复** | N04，18 位独立作者；5 条独立 issue（[#281](https://github.com/eKoopmans/html2pdf.js/issues/281)、[#341](https://github.com/eKoopmans/html2pdf.js/issues/341)、[#554](https://github.com/eKoopmans/html2pdf.js/issues/554)、[#361](https://github.com/eKoopmans/html2pdf.js/issues/361)、[#619](https://github.com/eKoopmans/html2pdf.js/issues/619)）**全部零维护者回复**；[#281](https://github.com/eKoopmans/html2pdf.js/issues/281) 自 2020 年 open，末条评论 2024-08-01「any solution ?」 | 代码中**无 `thead` / 表头重复逻辑** | 在分页层增加"表头随页重绘"；需先确认 `core/pagination` 对 `<thead>` 的处理成本。**关键参照**：[#341](https://github.com/eKoopmans/html2pdf.js/issues/341) 作者明确对比"用 Chrome 打印命令**每页都有 thead**，用 html2pdf **做不到**"——用户已有可对照的正确预期 |
| **O2** | **PDF 超链接 / 链接注释** | N23，**14 位独立作者 / 14 条 issue，其中 12 条明确要求"PDF 内可点跳转"**；仅 #61、#155 得到过维护者回复（[#155](https://github.com/eKoopmans/html2pdf.js/issues/155) 被维护者明示"html2pdf does not perform as intended"），**其余 12 条零维护者结论**，用户多为"Any idea? / did you find any solution?"（[#335](https://github.com/eKoopmans/html2pdf.js/issues/335)「Local Links don't work correctly」、[#611](https://github.com/eKoopmans/html2pdf.js/issues/611)「Links are not clickable is there any way to use links on pdf?」、[#395](https://github.com/eKoopmans/html2pdf.js/issues/395) 目录跳转） | html2pdf.js 默认 `enableLinks: true` + `src/plugin/hyperlinks.js`；**Web Printer 的 `jspdf-writer.ts` 只有 `addImage`，无 `link()`** | 补 jsPDF 注释写出；这是**相对 html2pdf.js 的能力回归**，不是共享天花板。规模不大但**成本低、可验证**：逐条对齐 14 个 issue 的期望行为即可 |
| **O3** | **`@media print` 语义** | N10，6 位独立作者；[#79](https://github.com/eKoopmans/html2pdf.js/issues/79) 维护者说"可行但未做"，至今 open | html2canvas 不解析 print 媒体查询 → **与 html2pdf.js 同为天花板** | 若要做，须换/改光栅化后端，**成本高、且会同时打破"与 html2pdf.js 同后端"的对齐**，优先级低 |
| **O4** | **长文档导出耗时** | N19 + N01 的衍生：用户抱怨"能出结果但太慢" | 50 页约 35 s，耗时随页数线性增长（`docs/benchmark.md`） | 不解决"不能导出"，只解决"等太久"；与 O1 一起做更有说服力 |
| **O5** | **可搜索 / 矢量 PDF** | N24（宽口径命中 6 条，核心为 [#56](https://github.com/eKoopmans/html2pdf.js/issues/56)、[#282](https://github.com/eKoopmans/html2pdf.js/issues/282)、[#657](https://github.com/eKoopmans/html2pdf.js/issues/657)、[#733](https://github.com/eKoopmans/html2pdf.js/issues/733) 4 条）；维护者："there aren't really any client-side options for that" | 同样输出位图，**与 html2pdf.js 同为天花板** | 需要换渲染后端（如 SVG→PDF 路径），属战略级决策，非 3.0 范围 |

### 5.3 明确**不**作为机会的需求（避免自我误导）

| 需求 | 排除理由 |
| --- | --- |
| N12 图片/SVG/跨域、N13 字体/CJK、N14 背景、N15 绝对定位、N17 现代 CSS、N10 `@media print` | **html2canvas 上游天花板**。Web Printer 共用 html2canvas 1.4.1，用户在此类问题上**不会因换库而受益**。做得再对比 html2pdf.js 也没有差异 |
| N20 Node/打包器、N21 框架集成 | 主体是**配置错误与使用问题**（根因在用户构建配置），且 Web Printer 已提供 ESM / CJS / `.d.ts` |
| N18 表单字段、N24 可搜索文本（若不换后端） | 超出两个库的能力边界，声称覆盖会是不实承诺 |
| N09 拿 Blob、N07 进度、N08 取消、N16 fit-to-width | Web Printer **已覆盖**（N16 除外），包装成"新机会"是重复劳动 |

### 5.4 一句话定位建议（供后续决策讨论，不作为结论）

> html2pdf.js 的用户真正放弃它的原因，**不是 CSS 渲染能力**（那是 html2canvas 的共性天花板，换谁都一样），
> 而是**"把整页画成一张大图再按像素切"**这一个架构选择带来的三件事：
> 内容被腰斩、长文档超出画布上限、以及分页不可解释。
> 这三件事正好是 Web Printer 3.0 已解决的部分，且已有实测对照。
>
> **而且这条路已经被市场验证过**：用户放弃 html2pdf.js 时的实际首选不是服务端，而是浏览器内的
> fork `html3pdf`（§1.6，5 条 issue 提及），其解法就是"每页独立渲染一个 canvas" —— 与 Web Printer 3.0 的逐页渲染同路。
> 维护者本人 2019 年就写出了同样的方向（§1.7），并称其为"high on my to-do list"，至今未发布。
>
> **真正还没被任何一方解决的，只剩两件**：**跨页表头重复（O1）** 和 **PDF 链接注释（O2）**——
> 两者都不在 html2canvas 的共享天花板之内（O1 是分页层能力，O2 是 jsPDF 注释写出），
> 量级不大（5 条 / 14 条 issue），但**成本低、验收标准明确**：逐条对齐已有 issue 里的期望行为即可。
>
> O3（`@media print`）与 O5（矢量 PDF）虽为真缺口，但**属于 html2canvas/jsPDF 的共享天花板或战略级换后端**，
> 不宜作为 3.0 的差异化主张；O4（长文档耗时）是已解决"能不能导出"之后的体验优化，
> 应与 O1 打包验证，不单独立项。

---

## 6. 未证实 / 需进一步核实

| 项 | 为什么没定论 | 怎么查 |
| --- | --- | --- |
| N03 / N04 的独立报告人数 | 关键词口径把"表格 + 分页"和"分页配置"混在一起，18–23 之间可能虚高 | 逐条人工复核 #184/#227/#281/#1043 及其讨论串的根因归属 |
| N01 的边界 | "blank pdf" 一词同时覆盖"超画布上限"和"资源未加载"两种根因 | 逐条看是否复现于 >30 页文档；本仓库 benchmark 的 long-50 已给出机制侧答案 |
| 维护者对 N01 的表态是否仍成立 | 2019 年的表述基于当时的 html2canvas 1.x | 在 0.14.0（html2canvas 1.4.1）上实测 50/100 页复现；`docs/benchmark.md` 的 long-50 结果已间接支持 |
| 社区 PR 是否有可用实现 | 29 条 open PR 未逐一审阅 | 重点看 [#170](https://github.com/eKoopmans/html2pdf.js/pull/170)（尊重 html2canvas width 选项）与 [#235](https://github.com/eKoopmans/html2pdf.js/pull/235)（dom-to-image 替换） |
| O1 实现成本 | 未评估 `core/pagination` 对 `<thead>` 的现有处理 | 读 `src/lib/core/pagination/paginator.ts` 与 `src/lib/adapters/dom/measurement.ts`，估算"表头随页重绘"的增量 |
| ~~O2 链接注释的实际诉求强度~~ | **已核实**：14 条标题级显式超链接 issue 中，12 条明确要求 PDF 内可点跳转（仅 #132 反向要求移除 href、#669 主要是目录生成）；此前"17 位作者"的计数含 9 条误纳（#19/#33/#72/#139/#142/#281/#311/#465/#659）与 6 条漏纳（#132/#283/#335/#585/#669/#725），已更正为 14 | — |
| 服务端出路的占比 | 全量扫描命中 20 条 issue 提到 server-side / backend，但其中相当部分是**维护者劝退**（wkhtmltopdf 的 8 条命中里，只有 #106 出现在 issue 正文、即用户自己提的） | 区分"用户主动提出"与"维护者回复中建议"两类并分别计数 |
| `html3pdf` 的规模 | 5 条 issue 出现 html3pdf（§1.6），但其 npm 下载量与 html2pdf.js 的比值未核实 | 查 npm 下载量（`npm view html3pdf` / downloads API）与 GitHub fork 数，量化"因分页问题流失到浏览器内 fork"的比例 |
| README "Known issues" 的时效性 | Known issue #2 说克隆"is buggy"并指向 `bugfix/clone-nodes-BUILD` 分支，但该修复已由 PR #792 在 v0.11.3 落地；README 未同步 | 逐条比对 README Known issues 与当前 `main` 分支，判断哪些已过时（过时本身是文档维护状态的证据） |
| `feature/jspdf-canvas` 分支的完成度 | 2019-02 后停更，未评估其可用性 | `git diff main...feature/jspdf-canvas` 看改动范围；若可用，它是"维护者认可的正确解法"的参考实现 |
| 混合纸张 / 纵横向混排是否是真实需求 | 仅 4 条独立作者，维护者称"jsPDF 可以，html2pdf 不行" | 判断是"真需求"还是"个例"；Web Printer 3.0 支持横竖向但**不支持同文档内混排**，需确认是否要补 |
| 3.0 的 long-50 耗时是否可接受 | 35 s 为 Apple M1 Pro 实测数据 | 需在目标业务文档（真实报表/发票）上复测，并与服务端方案对比体验 |

---

## 附：证据索引

- 机读需求索引（需求 ↔ issue 编号 ↔ 计数）：[`needs-index.json`](./needs-index.json)
- Web Printer 3.0 能力基线：[`00-web-printer-baseline.md`](./00-web-printer-baseline.md)
- 语料获取方式（可复现）：
  ```bash
  gh api "repos/eKoopmans/html2pdf.js/issues?state=all&per_page=100" --paginate   # 681 issues + 350 PRs
  gh api "repos/eKoopmans/html2pdf.js/issues/<N>/comments?per_page=100" --paginate
  gh api repos/eKoopmans/html2pdf.js/releases --paginate
  gh api repos/eKoopmans/html2pdf.js/pulls?state=open --paginate
  gh api repos/eKoopmans/html2pdf.js/branches --paginate                          # §1.7 未合并分支
  gh api "repos/eKoopmans/html2pdf.js/commits?sha=main&since=2026-01-12T00:00:00Z" --paginate
  ```

### 附：迁出方向扫描关键词表（§1.4 口径）

对每条 issue 的 **正文 + 全部评论**做正则匹配，命中即计入该 issue（同一 issue 只计一次）：

| 去向 | 正则 |
| --- | --- |
| 服务端渲染 | `\b(server[- ]side\|backend\|server side)\b` |
| wkhtmltopdf | `wkhtmltopdf` |
| 浏览器原生打印 | `window\.print\|browser['’]?s print\|printer command\|print command\|PrintThis\|print-preview\|print preview` |
| pdfmake | `pdfmake` |
| Puppeteer | `puppeteer` |
| html3pdf | `html3pdf` |
| react-to-pdf | `react-to-pdf` |
| dompdf | `dompdf` |

> 口径提醒：这些关键词命中的是**讨论中出现过该方案**，不等于用户最终改用。
> §1.4 的"明确改用"一列只收录正文或评论中明确表达了迁移的 issue。
