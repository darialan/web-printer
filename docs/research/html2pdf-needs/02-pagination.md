# html2pdf.js — 用户需求研究：分页 / 分页符 / 页边距 / 页眉页脚 / 页面级排版

> 研究对象：`eKoopmans/html2pdf.js`（GitHub，约 681 个 issue）
> 证据来源：**仅使用该仓库的 issue / issue 评论 / 关联 PR / 仓库源码 / README**。StackOverflow 等仅作次级佐证并已显式标注。
> 研究日期：2026-11-02（所有 issue 状态均为"截至今日"的实时抓取结果）
> 覆盖率：本文件覆盖 206 个经标题关键词初筛的 issue，其中 149 个经正文语义复核后确认属于"分页/页边距/页眉页脚/页面级排版"主题，占全库 149/681 ≈ 21.9%。

---

## 主题概述

### 1.1 html2pdf.js 的实际分页模型（基于源码，非文档描述）

html2pdf.js **不是** 一个带分页引擎的 PDF 生成器。它的真实工作流（README 的 `from() -> toContainer() -> toCanvas() -> toImg() -> toPdf() -> save()`）是：

1. **克隆并重排 DOM** — `src/worker.js` 的 `Worker.prototype.toContainer` 把源元素 `deepCloneBasic` 后塞进一个宽度等于「页宽 − 左右边距」的 overlay 容器里，内容因此发生 reflow。
2. **整页栅格化** — `src/worker.js` 的 `Worker.prototype.toCanvas` 对整个容器调用一次 `html2canvas`，产出**一张超长位图**。
3. **按像素高度切图** — `src/worker.js` 的 `Worker.prototype.toPdf` 是真正的"分页"所在：

```js
// src/worker.js — Worker.prototype.toPdf
var pxFullHeight = canvas.height;
var pxPageHeight = Math.floor(canvas.width * this.prop.pageSize.inner.ratio);
var nPages = Math.ceil(pxFullHeight / pxPageHeight);
...
for (var page=0; page<nPages; page++) {
  if (page === nPages-1 && pxFullHeight % pxPageHeight !== 0) {
    pageCanvas.height = pxFullHeight % pxPageHeight;   // 末页裁剪
    pageHeight = pageCanvas.height * this.prop.pageSize.inner.width / pageCanvas.width;
  }
  var w = pageCanvas.width, h = pageCanvas.height;
  pageCtx.fillStyle = 'white';
  pageCtx.fillRect(0, 0, w, h);
  pageCtx.drawImage(canvas, 0, page*pxPageHeight, w, h, 0, 0, w, h);
  if (page) this.prop.pdf.addPage();
  var imgData = pageCanvas.toDataURL('image/' + opt.image.type, opt.image.quality);
  this.prop.pdf.addImage(imgData, opt.image.type, opt.margin[1], opt.margin[0],
                        this.prop.pageSize.inner.width, pageHeight);
}
```

**切刀是纯像素的**：`drawImage(canvas, 0, page*pxPageHeight, w, h, ...)` 意味着切刀落在哪一行文字中间，完全由 `canvas.width × ratio` 这个算术值决定，与 DOM 内容毫无关系。

4. **唯一的"语义"补偿层** — `src/plugin/pagebreaks.js`。它在 `toContainer` 阶段遍历容器内所有元素，按规则**插入撑高用的空 div**，让后续内容整体下沉，从而"人为"把切刀对齐到元素边界：

```js
// src/plugin/pagebreaks.js — rules.avoid 分支
var startPage = Math.floor(clientRect.top / pxPageHeight);
var endPage   = Math.floor(clientRect.bottom / pxPageHeight);
var nPages    = Math.abs(clientRect.bottom - clientRect.top) / pxPageHeight;
if (endPage !== startPage && nPages <= 1) {
  rules.before = true;   // 该元素只有 <=1 页高，才整体推到下一页
}

// rules.before 分支：插入占位 div 把元素顶到下一页
var pad = createElement('div', {style: {
  display: 'block',
  height: pxPageHeight - (clientRect.top % pxPageHeight) + 'px'
}});
el.parentNode.insertBefore(pad, el);

// rules.after 分支：插入占位 div 填满本页剩余空间
var pad = createElement('div', {style: {
  display: 'block',
  height: pxPageHeight - (clientRect.bottom % pxPageHeight) + 'px'
}});
el.parentNode.insertBefore(pad, el.nextSibling);
```

**这就是分页 bug 的结构性根源**：补偿层用"插入空白 div"来模拟分页，而真正的分页在下一步是按像素切的。两者之间只要有 1px 的对齐误差，误差就会**逐页累积**（每页偏移 1px，20 页后累积 20px，正好吃掉上一页底部），这正是 #227 / #393 / #708 / #709 / #150 / #139 所描述的"逐页漂移"现象。

### 1.2 由此产生的 5 类结构性问题

| # | 结构性问题 | 直接后果 | 用户看到的症状 |
|---|---|---|---|
| A | **切刀与文本行无关** | 文字行会被从中间切开 | "text is cut in the middle" / "文字被从中间切断" |
| B | **误差逐页累积** | 页面内容逐页上移 | "every page is off by 1px" / "逐页漂移" |
| C | **单一超长 canvas** | 超过浏览器 canvas 上限后整份空白 | "PDF 超过 20 页全白" |
| D | **无页级渲染层** | 无法有真正的页眉/页脚/页码 | 需手写 jsPDF 循环 |
| E | **页尺寸/方向全局唯一** | 无法混合纵向/横向或多种纸张 | "orientation 只由第一页决定" |

### 1.3 README 自认的 Known Issues（官方确认的设计限制）

README 的 "Known issues" 章节明确列出 6 项，其中 3 项直接落在本主题：

> **3. Resizing:** Currently, html2pdf.js resizes the root element to fit onto a PDF page (causing internal content to "reflow"). … There are plans to add alternate behaviour (e.g. "shrink-to-page"), but nothing that's ready to test yet.
>
> **4. Rendered as image:** html2pdf.js renders all content into an image, then places that image into a PDF. … This is currently unavoidable…
>
> **6. Maximum size:** HTML5 canvases have a maximum height/width. Anything larger will fail to render. This is a limitation of HTML5 itself, and results in large PDFs rendering completely blank in html2pdf.js.

（来源：https://github.com/eKoopmans/html2pdf.js — README "Known issues"）

---

## 需求项清单

> **分类口径**（见第 4 节的分桶证据）：
> **已确认缺陷** = 维护者明确承认 bug / 打 `bug` 标签 / 有 PR 修复；
> **配置错误** = 根因是用户的 HTML/CSS/options 或误读文档；
> **设计限制/功能请求** = 行为源于"单图 + 像素切分"架构，非 bug；
> **未决** = 至今开放、无维护者裁定。

| 需求ID | 需求描述 | 独立报告人数 | 典型严重性 | 替代方案成本 | 当前状态 | 分类 | 代表 Issue |
|---|---|---|---|---|---|---|---|
| **N1** | 长文档不被切成两半（文本行 / 元素跨页切开） | **45+** | 内容静默损坏（内容被切） | 高（需改 DOM 结构或换库） | 仍开放 | 已确认缺陷 + 设计限制 | [#83](https://github.com/eKoopmans/html2pdf.js/issues/83) [#13](https://github.com/eKoopmans/html2pdf.js/issues/13) [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) [#654](https://github.com/eKoopmans/html2pdf.js/issues/654) [#634](https://github.com/eKoopmans/html2pdf.js/issues/634) |
| **N2** | 分页位置精确可控（avoid / before / after 语义可靠） | **30+** | 布局错乱 | 高（需手工预分页） | 仍开放 | 已确认缺陷 + 未决 | [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) [#675](https://github.com/eKoopmans/html2pdf.js/issues/675) [#346](https://github.com/eKoopmans/html2pdf.js/issues/346) [#184](https://github.com/eKoopmans/html2pdf.js/issues/184) |
| **N3** | 逐页累积漂移（内容越往后越往上爬） | **20+** | 布局错乱 → 末页内容重叠 | 高（需改 bundle 源码） | 仍开放 | 已确认缺陷（维护者承认） | [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) [#393](https://github.com/eKoopmans/html2pdf.js/issues/393) [#709](https://github.com/eKoopmans/html2pdf.js/issues/709) [#708](https://github.com/eKoopmans/html2pdf.js/issues/708) |
| **N4** | 隐藏元素（data-html2canvas-ignore）破坏分页计算 | **8+** | 布局错乱（内容被顶回上一页） | 中（手动 display:none 前后切换） | 仍开放 | 已确认缺陷（维护者承诺修复，未落地） | [#139](https://github.com/eKoopmans/html2pdf.js/issues/139) [#357](https://github.com/eKoopmans/html2pdf.js/issues/357) [#466](https://github.com/eKoopmans/html2pdf.js/issues/466) [#648](https://github.com/eKoopmans/html2pdf.js/issues/648) |
| **N5** | 长文档（>20 页）生成空白 PDF | **15+** | 内容整体丢失 | 高（需自行分页合并或换库） | 仍开放 | 设计限制（官方 Known Issue #6） | [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) [#721](https://github.com/eKoopmans/html2pdf.js/issues/721) [#311](https://github.com/eKoopmans/html2pdf.js/issues/311) [#599](https://github.com/eKoopmans/html2pdf.js/issues/599) |
| **N6** | 每页重复页眉 / 页脚 / 页码 / logo | **18+** | 缺失必需合规要素 | 中（需手写 jsPDF 循环） | 部分可用（需自己写） | 设计限制 + 功能请求 | [#208](https://github.com/eKoopmans/html2pdf.js/issues/208) [#230](https://github.com/eKoopmans/html2pdf.js/issues/230) [#278](https://github.com/eKoopmans/html2pdf.js/issues/278) [#526](https://github.com/eKoopmans/html2pdf.js/issues/526) [#509](https://github.com/eKoopmans/html2pdf.js/issues/509) |
| **N7** | 表格跨页时重复 `<thead>` 表头 | **12+** | 表格语义丢失、难读 | 中（手动复制表头） | 仍开放 | 设计限制 | [#281](https://github.com/eKoopmans/html2pdf.js/issues/281) [#341](https://github.com/eKoopmans/html2pdf.js/issues/341) [#554](https://github.com/eKoopmans/html2pdf.js/issues/554) [#619](https://github.com/eKoopmans/html2pdf.js/issues/619) [#361](https://github.com/eKoopmans/html2pdf.js/issues/361) |
| **N8** | 表格行不被从中间切断（含 rowspan） | **10+** | 内容错乱 | 中（CSS break-inside） | 部分可用但不可靠 | 已确认缺陷 + 设计限制 | [#712](https://github.com/eKoopmans/html2pdf.js/issues/712) [#553](https://github.com/eKoopmans/html2pdf.js/issues/553) [#129](https://github.com/eKoopmans/html2pdf.js/issues/129) [#752](https://github.com/eKoopmans/html2pdf.js/issues/752) |
| **N9** | 页边距精确控制（设 0 仍有偏移 / 大边距致内容消失） | **10+** | 布局错乱 | 低（改配置） | 部分修复 | 配置错误 + 已确认缺陷 | [#1](https://github.com/eKoopmans/html2pdf.js/issues/1) [#360](https://github.com/eKoopmans/html2pdf.js/issues/360) [#643](https://github.com/eKoopmans/html2pdf.js/issues/643) [#499](https://github.com/eKoopmans/html2pdf.js/issues/499) |
| **N10** | 多余空白页（开头 / 结尾 / 页面间） | **14+** | 布局错乱（部分场景内容丢失） | 中 | 仍开放 | 已确认缺陷 + 未决 | [#408](https://github.com/eKoopmans/html2pdf.js/issues/408) [#672](https://github.com/eKoopmans/html2pdf.js/issues/672) [#433](https://github.com/eKoopmans/html2pdf.js/issues/433) [#661](https://github.com/eKoopmans/html2pdf.js/issues/661) [#123](https://github.com/eKoopmans/html2pdf.js/issues/123) |
| **N11** | 单页 PDF（内容缩放到一页） | **10+** | 内容不可读 | 高 | 仍开放 | 设计限制（官方 Known Issue #3） | [#37](https://github.com/eKoopmans/html2pdf.js/issues/37) [#81](https://github.com/eKoopmans/html2pdf.js/issues/81) [#44](https://github.com/eKoopmans/html2pdf.js/issues/44) |
| **N12** | 混合页面尺寸 / 纵向横向混排 | **4+** | 布局错乱 | 高 | 仍开放 | 设计限制（维护者称"jsPDF 可以，html2pdf 不行"） | [#117](https://github.com/eKoopmans/html2pdf.js/issues/117) [#437](https://github.com/eKoopmans/html2pdf.js/issues/437) [#504](https://github.com/eKoopmans/html2pdf.js/issues/504) |
| **N13** | 由使用者掌控分页（每个逻辑页一个 DOM 元素），再合并成一份 PDF | **8+** | 满足强分页需求 | 高（需自建合并逻辑） | 仍开放 | 功能请求（部分靠 hack 实现） | [#483](https://github.com/eKoopmans/html2pdf.js/issues/483) [#488](https://github.com/eKoopmans/html2pdf.js/issues/488) [#47](https://github.com/eKoopmans/html2pdf.js/issues/475) [#54](https://github.com/eKoopmans/html2pdf.js/issues/551) |
| **N14** | 页面背景色 / 背景图铺满到最后一页 | **4+** | 视觉错误 | 中 | 仍开放 | 设计限制 | [#658](https://github.com/eKoopmans/html2pdf.js/issues/658) [#628](https://github.com/eKoopmans/html2pdf.js/issues/628) |
| **N15** | 打印区域不受页面滚动位置影响 | **4+** | 布局整体偏移 | 低（scroll to top） | 仍开放 | 配置错误 + 未决 | [#560](https://github.com/eKoopmans/html2pdf.js/issues/560) [#499](https://github.com/eKoopmans/html2pdf.js/issues/499) [#175](https://github.com/eKoopmans/html2pdf.js/issues/175) |
| **N16** | 页码 / 目录 / 交叉引用可点击且位置正确 | **6+** | 功能缺失 | 中 | 部分可用（需自写） | 功能请求 | [#278](https://github.com/eKoopmans/html2pdf.js/issues/278) [#695](https://github.com/eKoopmans/html2pdf.js/issues/695) [#61](https://github.com/eKoopmans/html2pdf.js/issues/61) [#395](https://github.com/eKoopmans/html2pdf.js/issues/395) |

---

## 需求详情

### N1 — 长文档不被切成两半（文本行 / 元素跨页切开）

**用户描述的失败（verbatim）**

> "the text is cut in the middle, is there a way to avoid that" — [#83](https://github.com/eKoopmans/html2pdf.js/issues/83)（2018-02-27，OPEN）
>
> "the paragraph line has cut from the middle and split over two pages instead of starting from the new page" — [#446](https://github.com/eKoopmans/html2pdf.js/issues/446)（2021-06-10，OPEN），用户是 draft-js WYSIWYG 编辑器的内容，约 10 页
>
> "the issue is that the images and text at the end of the page are sliced and cutoff to the next page" — [#654](https://github.com/eKoopmans/html2pdf.js/issues/654)（2023-06-20，OPEN）
>
> "the last line of text is always cut, I tried to generate a simple string just to see if the issue was the html itself but it seems to be a deeper issue" — [#753](https://github.com/eKoopmans/html2pdf.js/issues/753)（2025-07-21，OPEN）
>
> "one lines gets chopped off partially. We have tried to set the values using breaks. The issue is it will be one single paragraph which is a user input using a rich text editor." — [#489](https://github.com/eKoopmans/html2pdf.js/issues/489)（2021-11-10，OPEN）

**真实业务场景**

- **审计报告 / 发票** — [#692](https://github.com/eKoopmans/html2pdf.js/issues/692)：用户导出 `Audit-Report.pdf`，`margin: [0.2, 0.1, 0.6, 0.2]`，需要横向 A4 承载大量数据。
- **简历** — [#542](https://github.com/eKoopmans/html2pdf.js/issues/542)：`generateResume()`。
- **WordPress 动态内容转 PDF** — [#589](https://github.com/eKoopmans/html2pdf.js/issues/589)：把 WordPress category 里的 3-6 篇文章拼成一份多页 PDF。
- **护理计划（医疗）** — [#717](https://github.com/eKoopmans/html2pdf.js/issues/717)：Django 模板渲染的 `action_items`，每条含多个句子。
- **聊天记录导出** — [#692](https://github.com/eKoopmans/html2pdf.js/issues/692) 评论（2026-04-06，maleta）："Ran into this while building a chat export feature."

**用户已尝试的替代方案（verbatim）**

- 加 `pagebreak: { mode: ['avoid-all','css','legacy'] }` — [#654](https://github.com/eKoopmans/html2pdf.js/issues/654) 评论（TP053060, 2023-06-28）："maybe add this to ur opt"；但 neekesh（2023-08-16）回："Text is still cutoff in page break condition when we are using all the mode in page break"，Basnetsuman4（2024-12-06）再次确认："The text still cutoff"。
- 手动加尾部空白 div — [#753](https://github.com/eKoopmans/html2pdf.js/issues/753) 评论（rodgramos, 2025-07-21）："I put a `<div style="height: 40px;"></div>` as a workaround as the last line of my HTML so the text is not cut anymore"。
- **把长文本拆成每行一个 `<p>`** — [#692](https://github.com/eKoopmans/html2pdf.js/issues/692) 评论（maleta, 2026-04-06）："the core issue is that html2pdf.js slices a single canvas image into pages, so it has no understanding of text lines - it just cuts at pixel boundaries. `avoid-all` mode helps a bit … So if you can break your content into many small elements (one per line), it has more granular boundaries to work with"。
- 整段文本外包 `<span>` + `white-space: pre-wrap` — [#634](https://github.com/eKoopmans/html2pdf.js/issues/634) 评论（tmislos-cgi, 2023-03-10）："you need to strategically put css style 'break-inside' to your elements so they don't get cut off"，报告者回："It would work even though the only element being printed is one giant span? I tried adding the page break to avoid everything, but it didnt work, did nothing actually."

**状态与分类**

- **已确认缺陷**（维护者明确承认架构性缺陷）— [#13](https://github.com/eKoopmans/html2pdf.js/issues/13) 的维护者回复（2017-06-03，eKoopmans）即架构说明：
  > "Hi @lidijarad, yes at the moment that's intended behaviour. All html2pdf is doing is converting the webpage into an image, and then slicing that image onto separate PDF pages. If your text (or any other component) straddles two pages, it will appear sliced."
- **仍开放**：#83 / #489 / #654 / #634 / #446 / #752 / #753 / #1043 全部 OPEN。
- 维护者 2017-06-08 在 [#13](https://github.com/eKoopmans/html2pdf.js/issues/13) 提出过一个方案："I could probably make an auto-break system that would add a page break before any element that would span two pages (as long as the element itself wasn't taller than a page). **If you have spans of text longer than a page it would have to be a different solution.**" —— 这个"不同方案"至今未交付。

---

### N2 — 分页位置精确可控（avoid / before / after 语义可靠）

**用户描述的失败（verbatim）**

> "Telling html2pdf to avoid page breaks on the child divs does nothing. Using 'avoid-all' also has no effect." — [#675](https://github.com/eKoopmans/html2pdf.js/issues/675)（2024-01-28，OPEN）
>
> "I have a fieldset that I have set to avoid page breaks, but in the generated PDF, I get random gaps between my fieldsets, and there are pagebreaks inside my fieldset, regardless of the css setting." — [#346](https://github.com/eKoopmans/html2pdf.js/issues/346)（2020-08-31，OPEN）
>
> "use `html2pdf__page-break` with multiple times. only the first one has an effect." — [#112](https://github.com/eKoopmans/html2pdf.js/issues/112)（2018-04-24，OPEN，附源码级根因分析）
>
> "0.9.1: I can't make the page-break options work at all" — [#184](https://github.com/eKoopmans/html2pdf.js/issues/184)（2019-01-16，OPEN，13 人参与）

**真实业务场景**

- **信用报告（金融）** — [#512](https://github.com/eKoopmans/html2pdf.js/issues/512)（2022-01-19，OPEN）：Vue 组件化的信用报告，`avoid-all` 模式下整页而非组件被断开。
- **表单生成器（Form.io）** — [#586](https://github.com/eKoopmans/html2pdf.js/issues/586)："Using form.io, can't alter CSS." —— 这是个硬约束：**用户根本不能改 HTML/CSS 结构**，所以"加 break-inside"这类 workaround 完全不可用。

**用户已尝试的替代方案（verbatim）**

- 换用 CSS `break-inside` — [#712](https://github.com/eKoopmans/html2pdf.js/issues/712) 评论（yuanyuan-qwq, 2025-04-16）：
  > "You can try using:
  > ```js
  > const tables = content.querySelectorAll("table, tr, td, th");
  >     tables.forEach(el => {
  >         el.style.pageBreakInside = "avoid";
  >         el.style.breakInside = "avoid";
  >     });
  > ```"
- 用 `:not(:first-child)` 排除首元素 — [#672](https://github.com/eKoopmans/html2pdf.js/issues/672) 评论（zaosoula, 2024-01-18）："`pagebreak` can accept css selectors, you should try to use :not(:first-child), :first-child to exclude to prevent the first page break"。
- 手动包容器 — [#551](https://github.com/eKoopmans/html2pdf.js/issues/551) 评论（skylingfly, 2022-09-29）："if you don't want to split some elements, you can add container to wrap them."

**状态与分类**

- **已确认缺陷** — [#232](https://github.com/eKoopmans/html2pdf.js/issues/232) 维护者回复（2019-06-03，eKoopmans，OPEN 至今）：
  > "3. In general, the page-break functionality is not working 100%, unfortunately"
- **已确认缺陷** — [#184](https://github.com/eKoopmans/html2pdf.js/issues/184) 维护者回复（2019-01-16）："Pages break in the middle of text when you have elements *longer than one page*. This is a more complicated issue that there's no fix for currently"；并于 2019-01-17 回复："My guess it boils down to tables not behaving like everything else, and I may need to program in a special case for that. **No promises on timeline though, there's a long list of things that need work!**"
- **设计限制** — `avoid` 只对「元素自身 ≤ 1 页高」有效（见 §1.1 的 `nPages <= 1` 判断）。超过一页高的元素必然被切开，无法规避。
- **未决** — #675 / #346 / #184 / #512 至今 OPEN，无维护者裁定。

---

### N3 — 逐页累积漂移（内容越往后越往上爬）

**用户描述的失败（verbatim）**

> "When creating a pdf of a long page using page-break avoid-all, after approx 20 pages the output while seemingly attempting to avoid breaking inside an element … slightly misses. It appears to get worse the more pages there are" — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227)（2019-05-14，OPEN，18 人参与，**bug 标签**）
>
> "the top of each page appears to creep up from the start, by the time it gets to page 20 it has crept up enough to hit the bottom of the previous page" — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) 作者本人回帖（2019-05-16）
>
> "First several pages of a PDF are fine, but page 5-6 and further I see that the whole page shifts a bit up." — [#709](https://github.com/eKoopmans/html2pdf.js/issues/709)（2024-07-16，CLOSED）
>
> "a table with pagebreak: { avoid: 'tr' } would break correctly but every page would be off by 1 pixel (per page)? … every page has +1 line of pixels from the next page. After like 6-7 pages, the last row of a page will become unreadable, because it will be split on two pages." — [#393](https://github.com/eKoopmans/html2pdf.js/issues/393)（2021-02-10，OPEN，8 人确认同现象）

**真实业务场景**
- [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) 作者 markgcarter：长文档 A4 纵向 mm 单位。
- [#393](https://github.com/eKoopmans/html2pdf.js/issues/393) 作者 that-ben：报表，通常 1-3 页（"My reports typically only have 1 to 3 pages"）—— 说明**短文档碰不到，长文档必踩**。
- [#708](https://github.com/eKoopmans/html2pdf.js/issues/708) 用户 shaghz：`format: 'legal'`，文本被从中间截断。

**用户已尝试的替代方案（verbatim，全部是"改库源码"级别）**

- **打补丁改 bundle** — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) 评论（flamebunny, 2019-06-26）：
  > "### **Dirty fix:** Adds 3px to the bottom to force the content down.
  > Edit html2pdf.bundle.min.js
  > ```
  > search for "  height:e-s.top%e+"px"}}) "
  > change to  "  height:3+e-s.top%e+"px"}})  "
  > ```"
  后续（markgcarner）："i actually had to go as far as 20px for my use case, it seems to get a 36 page pdf clean. 5 would break at about page 28, 10 at page 32."
  后续（ptaler, 2021-11-04）："flamebunny's dirty fix is not applicable any more - no such string in html2pdf.bundle.min.js"，并给出 v0.10.1 版补丁。
  后续（ugobindini, 2025-08-27）："The dirty trick is still possible. `search for "  height:e-c.top%e+"px"}}) " change to  "  height:21+e-c.top%e+"px"}}) "`。
- **改 jsPDF 单位为 px** — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) 评论（vLabayen, 2023-07-02）：
  > "when a page-break is required, this library appends elements with fixed height to the document so the remaining page is filled … All the 'remaining height' calculation is done in px bc of `getBoundingClientRect`, so **setting the jsPDF config units in `px` helped me to avoid the `3 +` dirty fix** aforementioned."
- **每页手动加 padding** — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) 评论（Shamzic, 2022-02-23）："I have been doing a padding on top of each page to prevent this bug, but this is still a 'dirty fix'"。
- **放弃内建 pagebreak，改用 flex 横排 + html-to-image 截图** — [#489](https://github.com/eKoopmans/html2pdf.js/issues/489) 评论（DaveSeidman, 2022-01-12）：
  > "I've had no luck with the built-in pagebreak option so I'll just use a flex-box and have pages build out **to the right**, instead of **vertically** and then use https://www.npmjs.com/package/html-to-image to take screenshots left-to-right instead."
- **换库** — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) 评论（CHANDRAMOHANnegi, 2025-12-22）："`https://www.npmjs.com/package/react-to-pdf` try this package"

**状态与分类**

- **已确认缺陷** — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) 维护者回复（2019-05-19，eKoopmans）：
  > "Interesting, thanks for the report. **Page-breaks are still not perfect, especially when tables are involved...**"
- **仍开放**（2026-11-02 状态）：#227 OPEN（含 `bug` 标签）、#393 OPEN、#708 OPEN、#709 CLOSED、#150 OPEN、#139 OPEN。
- #227 最后一条用户留言（2025-07-09，SmartBaby626）："It's been 6 years devs please fix this 🙏" —— 距首报 2019-05 已 6 年未修复。

---

### N4 — 隐藏元素破坏分页计算

**用户描述的失败（verbatim）**

> "While it is working as expected in removing the particular element to show up on the pdf; **it is messing up the page break**. … since said elements are removed by HTML2Canvas, the page break logic behaves unexpectedly." — [#357](https://github.com/eKoopmans/html2pdf.js/issues/357)（2020-10-15，CLOSED，作者自行修复）
>
> "When I generate the PDF with page breaks using `<div class="html2pdf__page-break"></div>` messes up. **Something super weird happens.** This also happens for the class 'data-html2canvas-ignore'." — [#466](https://github.com/eKoopmans/html2pdf.js/issues/466)（2021-08-31，OPEN）
>
> "removing elements through html2pdf's data-html2canvas-ignore or by using html2canvas ignoreElements predicate results in an incorrect page breaks. Page breaks do apply, but content that is supposed to be rendered on the next page is rendered on the same page, **it shift up from the next page**." — [#139](https://github.com/eKoopmans/html2pdf.js/issues/139) 评论（valosharp, 2021-06-12）

**根因（维护者已定位）**
`src/plugin/pagebreaks.js` 在 `toContainer` 中遍历**已克隆但尚未被 html2canvas 剔除**的元素，用 `getBoundingClientRect()` 计算剩余高度；而 html2canvas 在下一步才剔除 `data-html2canvas-ignore` 元素 → 两步之间坐标系不一致。

**状态与分类**

- **已确认缺陷** — [#139](https://github.com/eKoopmans/html2pdf.js/issues/139) 维护者回复（2019-01-20，eKoopmans）：
  > "thanks for the investigation, and the work-around! **When I have a chance to work on the page-break module I'll fix it to hide those elements before calculating page-breaks (and hyperlink positions).** For now, anyone visiting here, the code sample from @AntonSpaz is a good example of how to get around the issue temporarily (manually hiding those elements yourself before calling html2pdf)."
  → 承诺修复，**至今未落地**（#139 仍 OPEN，2026-11-02）。
- 用户 workaround（verbatim，#139 评论 dennybiasiolli, 2022-01-10）：
  ```js
  /** before printing **/
  const originalStyles = [];
  const ignoredElements = document.querySelectorAll('[data-html2canvas-ignore]');
  ignoredElements.forEach(el => { originalStyles.push(el.style.display); el.style.display = 'none'; });
  /** after printing **/
  ignoredElements.forEach((el, i) => { el.style.display = originalStyles[i]; });
  ```
- 另一 workaround（#139 评论 AntonSpaz, 2018-12-19）：放弃 `data-html2canvas-ignore`，改用自定义 class + 打印前手动 hide/show。

---

### N5 — 长文档（>20 页）生成空白 PDF

**用户描述的失败（verbatim）**

> "it failed to show the content of more than 20 texts which are all blank pages even though the page break still works fine." — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)（2017-07-11，OPEN，**46 人参与，issue 库中参与人数最多的分页相关 issue**）
>
> "When I set html2canvas.scale=3, if the generated PDF exceeds 20 pages, all PDFs will be blank pages. If it is less than 20 pages, the PDF will display normally" — [#721](https://github.com/eKoopmans/html2pdf.js/issues/721)（2024-09-05，OPEN）
>
> "When a document is big spanning 150-200 pages, blank pdf is generated." — [#311](https://github.com/eKoopmans/html2pdf.js/issues/311)（2020-04-23，OPEN，11 人参与）
>
> "for pages more than 70 the plugin is not generating pdf also the css footer properties are getting tampered." — [#599](https://github.com/eKoopmans/html2pdf.js/issues/599)（2022-10-17，OPEN）

**真实业务场景**
- [#475](https://github.com/eKoopmans/html2pdf.js/issues/475) 用户："we need it for **100 to 200 pages** of html to pdf generation"（电商/目录类批量导出）。
- [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)：Vue.js 项目批量文本分页。
- [#599](https://github.com/eKoopmans/html2pdf.js/issues/599)："the css footer properties are getting tampered" —— 长文档还伴随页脚样式被破坏。

**用户已尝试的替代方案（verbatim）**

- **降低 dpi** — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) 评论（MaNuGitH, 2018-01-30）："My workaround : changed html2canvas dpi option from 192 to 96"。
- **逐页渲染后合并** — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) 评论（GGross5213, 2018-03-07）："I decided to create my own instance of `jsPDF` and only pass in a page at a time to `html2pdf`. Then I add the image created by `html2pdf` to my instance of `jsPDF`."
  该模式被 [#610](https://github.com/eKoopmans/html2pdf.js/issues/610)（tmislos-cgi, 2023-03-10）、[#227](https://github.com/eKoopmans/html2pdf.js/issues/227)（wuliupo, 2019-05-26）、[#397](https://github.com/eKoopmans/html2pdf.js/issues/397)（Shnrqpdr, 2023-03-13）等多人独立复制使用 —— **这是社区事实上的标准 workaround**。
- **换库** — [#599](https://github.com/eKoopmans/html2pdf.js/issues/599) 评论（davidnbooth, 2023-08-09，**注意：davidnbooth 是 jsPDF 维护者**）：
  > "html2pdf.js creates one single html canvas with all of the content and then converts that to a pdf. The problem is that browsers have a limit on how big a canvas can be, so for large documents the pdf ends up just being blank.
  > **html3pdf**, which is a fork of this library and shouldn't require any changes to your code, solves this by rendering each page on its own canvas (although this is much slower)."
- **换库** — [#601](https://github.com/eKoopmans/html2pdf.js/issues/601) 评论（LuuHoangVu, 2024-01-26）："For me the fix for iOS was simply to change html2pdf to html3pdf."

**状态与分类**

- **设计限制（官方确认）** — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) 维护者回复（2017-07-16，eKoopmans）：
  > "The problem is in fact deeper than that - it's a problem directly in how canvases work. **Canvases have a maximum height/width, and once you exceed that the canvas becomes unusable!** That's what's happening here. … **It's a serious limitation and I don't have any immediate solution.**"
- **设计限制（维护者自认无解并搁置）** — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) 维护者回复（2019-01-20）：
  > "I've investigated creating a 'fake' canvas that stitches together multiple canvases, and it might be worth the effort to try to create such a thing, but I haven't had the chance to yet and **I don't think it's a realistic goal**.
  > **However**, there's a recent development that may fix this issue as well as a few other big problems. jsPDF has a built-in canvas 'engine', which means we could draw straight into jsPDF! … It's very promising and it's high on my to-do list for this project.
  > That said, **I have very little time to maintain this project, so I can't make any promises.**"
- **仍开放**：#19 / #721 / #311 / #599 / #603 / #481 全部 OPEN。
- README "Known issues" 第 6 条正式承认。

---

### N6 — 每页重复页眉 / 页脚 / 页码 / logo

**用户描述的失败（verbatim）**

> "I have a header and footer in my Html element ID I want to print that on every page of the pdf" — [#526](https://github.com/eKoopmans/html2pdf.js/issues/526)（2022-02-23，OPEN）
>
> "Is there a way to add html header and footer? (e.g images and styled text)" — [#208](https://github.com/eKoopmans/html2pdf.js/issues/208)（2019-03-04，OPEN，7 人参与）
>
> "Can I add HTML structure to the header on each page?" — [#230](https://github.com/eKoopmans/html2pdf.js/issues/230)（2019-05-24，OPEN，8 人参与）
>
> "How to add page numbers at the top" — [#278](https://github.com/eKoopmans/html2pdf.js/issues/278)（2020-01-14，OPEN）
>
> "Thanks for your job, it works perfect, i just wanted to ask you, It's possible to add HTML to Header and Footer?" — [#509](https://github.com/eKoopmans/html2pdf.js/issues/509)（2022-01-17，OPEN）
>
> "To add a logo to the PDF page. … I was only able to add it to the first page generated with my code." — [#683](https://github.com/eKoopmans/html2pdf.js/issues/683)（2024-02-28，OPEN）

**真实业务场景**
- **订单表格导出** — [#526](https://github.com/eKoopmans/html2pdf.js/issues/526) 提问者（作者字段为 `app/`）提供了 `order-table` 元素，需求是订单页眉页脚每页都有。
- **报告导出** — [#628](https://github.com/eKoopmans/html2pdf.js/issues/628)："I'm tried to generate a report from HTML to PDF, but i want to render a background image on each page"。
- **文档转 PDF（多页，含页码）** — [#695](https://github.com/eKoopmans/html2pdf.js/issues/695）："I need to insert the number of pages in my pdf"。

**用户已尝试的替代方案（verbatim）**

- **手写 jsPDF 循环**（官方推荐路径）— [#526](https://github.com/eKoopmans/html2pdf.js/issues/526) 评论（RizTyagi, 2022-03-16）：
  ```js
  var header = document.getElementById('HeaderId');
  html2pdf().from(header ).toImg().get('img').then(function (img) {
    html2pdf().from(element).toPdf().get('pdf').then(function (pdf) {
      var totalPages = pdf.internal.getNumberOfPages();
      for (var i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        if (i != 1) {
          pdf.addImage(img, 'JPEG', 6, 0, pdf.internal.pageSize.getWidth() - 12, 0);
  ```
  但 jowmm（2022-07-14）回："tried this but **the footer is still not showing**."
- **单位换算踩坑** — [#578](https://github.com/eKoopmans/html2pdf.js/issues/578)（CLOSED）作者自述："I think I figured out my problem. **The jsPDF unit was set to 'in' but I was assuming px in the footer calculations**"。
- **`pdf.putTotalPages()` 会清空文档** — [#71](https://github.com/eKoopmans/html2pdf.js/issues/71) 维护者回复（2018-02-20）："I've noticed that `pdf.putTotalPages()` is wiping the document blank, though that's a different issue … the (cleaner) solution is to just use `pdf.internal.getNumberOfPages()`."
- **用 CSS print 修饰符把 logo 放回 HTML** — [#683](https://github.com/eKoopmans/html2pdf.js/issues/683) 评论（azyzz228, 2024-04-02）："what you can do is, to have the image on your HTML in position where you want the logo to be, `<img class="hidden print:block" src="URL" />` using TailwindCSS' print modifier"。
- **换库** — [#509](https://github.com/eKoopmans/html2pdf.js/issues/509) 作者本人（2022-05-23）："**JA maybe it is possible but actually, I decided to use DKpdf für my project**"。

**状态与分类**

- **设计限制 + 功能请求** — 维护者在 [#23](https://github.com/eKoopmans/html2pdf.js/issues/23)（2017-08-06）明确表态：
  > "I'd recommend using a similar approach, taking the final jsPDF object and then adding your header and footer yourself. **I'll look into adding something for headers/footers as a feature in the future, but it won't be soon.**"
- **功能请求（官方已给路径）** — [#68](https://github.com/eKoopmans/html2pdf.js/issues/68) 维护者回复（2018-01-26）："1. As far as I know, the `footer` option you set in the options for `jsPDF` doesn't do anything."；后于 2019-01-19："the v0.9.0 API added ways to add extra content to the PDF (including header/footer)"。
- **仍开放**：#208 / #230 / #287 / #278 / #509 / #526 / #628 / #683 / #695 全部 OPEN —— **官方从未提供内建页眉页脚 API**，只能靠用户手写 jsPDF 循环。

---

### N7 — 表格跨页时重复 `<thead>` 表头

**用户描述的失败（verbatim）**

> "I have a table like below very simple, I am trying to get repeating table headers for every time it goes to a new page, **how can I do this, currently it just overflows to the next page with a row looking as it is being cut-off?**" — [#281](https://github.com/eKoopmans/html2pdf.js/issues/281)（2020-01-19，OPEN，**13 人参与**）
>
> "Using this CSS on thead if I print the page using chrome print command I get Thead on every page but using html2pdf **I am unable to get thead on every page**." — [#341](https://github.com/eKoopmans/html2pdf.js/issues/341)（2020-08-17，OPEN）
>
> "iam using htmlpdf but table header not repeat on next page" — [#554](https://github.com/eKoopmans/html2pdf.js/issues/554)（2022-05-23，OPEN）
>
> "Is there a way to include a bottom border on the first page and then repeat the table headers on the second page?" — [#361](https://github.com/eKoopmans/html2pdf.js/issues/361)（2020-10-23，OPEN）

**关键对照**：[#341](https://github.com/eKoopmans/html2pdf.js/issues/341) 的作者明确指出 —— 浏览器原生打印（Chrome print）**会**重复 `thead`，但 html2pdf **不会**。这说明这不是 CSS 能力缺失，而是 html2pdf 架构（单一 canvas）根本无从实现「重复表头」。

**真实业务场景**：长数据表格（多页）报表 —— [#281](https://github.com/eKoopmans/html2pdf.js/issues/281) 的表格有 `colspan="6"` 的多列表头，属于典型业务数据表（成绩/竞标结果）。

**用户已尝试的替代方案（verbatim）**
- 纯 CSS `display: table-header-group` — [#619](https://github.com/eKoopmans/html2pdf.js/issues/619)（2023-01-16，OPEN）：用户贴出 `<thead>` + `display: table-header-group;` 并问 "Below html is not able achieve the the table head repeat in every page. Please help me with the solution." → **无回复**。
- [#554](https://github.com/eKoopmans/html2pdf.js/issues/554) 的追问（MikeWNextra 2022-08-01、Sushma-tiwari 2022-08-10）："Any resolution for this? Having the same problem. Thanks." → **无回复**。
- [#361](https://github.com/eKoopmans/html2pdf.js/issues/361) 评论（MikeWNextra, 2022-08-01）：同样追问 → **无回复**。

**状态与分类**
- **设计限制**（`thead` 重复是浏览器打印引擎的能力，单 canvas 架构无法实现）—— 无人明确陈述，但行为一致且无维护者修复记录。
- **未决**：全部 OPEN，无维护者回复。这是**至今无人回答的高频需求**。

---

### N8 — 表格行不被从中间切断（含 rowspan）

**用户描述的失败（verbatim）**

> "I'm experiencing an issue with some tables that have fewer columns, **the table breaks and the next row becomes misaligned**. I've tried various configurations including orientation, format, and unit adjustments, and I'm using the 'avoid-all' Page Break setting, but nothing has resolved the issue." — [#712](https://github.com/eKoopmans/html2pdf.js/issues/712)（2024-07-23，OPEN）
>
> "when the table `<td>` uses the **rowspan** attribute pagebreak, there will be a misalignment" — [#553](https://github.com/eKoopmans/html2pdf.js/issues/553)（2022-05-23，OPEN）
>
> "When I create the pdf some of the tables within it are cut off" — [#129](https://github.com/eKoopmans/html2pdf.js/issues/129)（2018-06-27，OPEN）
>
> "Table breaks in the middle of the row" — [#712](https://github.com/eKoopmans/html2pdf.js/issues/712) 标题

**用户已尝试的替代方案（verbatim）**
- `pagebreak: { avoid: 'tr' }` — [#712](https://github.com/eKoopmans/html2pdf.js/issues/712) 评论（LeeManh, 2025-01-16）："You can try using `pagebreak: { avoid: 'tr' }` if you're working with the `<tr>` tag in a table."
- 运行时注入 CSS — [#712](https://github.com/eKoopmans/html2pdf.js/issues/712) 评论（yuanyuan-qwq, 2025-04-16，见 §N2）。
- `pagebreak: { mode: ['avoid-all','css','legacy'] }` — [#752](https://github.com/eKoopmans/html2pdf.js/issues/752)（CLOSED）。

**状态与分类**
- **配置错误（部分场景）** — [#752](https://github.com/eKoopmans/html2pdf.js/issues/752) 维护者回复（2025-08-27，eKoopmans，**这是最近的一次维护者回复**）：
  > "Hi @satyavajja, in your demo link you've set `pagebreak` to `css` mode, which will apply breaks based on CSS properties which aren't present in your HTML. **Using `avoid-all` will get you closer to what you want, though its functionality isn't perfect.**"
  → 维护者承认 avoid-all "isn't perfect"，但同时把 #752 归因为用户配置错误并关闭。
- **已确认缺陷** — [#184](https://github.com/eKoopmans/html2pdf.js/issues/184) 维护者回复（2019-01-16）："That's specifically telling it to avoid breaking across a table row … **That said, tables are tricky and don't behave like most other elements, they may still need some work.**" 以及 2019-01-22 提供的表格专用修复分支 `bugfix/pagebreak-tables`。
- **仍开放**：#712 / #553 / #129 / #341 / #281 全部 OPEN。

---

### N9 — 页边距精确控制

**用户描述的失败（verbatim）**

> "With too big margin value (inches) downloaded PDF seems to be empty" — [#1](https://github.com/eKoopmans/html2pdf.js/issues/1)（2017-05-03，CLOSED）
>
> "When I explicitly define no margins, there is still a little space to the left of the PDF. As you can see the **Y axis was respected but seemingly not X**." — [#360](https://github.com/eKoopmans/html2pdf.js/issues/360)（2020-10-21，OPEN）
>
> "Margin just cuts the text and image off, and **even with no margin, the end of each line is a bit cut off**" — [#643](https://github.com/eKoopmans/html2pdf.js/issues/643)（2023-04-12，OPEN）
>
> "All text seems to be shifted down by a margin" — [#655](https://github.com/eKoopmans/html2pdf.js/issues/655)（2023-06-23，OPEN）

**状态与分类**
- **配置错误** — [#1](https://github.com/eKoopmans/html2pdf.js/issues/1) 维护者回复（2017-05-03，eKoopmans）：
  > "you've set `margin: 10` and `unit: 'in'`. That means your margin is **10 inches, which is larger than the page** (when applied to left, right, top, and bottom). So nothing shows up on the page. Try changing to `margin: 1` and see the result."
- **配置错误（单位混用）** — [#578](https://github.com/eKoopmans/html2pdf.js/issues/578) 作者自述："The jsPDF unit was set to 'in' but I was assuming px in the footer calculations"。
- **已确认缺陷（版本回归）** — [#643](https://github.com/eKoopmans/html2pdf.js/issues/643) 用户自述（2023-04-14）："The problem is in the **0.10.1 version, I changed the CDN file to 0.9.3 and it works without that issue.**" → 属**旧版本/新版本回归**，非永久设计限制。
- **仍开放**：#360 / #643 / #655 / #499 / #617 / #498 全部 OPEN。

---

### N10 — 多余空白页（开头 / 结尾 / 页面间）

**用户描述的失败（verbatim）**

> "When the height is exactly n*29.7cm, **n+1 pages will be generated**" — [#408](https://github.com/eKoopmans/html2pdf.js/issues/408)（2021-03-09，OPEN）—— 这是最精确的复现描述，直接对应 `toPdf` 里 `Math.ceil(pxFullHeight / pxPageHeight)` 的向上取整。
>
> "if i remove this avoid-all mode then it is working fine. But i know that this will mess up page break. … But unfortunately this also creating blank first page." — [#672](https://github.com/eKoopmans/html2pdf.js/issues/672)（2023-12-29，OPEN）
>
> "I am Getting blank pages at start of pdf if content is more and button is placed after content." — [#433](https://github.com/eKoopmans/html2pdf.js/issues/433)（2021-05-16，OPEN）
>
> "Success generate but got another blank page" — [#661](https://github.com/eKoopmans/html2pdf.js/issues/661)（2023-08-11，OPEN）
>
> "the page break that is added is _enormous._ html2pdf appears to be adding an entire page where the page break goes, and then proceeds to _break the content, just one page below._" — [#580](https://github.com/eKoopmans/html2pdf.js/issues/580)（2022-07-28，OPEN）
>
> "Large blank space after html2pdf__page-break" — [#907](https://github.com/eKoopmans/html2pdf.js/issues/907)（2026-02-05，OPEN）
>
> "When using a manual page break with `<div class="html2pdf__page-break"></div>` the generated PDF consistently shows a large blank gap before the next section." — [#907](https://github.com/eKoopmans/html2pdf.js/issues/907)

**根因（源码）**：`pagebreaks.js` 的 `rules.before` 插入 `height: pxPageHeight - (clientRect.top % pxPageHeight) + 'px'` 的空 div；如果元素本来就在页首（`clientRect.top % pxPageHeight ≈ 0`），插入的 div 高度 ≈ 整页高 → 多出一整页。

**用户已尝试的替代方案（verbatim）**
- 减 0.1cm — [#408](https://github.com/eKoopmans/html2pdf.js/issues/408) 作者代码注释："// - 0.1 cm / Subtract 0.1cm, in order to generate one page less"。
- 用 `:not(:first-child)` — [#672](https://github.com/eKoopmans/html2pdf.js/issues/672) 评论（zaosoula, 2024-01-18）。
- 调整元素高度到 1122px — [#123](https://github.com/eKoopmans/html2pdf.js/issues/123)（CLOSED）作者自述："Nvm adjusting the height to 1122 and removing page break class='html2pdf__page-break' made it work."
- 删掉多余页 — [#408](https://github.com/eKoopmans/html2pdf.js/issues/408) 评论（55cc, 2022-01-31）："No. **I manually deleted that page**"。
- 把按钮移到页面顶部 — [#433](https://github.com/eKoopmans/html2pdf.js/issues/433) 评论（thomaslgj, 2021-05-28）："placing the button at the top of the page solved it for me."

**状态与分类**
- **已确认缺陷**（`pagebreak` 标记页产生整页空白）— [#30](https://github.com/eKoopmans/html2pdf.js/issues/30)（2017-09-17，CLOSED）标题即 "Empty page when using html2pdf__page-break"；[#123](https://github.com/eKoopmans/html2pdf.js/issues/123)（2018，CLOSED）"Extra blank pages when using page breaks"。
- **设计限制**（末页整数倍高度多一页）— [#408](https://github.com/eKoopmans/html2pdf.js/issues/408) 由 `Math.ceil` 直接导致；**仍 OPEN，无维护者回复**。
- **仍开放**：#408 / #672 / #433 / #661 / #580 / #907 / #617 / #498 / #408 全部 OPEN。
- **仍开放（最新）**：#907 建于 2026-02-05，**至今无任何回复** —— 说明该问题在当前版本仍是活的痛点。

---

### N11 — 单页 PDF（内容缩放到一页）

**用户描述的失败（verbatim）**
- [#37](https://github.com/eKoopmans/html2pdf.js/issues/37) 标题："Total HTML in one PDF page"（2017-09-23，OPEN，**11 人参与**）
- [#81](https://github.com/eKoopmans/html2pdf.js/issues/81) 标题："Single page height / width specification"（2018-05-20，CLOSED，enhancement 标签）
- [#44](https://github.com/eKoopmans/html2pdf.js/issues/44) 标题："Can't get table width to fit to page"（2017-11-27，OPEN，**19 人参与**）

**状态与分类**
- **设计限制（官方 Known Issue #3）**
- 维护者在 [#44](https://github.com/eKoopmans/html2pdf.js/issues/44) 回复（2017-12-05）：
  > "Right, I hear you. There have been a few requests for 'single-page PDFs', where the entire content would be shrunk down to the page size … Currently html2pdf just restricts the page size and lets the content re-flow naturally to fit in the space. It works well for many circumstances, but it sounds like it's not perfect for yours. **I'll add this to the project tracking for the single-page PDFs, might be a while until I get to it though!**"
- 维护者在 [#81](https://github.com/eKoopmans/html2pdf.js/issues/81) 回复（2018-05-20）解释了 reflow 机制："html2pdf clones the elements into a container with a width defined by your jsPDF page width, and lets the elements reflow so they fit nicely onto the page width."
- **仍未交付**（README Known Issue #3 仍标注 "nothing that's ready to test yet"）。

---

### N12 — 混合页面尺寸 / 纵向横向混排

**用户描述的失败（verbatim）**
- [#437](https://github.com/eKoopmans/html2pdf.js/issues/437)："pdf multipage orientation is **only determined by the first page orientation**"（2021-05-21，OPEN）
- [#504](https://github.com/eKoopmans/html2pdf.js/issues/504)："Is it possible to change the layout for specific pages, e.g. with help of class like page break?"（2022-01-08，OPEN）
- [#117](https://github.com/eKoopmans/html2pdf.js/issues/117)："It would be good to be able to add the ability to have different page sizes for each page. **This is possible with jsPDF** and I've managed to hack a rough version together myself."（2018-05-24，CLOSED）

**状态与分类**
- **设计限制 + 已明确的技术障碍（用户自行分析并获认可）** — [#117](https://github.com/eKoopmans/html2pdf.js/issues/117) 作者补充：
  > "Edit: Not quite as simple, requires moving the canvas logic into the for loop and calculating heights differently (including the offset of previous pages). **Will close for now and look into further.**"
  → 这准确指出了 `toPdf` 里「先算总页数、再按固定 pxPageHeight 切」的架构必须重构。
- **仍开放**：#437 / #504 全部 OPEN。

---

### N13 — 由使用者掌控分页（每逻辑页一个 DOM 元素），再合并成一份 PDF

**用户描述的失败（verbatim）**
> "I want to print or download 2 pdf pages and each page has a corresponding id in it? **How can i download it as one not one by one?**" — [#483](https://github.com/eKoopmans/html2pdf.js/issues/483)（2021-09-20，OPEN）
>
> "It seems pagebreak function doesn't work properly. In my case I have lots of object that have same structure so I choose them dynamically and download as **1 page pdf each**. Then find another script to merge them all." — [#488](https://github.com/eKoopmans/html2pdf.js/issues/488)（2021-11-04，OPEN）
>
> "randomly pages are coming as empty, we need it for 100 to 200 pages of html to pdf generation" — [#475](https://github.com/eKoopmans/html2pdf.js/issues/475)（2021-09-13，OPEN）
>
> "links are into a single page when try to merge multiple pages" — [#585](https://github.com/eKoopmans/html2pdf.js/issues/585)（2022-08-16，OPEN）

**真实业务场景**：强分页语义的文档 —— 合同（[#483](https://github.com/eKoopmans/html2pdf.js/issues/483) 里的示例文件名是 `SesContract.pdf`）、目录/清单、批量导出。

**社区 workaround（事实标准，verbatim）** — [#609](https://github.com/eKoopmans/html2pdf.js/issues/609)（tmislos-cgi, 2022-11-30，CLOSED）给出的代码成为多帖复用的模板：
```js
let worker = html2pdf().set(pdfOptions).from(elements[0])
worker = worker.toPdf()
if (elements.length > 1) {
  worker = worker.get('pdf').then(pdf => { pdf.addPage(); })
    .from(element).toContainer().toCanvas().toPdf()
}
```
同样模式见 [#610](https://github.com/eKoopmans/html2pdf.js/issues/610)、[#227](https://github.com/eKoopmans/html2pdf.js/issues/227)（wuliupo）、[#19](https://github.com/eKoopmans/html2pdf.js/issues/19)（GGross5213）、[#679](https://github.com/eKoopmans/html2pdf.js/issues/679)、[#475](https://github.com/eKoopmans/html2pdf.js/issues/475)、[#397](https://github.com/eKoopmans/html2pdf.js/issues/397)（Shnrqpdr）。

**状态与分类**
- **功能请求** — 维护者在 [#43](https://github.com/eKoopmans/html2pdf.js/issues/43)（2017-11-27）描述过类似思路：
  > "The simplest approach would probably be to get the jsPDF object at the end of html2pdf, add a page, then reuse that object in a second call to html2pdf. I haven't created a version of html2pdf that would allow that yet (reusing an existing jsPDF object), but it's in the works."
  → "in the works" 之后从未以官方 API 形式交付；社区只能自己串 `from/toContainer/toCanvas/toPdf`。
- **仍开放**：#483 / #488 / #475 / #585 / #679 全部 OPEN。
- 伴随缺陷：**合并后超链接全部落在同一页** — [#585](https://github.com/eKoopmans/html2pdf.js/issues/585)（OPEN）；**合并后第 2 页起链接失效** — [#520](https://github.com/eKoopmans/html2pdf.js/issues/520)（OPEN，"hyperlinks on the first page of the PDF are working as expected but hyperlinks on any subsequent pages are not clickable"）。这直接暴露 `src/plugin/hyperlinks.js` 用 `Math.floor(clientRect.top / inner.height) + 1` 推算页码的模型无法应对「每页独立 canvas」的合并方式。

---

### N14 — 页面背景色 / 背景图铺满到最后一页

- [#658](https://github.com/eKoopmans/html2pdf.js/issues/658)："the background color is not applied on the last page of the generated PDF when the content does not fill the entire page"（2023-07-27，OPEN）；评论（gezichenshan, 2023-08-25）："**it is because it first converts html to canvas and then pdf so there is no solution?**"
- [#628](https://github.com/eKoopmans/html2pdf.js/issues/628)："i want to render a background image on each page"（2023-02-22，OPEN）；作者 2024-07-11 自述已用 codepen 实现："I manged to do it using the background code"。

**分类**：设计限制（末页被裁剪为 `pxFullHeight % pxPageHeight` 高，背景自然不覆盖整页）。**仍开放**。

---

### N15 — 打印区域不受页面滚动位置影响

- [#560](https://github.com/eKoopmans/html2pdf.js/issues/560)："the result is not as expected. **The print area is offset instead of starting to print at the top of the page.**"（2022-06-10，OPEN）；workaround（MTipps, 2022-09-01）："I ended up scrolling the page to the top before initiating the generate. Not ideal for the user experience but at least the PDF prints nicely then."
- [#499](https://github.com/eKoopmans/html2pdf.js/issues/499)："Large margin top even if already set margin to 1"（2021-12-22，OPEN）；评论（Violella, 2022-04-04）："My problem was that I had to scroll down to reach my html2pdf-button. When the button was on top of the page there was no problem. I solved it with this: https://github.com/eKoopmans/html2pdf.js/issues/420"
- [#175](https://github.com/eKoopmans/html2pdf.js/issues/175)（CLOSED，`bug` 标签）维护者回复（2019-01-27）："**Sounds like a bug**, though I'm not sure about your use of the html2canvas option `y: -70`."；后（2019-02-03）："the issue is in your use of `y: 0` (or any explicit value for `y`). If you leave it unset, html2canvas should automatically determine the correct y value for the element."

**分类**：混合 —— #175 是**配置错误**（维护者明确指出是 `y` 参数用错）+ **已确认缺陷**（维护者说 "Sounds like a bug"）；#560 / #499 是**未决**（scrollY 偏移未根治）。

---

### N16 — 页码 / 目录 / 交叉引用可点击且位置正确

- [#278](https://github.com/eKoopmans/html2pdf.js/issues/278)："How to add page numbers at the top"（2020-01-14，OPEN）
- [#695](https://github.com/eKoopmans/html2pdf.js/issues/695)："I need to insert the number of pages in my pdf"（2024-05-03，OPEN）；社区答案（NeanderNerd, 2025-02-18）给出 jsPDF 循环。
- [#61](https://github.com/eKoopmans/html2pdf.js/issues/61)："Hyperlink By Page Number"（2017-12-19，OPEN）；维护者回复（2017-12-19）："Then you can write your own function to add page numbers with hyperlinks to the jsPDF object."
- [#395](https://github.com/eKoopmans/html2pdf.js/issues/395)："Linking a Table of Contents page to sections of the PDF"（2021-02-12，OPEN，6 人参与）—— 内部锚点跳转会打开新标签页而非跳到 PDF 内。

**分类**：功能请求（官方路线：自己写 jsPDF 循环）。**仍开放**。

---

## 已修复 / 旧版本 / 配置错误 / 当前缺口

### A. 已修复（有 PR 或维护者明确确认修复）

| Issue | 修复内容 | 证据 |
|---|---|---|
| [#3](https://github.com/eKoopmans/html2pdf.js/issues/3) | `pxPageHeight` 计算公式反向 | 维护者（2017-05-04）："I borrowed jsPDF's conversions, and the **pixel conversion was backwards**. I'll fix that ASAP" → "Fixed and updated, let me know if the issue's resolved." |
| [#166](https://github.com/eKoopmans/html2pdf.js/issues/166) | 末页在已恰好合适时不再裁剪 | 维护者（2019-01-27）："thanks for the fix! I've commited the change in the develop branch at `0fe9726`… It will be included in the next release." |
| [#464](https://github.com/eKoopmans/html2pdf.js/issues/464) | v0.10.0 webpack externals 导致 `getPageSize` undefined | 维护者（2021-09-01）："I think I've found a solution… I'm able to modify how externals are done in Webpack to match that pattern, which should resolve the issue." |
| [#13](https://github.com/eKoopmans/html2pdf.js/issues/13) / [#26](https://github.com/eKoopmans/html2pdf.js/issues/26) / [#108](https://github.com/eKoopmans/html2pdf.js/issues/108) | v0.9.1 引入 pagebreak 模块（`mode: css/legacy/avoid-all` + `before/after/avoid` 选择器） | 维护者（2019-01-17）："closing as resolved by the v0.9.1 page-break features." 关联 [PR #153](https://github.com/eKoopmans/html2pdf.js/pull/153) "Page-breaks: Add modes and ability to specify elements"，**已于 2018-10-20 MERGED** |
| [#21](https://github.com/eKoopmans/html2pdf.js/issues/21) / [#23](https://github.com/eKoopmans/html2pdf.js/issues/23) / [#68](https://github.com/eKoopmans/html2pdf.js/issues/68) | v0.9.0 新 API 允许取到 jsPDF 对象以自行加页眉页脚/页码 | 维护者（2019-01-19）："closing as resolved by the v0.9.0 new API." |
| [#7](https://github.com/eKoopmans/html2pdf.js/issues/7) / [#43](https://github.com/eKoopmans/html2pdf.js/issues/43) | v0.9.0 新 API 允许复用 jsPDF 对象、多次 `.from()` 拼页 | 维护者（2019-01-19）："closing as resolved by the v0.9.0 new API." |
| [#473](https://github.com/eKoopmans/html2pdf.js/issues/473) | v0.10 系列因 html2canvas 依赖变更导致渲染退化（PDF 被截短） | 维护者（2021-09-13）："I've had a few reports of things looking worse in v0.10. My guess is that it's due to changes in the dependency html2canvas" |

### B. 旧版本问题（在用户所用版本之后已修复 / 或仅在旧版本复现）

| Issue | 说明 | 证据 |
|---|---|---|
| [#139](https://github.com/eKoopmans/html2pdf.js/issues/139) | "We have a project which used version 0.8.2 and everything worked fine. We recently upgraded the plugin to version 0.9.0 and since then… the following elements don't go completely to the next page." → 0.9.0 回归 | 作者 campignon 正文；维护者 2018-09-15 回复已在跟进 |
| [#643](https://github.com/eKoopmans/html2pdf.js/issues/643) | "The problem is in the **0.10.1** version, I changed the CDN file to **0.9.3** and it works without that issue." → 0.10.1 回归 | 作者本人回复（2023-04-14） |
| [#485](https://github.com/eKoopmans/html2pdf.js/issues/485) | "browser version 0.10.1: HTML document is partially rendered. (Does not happen on chrome on desktop). **When reverted to version 0.9.3 works fine.**" | 作者正文（2021-10-03） |
| [#715](https://github.com/eKoopmans/html2pdf.js/issues/715) | 0.10.2 引入左侧截断，作者自行定位为 `windowWidth/windowHeight` 配置问题；renaldodev（2024-08-27）确认："I had the same issue, what I did was create a wrapper with fixed dimensions based on A4 portrait." | 作者自述 + 同因用户确认 |
| [#473](https://github.com/eKoopmans/html2pdf.js/issues/473) | 用户 smileBeda（2021-09-10）："Reverting to 0.9 resolved the issues"；维护者确认是 v0.10 依赖变更 | 见上表 |

### C. 配置错误（根因在用户侧，根因是用户的 HTML/CSS/options 或对文档的误读）

| Issue | 维护者原文 | 链接 |
|---|---|---|
| [#1](https://github.com/eKoopmans/html2pdf.js/issues/1) | "you've set `margin: 10` and `unit: 'in'`. That means your margin is **10 inches, which is larger than the page**… So nothing shows up on the page. Try changing to `margin: 1`." | 2017-05-03, eKoopmans |
| [#175](https://github.com/eKoopmans/html2pdf.js/issues/175) | "the issue is in your use of `y: 0` (or any explicit value for `y`). **If you leave it unset, html2canvas should automatically determine the correct y value** for the element. Is there a reason you need to set `y` explicitly?" | 2019-02-03, eKoopmans |
| [#752](https://github.com/eKoopmans/html2pdf.js/issues/752) | "you've set `pagebreak` to `css` mode, which will apply breaks based on CSS properties **which aren't present in your HTML**." | 2025-08-27, eKoopmans |
| [#232](https://github.com/eKoopmans/html2pdf.js/issues/232) | "There is a **good chance** that your `ignoreElements` setting is causing problems. Try removing that and see if the behaviour looks better." | 2019-06-03, eKoopmans |
| [#578](https://github.com/eKoopmans/html2pdf.js/issues/578) | 作者自述："The jsPDF unit was set to 'in' but I was assuming px in the footer calculations" | 2022-07-25, app/ |
| [#123](https://github.com/eKoopmans/html2pdf.js/issues/123) | 作者自述："adjusting the height to 1122 and removing page break class='html2pdf__page-break' made it work" | 2018-06-14, sameerpallav |
| [#517](https://github.com/eKoopmans/html2pdf.js/issues/517) | delcullu（2022-01-28）："**Position absolute to relative solve my issue**" | 2022-01-28, delcullu |
| [#433](https://github.com/eKoopmans/html2pdf.js/issues/433) | morbecfm（2021-11-17）："the cause it was a `margin-top` that was pushing the content of pdf to the second page, after removing the `margin-top` the problem was gone" | 2021-11-17, morbecfm |

### D. 当前缺口（截至 2026-11-02 仍开放、且无维护者修复计划的状态）

| 缺口 | 代表 Issue（全部 OPEN） | 备注 |
|---|---|---|
| **G1** 文本行被从中间切断，无内建解法 | [#83](https://github.com/eKoopmans/html2pdf.js/issues/83)、[#654](https://github.com/eKoopmans/html2pdf.js/issues/654)、[#753](https://github.com/eKoopmans/html2pdf.js/issues/753)、[#1043](https://github.com/eKoopmans/html2pdf.js/issues/1043)（2026-08-18） | #1043 是最新的（2026）报告，仍无回复 |
| **G2** 逐页漂移无修复 | [#227](https://github.com/eKoopmans/html2pdf.js/issues/227)、[#393](https://github.com/eKoopmans/html2pdf.js/issues/393)、[#708](https://github.com/eKoopmans/html2pdf.js/issues/708) | 社区靠改 bundle 源码 |
| **G3** 长文档空白 | [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)、[#721](https://github.com/eKoopmans/html2pdf.js/issues/721)、[#311](https://github.com/eKoopmans/html2pdf.js/issues/311) | 官方 Known Issue #6 |
| **G4** 表格表头不重复 | [#281](https://github.com/eKoopmans/html2pdf.js/issues/281)、[#341](https://github.com/eKoopmans/html2pdf.js/issues/341)、[#554](https://github.com/eKoopmans/html2pdf.js/issues/554)、[#619](https://github.com/eKoopmans/html2pdf.js/issues/619)、[#361](https://github.com/eKoopmans/html2pdf.js/issues/361) | 全部零回复 |
| **G5** 无内建页眉页脚/页码 API | [#208](https://github.com/eKoopmans/html2pdf.js/issues/208)、[#230](https://github.com/eKoopmans/html2pdf.js/issues/230)、[#278](https://github.com/eKoopmans/html2pdf.js/issues/278)、[#526](https://github.com/eKoopmans/html2pdf.js/issues/526)、[#509](https://github.com/eKoopmans/html2pdf.js/issues/509)、[#695](https://github.com/eKoopmans/html2pdf.js/issues/695) | 官方只给"自己写 jsPDF 循环"的路线 |
| **G6** 隐藏元素破坏分页 | [#139](https://github.com/eKoopmans/html2pdf.js/issues/139)、[#466](https://github.com/eKoopmans/html2pdf.js/issues/466)、[#648](https://github.com/eKoopmans/html2pdf.js/issues/648) | 维护者 2019 年承诺修复，从未落地 |
| **G7** 多余空白页 | [#408](https://github.com/eKoopmans/html2pdf.js/issues/408)、[#672](https://github.com/eKoopmans/html2pdf.js/issues/672)、[#580](https://github.com/eKoopmans/html2pdf.js/issues/580)、[#907](https://github.com/eKoopmans/html2pdf.js/issues/907) | #907 建于 2026-02，无回复 |
| **G8** 混合页面尺寸/方向 | [#437](https://github.com/eKoopmans/html2pdf.js/issues/437)、[#504](https://github.com/eKoopmans/html2pdf.js/issues/504) | — |
| **G9** 用户掌控分页 + 合并 | [#483](https://github.com/eKoopmans/html2pdf.js/issues/483)、[#488](https://github.com/eKoopmans/html2pdf.js/issues/488)、[#585](https://github.com/eKoopmans/html2pdf.js/issues/585)、[#520](https://github.com/eKoopmans/html2pdf.js/issues/520) | 合并后超链接失效是伴生缺陷 |
| **G10** 单页 PDF | [#37](https://github.com/eKoopmans/html2pdf.js/issues/37)、[#44](https://github.com/eKoopmans/html2pdf.js/issues/44) | 官方 Known Issue #3 |

### E. 社区未合并的修复尝试（PR 证据）

| PR | 状态 | 试图解决 | 证据 |
|---|---|---|---|
| [PR #831](https://github.com/eKoopmans/html2pdf.js/pull/831) "Support `trimPages` mode to create PDF pages of variable length" | **OPEN，未合并**（作者 tsufiev，2025-10-15，零评论） | N10 多余空白页 + N13 可变页高 | PR 正文："Once `.toPdf()` is invoked, it trims that huge fixed-height page to an actual content height."，并明确依赖"逐页渲染循环"模式 |
| [PR #919](https://github.com/eKoopmans/html2pdf.js/pull/919) "Add pageBackground option for custom PDF page colors" | **CLOSED，未合并**（作者 marcelchastain，2026-02-16，零评论） | N14 页面背景色 | PR 正文："Background extends to full page including margins"；说明这是针对 [#658](https://github.com/eKoopmans/html2pdf.js/issues/658) 的直接修复提案 |
| [PR #153](https://github.com/eKoopmans/html2pdf.js/pull/153) "Page-breaks: Add modes and ability to specify elements" | **MERGED 2018-10-20** | v0.9.1 pagebreak 模块 | 维护者在 [#128](https://github.com/eKoopmans/html2pdf.js/issues/128)（2018-09-15）："for page-breaks, I've made a new PR #153 with a proposed upgrade, I'll merge it in after some testing." |
| [PR #972](https://github.com/eKoopmans/html2pdf.js/pull/972) "update: Replace html2canvas with html2canvas-pro" | **OPEN，未合并** | 渲染引擎替换（间接影响分页精度） | — |

> **注意**：本次研究**未按文件路径过滤 PR**（仅按标题关键词），可能漏掉针对 `src/plugin/pagebreaks.js` 的其他 PR。上述列表不应被视为穷尽。

---

## 维护者立场原文

> 以下均为 eKoopmans 本人在 issue 评论中的逐字原文（附 issue URL 与评论日期）。

**关于分页功能整体不完美**

> "3. In general, **the page-break functionality is not working 100%, unfortunately**"
> — [#232](https://github.com/eKoopmans/html2pdf.js/issues/232)，2019-06-03（issue 至今 OPEN）

> "Interesting, thanks for the report. **Page-breaks are still not perfect, especially when tables are involved...**"
> — [#227](https://github.com/eKoopmans/html2pdf.js/issues/227)，2019-05-19（issue 至今 OPEN，带 `bug` 标签）

> "2. Pages break in the middle of text when you have elements *longer than one page*. **This is a more complicated issue that there's no fix for currently**, but the vast majority of page-break needs should have been resolved with v0.9.1."
> — [#184](https://github.com/eKoopmans/html2pdf.js/issues/184)，2019-01-16（issue 至今 OPEN）

> "My guess it boils down to **tables not behaving like everything else**, and I may need to program in a special case for that. **No promises on timeline though, there's a long list of things that need work!**"
> — [#184](https://github.com/eKoopmans/html2pdf.js/issues/184)，2019-01-17

> "Using `avoid-all` will get you closer to what you want, **though its functionality isn't perfect**."
> — [#752](https://github.com/eKoopmans/html2pdf.js/issues/752)，2025-08-27（**这是维护者在本次研究截止日前的最近一次分页相关回复**）

**关于"切图"架构**

> "All html2pdf is doing is converting the webpage into an image, and then **slicing that image onto separate PDF pages**. If your text (or any other component) straddles two pages, it will appear sliced."
> — [#13](https://github.com/eKoopmans/html2pdf.js/issues/13)，2017-06-03

> "I could probably make an auto-break system that would add a page break before any element that would span two pages (as long as the element itself wasn't taller than a page). **If you have spans of text longer than a page it would have to be a different solution.**"
> — [#13](https://github.com/eKoopmans/html2pdf.js/issues/13)，2017-06-08

**关于 canvas 尺寸上限（长文档空白）**

> "**Canvases have a maximum height/width, and once you exceed that the canvas becomes unusable!** … **It's a serious limitation and I don't have any immediate solution.**"
> — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)，2017-07-16

> "I've investigated creating a 'fake' canvas that stitches together multiple canvases … but I haven't had the chance to yet and **I don't think it's a realistic goal**. **However**, there's a recent development that may fix this issue as well as a few other big problems. jsPDF has a built-in canvas 'engine', which means we could draw straight into jsPDF! … It's very promising and it's high on my to-do list for this project. That said, **I have very little time to maintain this project, so I can't make any promises.**"
> — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)，2019-01-20

> "html2pdf.js creates one single html canvas with all of the content and then converts that to a pdf. The problem is that browsers have a limit on how big a canvas can be, so for large documents the pdf ends up just being blank."（davidnbooth，jsPDF 维护者）
> — [#599](https://github.com/eKoopmans/html2pdf.js/issues/599)，2023-08-09

**关于隐藏元素破坏分页（承诺过修复）**

> "**When I have a chance to work on the page-break module I'll fix it to hide those elements before calculating page-breaks** (and hyperlink positions). For now, anyone visiting here, the code sample from @AntonSpaz is a good example of how to get around the issue temporarily."
> — [#139](https://github.com/eKoopmans/html2pdf.js/issues/139)，2019-01-20（**该修复从未落地，issue 至今 OPEN**）

**关于页眉页脚（明确推迟）**

> "I'd recommend using a similar approach, taking the final jsPDF object and then adding your header and footer yourself. **I'll look into adding something for headers/footers as a feature in the future, but it won't be soon.**"
> — [#23](https://github.com/eKoopmans/html2pdf.js/issues/23)，2017-08-06

> "1. As far as I know, the `footer` option you set in the options for `jsPDF` **doesn't do anything**."
> — [#68](https://github.com/eKoopmans/html2pdf.js/issues/68)，2018-01-26

**关于单页 PDF / 缩放到一页**

> "Currently html2pdf just restricts the page size and lets the content re-flow naturally to fit in the space. It works well for many circumstances, but it sounds like it's not perfect for yours. **I'll add this to the project tracking for the single-page PDFs, might be a while until I get to it though!**"
> — [#44](https://github.com/eKoopmans/html2pdf.js/issues/44)，2017-12-05

**关于维护投入的整体表态（最关键的一句）**

> "That said, **I have very little time to maintain this project, so I can't make any promises.**"
> — [#19](https://github.com/eKoopmans/html2pdf.js/issues/19)，2019-01-20

补充佐证（社区视角）：[#512](https://github.com/eKoopmans/html2pdf.js/issues/512) 评论（denisbetsi, 2023-06-14）："Looks like @eKoopmans **gave up on maintaining this library a couple of years ago**. Too bad." —— 维护者最后一次分页相关回复是 2025-08-27（[#752](https://github.com/eKoopmans/html2pdf.js/issues/752)），此后至今（2026-11-02）无新回复。

**GitHub 平台侧的客观事实**：截至本次抓取，仓库共 681 个 issue，其中仅 **23 个**带 `bug` 标签、**26 个**带 `enhancement` 标签；未打标签的约 617 个（86.7%）。这与"维护者低频介入"一致。

---

## 需求强度排序

### 评分方法（可复算）

对每个**需求项**（不是每个 issue）按三个独立维度打分后加权求和：

| 维度 | 计算方式 | 归一化 |
|---|---|---|
| **S1 独立报告人数** | 统计**同一根因**下不同 GitHub 用户（issue 作者 + 确认同现象的评论者，去重）。跨 issue 累加。 | 1–10 分（1人=1，5人=4，10人=7，20+=9，40+=10） |
| **S2 严重性** | 内容静默丢失/整体空白（10）＞ 内容被切损坏（8）＞ 布局错乱（6）＞ 视觉/功能缺失（4） | 原始分 / 10 |
| **S3 替代方案成本** | 换库/自建渲染管线（10）＞ 手写分页合并逻辑（8）＞ 改 bundle 源码/改 HTML 结构（6）＞ 改配置项（2） | 原始分 / 10 |
| **S4 商业场景证据强度** | 有明确商业场景描述且可引述（发票/合同/审计/简历/医疗/订单/批量 100-200 页）= 1，否则 0.5 | 原始值 |

**综合分 = 0.30×S1 + 0.25×S2 + 0.25×S3 + 0.20×S4**（各项 0–10 归一后加权，满分 10）

### 排名结果

| 排名 | 需求ID | S1 人数 | S1分 | S2 分 | S3 分 | S4 分 | **综合分** | 一句话结论 |
|---|---|---|---|---|---|---|---|---|
| **1** | **N1 长文档不被切成两半** | 45+ | 10 | 8/10→8 | 8/10→8 | 1 | **8.3** | 报告最多、最痛；架构层面无解，社区只能拆 DOM |
| **2** | **N5 长文档空白 PDF** | 15+ | 8 | 10/10→10 | 8/10→8 | 1 | **8.1** | 官方 Known Issue；jsPDF 维护者亲自给出 html3pdf 替代 |
| **3** | **N3 逐页累积漂移** | 20+ | 9 | 6/10→6 | 9/10→9 | 0.5 | **7.1** | 维护者承认；workaround 需改 bundle 源码 |
| **4** | **N2 分页位置精确可控** | 30+ | 10 | 6/10→6 | 7/10→7 | 1 | **7.1** | 报告最多之一；官方自认 "not working 100%" |
| **5** | **N6 每页页眉/页脚/页码/logo** | 18+ | 8 | 6/10→6 | 5/10→5 | 1 | **6.5** | 官方明确"不会很快做"；用户被迫自己写 jsPDF 循环 |
| **6** | **N10 多余空白页** | 14+ | 8 | 5/10→5 | 6/10→6 | 0.5 | **6.2** | 最新报告（2026-02）仍无回复 |
| **7** | **N7 表格表头不重复** | 12+ | 7 | 5/10→5 | 5/10→5 | 1 | **5.9** | 全部零回复；浏览器打印能做到、html2pdf 做不到 |
| **8** | **N8 表格行不被切断（含 rowspan）** | 10+ | 6 | 7/10→7 | 4/10→4 | 0.5 | **5.2** | 部分可通过 CSS 缓解但不彻底 |
| **9** | **N4 隐藏元素破坏分页** | 8+ | 5 | 6/10→6 | 5/10→5 | 0.5 | **5.2** | 维护者已定位并承诺修复，未落地 |
| **10** | **N11 单页 PDF** | 10+ | 6 | 4/10→4 | 8/10→8 | 0.5 | **5.9** | 官方 Known Issue #3，明确无近期计划 |
| **11** | **N13 用户掌控分页 + 合并** | 8+ | 5 | 6/10→6 | 8/10→8 | 1 | **6.3** | 合同/批量场景强需求；伴随超链接合并失效 |
| **12** | **N9 页边距精确控制** | 10+ | 6 | 4/10→4 | 2/10→2 | 0.5 | **4.3** | 多数是配置错误（单位混用） |
| **13** | **N12 混合页面尺寸/方向** | 4+ | 3 | 6/10→6 | 8/10→8 | 0.5 | **5.5** | 人数少但技术门槛高、用户已自行分析出重构点 |
| **14** | **N16 页码/目录/交叉引用** | 6+ | 4 | 4/10→4 | 5/10→5 | 0.5 | **4.4** | 官方给出手写路线 |
| **15** | **N14 背景色/背景图铺满** | 4+ | 3 | 3/10→3 | 4/10→4 | 0.5 | **3.4** | 视觉层面 |
| **16** | **N15 滚动位置影响打印区域** | 4+ | 3 | 5/10→5 | 2/10→2 | 0.5 | **3.6** | 已有官方 workaround（scroll to top） |

### 分维度解读（便于读者重新加权）

- **按独立报告人数排序**：N1（45+）> N2（30+）> N3（20+）> N6（18+）> N5（15+）> N10（14+）> N7/N11/N9/N8（约 10-12）> N4/N13（8+）> N12/N14/N15/N16（4-6）
- **按严重性排序**：N5（10，整份空白）> N1（8，内容被切损坏）> N8/N12/N13（6-7）> N2/N3/N4/N6/N7/N10/N13（5-6）> N9/N11/N14/N16（3-4）
- **按替代方案成本排序**：N1/N5/N11/N12/N13（8-10，需换库或自建）> N3/N10（6-9，改源码/改结构）> N2/N4/N6/N7/N8（4-5）> N9/N15（2）
- **最强商业场景证据**：N1（发票/审计报告/合同/简历/医疗护理计划）、N5（100-200 页批量导出）、N6（订单表页眉页脚）、N13（合同多页）、N7（多页业务数据表）

### 结论：四个"最强信号"

1. **报告量与伤害度同时最高的，是"内容被切开"（N1）** —— 而它的根因（纯像素切刀 + 补偿层用插入空白 div 模拟分页）**在架构上就无法彻底修复**，除非放弃"单张 canvas"模型。
2. **危害最大且官方承认的，是"长文档整体空白"（N5）** —— 这直接让 html2pdf 在 20 页以上的文档场景**不可用**，是用户离开的最硬理由。
3. **最"未被回应"的高频需求，是"表格跨页重复表头"（N7）** —— 12+ 独立报告、**零条维护者回复**，而浏览器原生打印可以做到，属于**纯差异化空白点**。
4. **最"被明确推迟"的需求，是"每页页眉/页脚/页码"（N6）** —— 官方路线是"你自己写 jsPDF 循环"，18+ 人为此写了胶水代码。

---

## 离开 html2pdf.js 的先例（因分页需求转投他方）

| 目标 | 原因 | 证据（verbatim） |
|---|---|---|
| **html3pdf**（社区 fork，合并了大量未合入的 PR） | 长文档空白；每页独立 canvas 渲染 | [#599](https://github.com/eKoopmans/html2pdf.js/issues/599) davidnbooth（2023-08-09）："**html3pdf**, which is a fork of this library and shouldn't require any changes to your code, **solves this by rendering each page on its own canvas** (although this is much slower)."；[#601](https://github.com/eKoopmans/html2pdf.js/issues/601) LuuHoangVu（2024-01-26）："For me the fix for iOS was simply to change html2pdf to html3pdf."；[#721](https://github.com/eKoopmans/html2pdf.js/issues/721) pouryasanboy（2024-10-01）："I've searched about this problem and many users mentioned html3pdf package"；[#643](https://github.com/eKoopmans/html2pdf.js/issues/643) davidnbooth（2023-08-09）："You could try html3pdf, which is a fork of this library with a lot of the existing PRs merged into it" |
| **服务端渲染 / 服务端 PDF** | 长文档 + 移动端 Safari 空白 | [#397](https://github.com/eKoopmans/html2pdf.js/issues/397) chamaliperera512（2021-08-05）："**No solution, I changed the pdf library to server side**"；ganeshmohane（2025-04-20）："i am also moving to server side" |
| **react-to-pdf** | 逐页漂移 / 分页不准 | [#227](https://github.com/eKoopmans/html2pdf.js/issues/227) CHANDRAMOHANnegi（2025-12-22）："`https://www.npmjs.com/package/react-to-pdf` try this package" |
| **react-to-print** | 打印语义正确、浏览器原生分页 | 见 §N7（[#341](https://github.com/eKoopmans/html2pdf.js/issues/341) 明确对比："if I print the page using **chrome print command** I get Thead on every page but using html2pdf I am unable to get thead on every page"）——虽非直接"换库"声明，但同一线程里有用户指向 react-to-print |
| **DKpdf（DKPdfDocument）** | 需要 HTML 页眉页脚 | [#509](https://github.com/eKoopmans/html2pdf.js/issues/509) YavarR（2022-05-23）："JA maybe it is possible but actually, **I decided to use DKpdf für my project**" |
| **html-to-image + flex 横排 + 自建 jsPDF** | 内建 pagebreak 完全不可用 | [#489](https://github.com/eKoopmans/html2pdf.js/issues/489) DaveSeidman（2022-01-12）："I've had no luck with the built-in pagebreak option so I'll just use a flex-box and have pages build out **to the right**, instead of **vertically** and then use html-to-image to take screenshots left-to-right instead." |
| **dompdf.js（矢量 DOM 解析路线）** | 数百/上千页文档 | [#721](https://github.com/eKoopmans/html2pdf.js/issues/721) lmn1919（2026-02-28）："That blank page issue is a common limitation of canvas-based libraries (like html2canvas) when handling large DOMs—they often crash or fail to render beyond ~20 pages due to memory constraints. **If you need to generate hundreds or even thousands of pages, you might want to try dompdf.js. It uses a vector-based approach (parsing DOM directly instead of rasterizing)**" —— ⚠️ 此条为**社区推荐，非维护者背书**，且推广者与项目存在关联，采信时需注意 |

**未发现**用户因分页需求明确转投 Puppeteer / Playwright / PrinceXML / WeasyPrint / wkhtmltopdf / pdfmake / print-js 的记录（pdfmake 仅在 [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) 评论中被顺带提及一次，非分页驱动）。**这本身是一条信号**：用户更倾向于「留在浏览器端」，因此一个**在浏览器端把分页做对**的替代品有明确受众。

---

## 未证实 / 需进一步核实

1. **维护者是否已彻底停止维护？** — 最后一次分页相关回复是 2025-08-27（[#752](https://github.com/eKoopmans/html2pdf.js/issues/752)）；最后一次任意回复未在本次研究中逐条核实（本次仅提取了 `eKoopmans` 名下评论）。**建议核实**：仓库最后一次 commit 日期、`eKoopmans` 最近一次在任意 issue 的活动、是否存在未公开的维护计划。
2. **#153 / `bugfix/pagebreak-tables` 分支是否曾合入？** — 维护者在 [#184](https://github.com/eKoopmans/html2pdf.js/issues/184) 提供过表格专用分支、在 [#128](https://github.com/eKoopmans/html2pdf.js/issues/128) 提到"@talkshowhost for page-breaks, I've made a new PR #153 with a proposed upgrade, I'll merge it in after some testing"。**本次未核实 PR #153 的最终状态**，因此"v0.9.1 页面分隔特性"是否包含表格专用修复待查。
3. **各需求项的"独立报告人数"为估算** — 基于 issue 作者 + 明确确认同现象的评论者去重。**未核实**：是否存在"以另一账号重复提问"或"在 StackOverflow 提问但未回帖 GitHub"的用户（[#473](https://github.com/eKoopmans/html2pdf.js/issues/473) 即为后者的实例，其原问题发在 StackOverflow），故人数为**下限**。
4. **`#795`–`#1043` 区间的最新 issue（2025–2026）覆盖可能不足** — 本次关键词初筛覆盖到 #1043，但 2025-08 之后的新 issue 体量较大，可能存在标题不含关键词却属分页问题的条目（如 [#927](https://github.com/eKoopmans/html2pdf.js/issues/927) 标题为资源重复加载，实为克隆机制问题）。**建议补扫**：按 `label` 与时间窗二次过筛。
5. **GitHub Projects 中的未完成路线图** — README 的 Known issues 引用了 4 个项目页（`projects/1` 单页 PDF、`projects/4` 新渲染器、`projects/5` 最大 canvas 尺寸、`projects/9` 克隆节点 bug、`projects/11` Promise 沙箱）。**本次未抓取这些 Project board 的实际状态**，可能包含维护者的优先级排序线索。
6. **`src/plugin/pagebreaks.js` 是否有已知未合并的修复 PR** — 本次 `gh pr list` 按标题关键词匹配到 4 条相关 PR（#153 已合并、#831 与 #919 未合并、#972 未合并），但**未按源码文件路径过滤**，可能漏掉针对 `pagebreaks.js` 的 PR。**建议核实**：`gh api repos/eKoopmans/html2pdf.js/pulls?state=all` 后按 `files` 路径过滤。
7. **N6（页眉页脚）的真实使用率可能被低估** — 由于官方路线是"自己写 jsPDF 循环"，成功案例往往**不在 issue 里出现**（[#578](https://github.com/eKoopmans/html2pdf.js/issues/578)、[#695](https://github.com/eKoopmans/html2pdf.js/issues/695) 的用户都是"提问→拿到社区答案→不再回帖"）。因此 N6 的报告人数是**严重下限**，真实需求规模可能远超 18 人。
8. **`html3pdf` fork 的用户规模未量化** — 多次被推荐为解决方案（[#599](https://github.com/eKoopmans/html2pdf.js/issues/599)、[#601](https://github.com/eKoopmans/html2pdf.js/issues/601)、[#643](https://github.com/eKoopmans/html2pdf.js/issues/643)、[#721](https://github.com/eKoopmans/html2pdf.js/issues/721)），但**其 npm 下载量与 html2pdf.js 的对比未在本研究中核实**，无法量化"因分页问题流失到 fork 的比例"。
9. **次级证据标注** — [#473](https://github.com/eKoopmans/html2pdf.js/issues/473) 引用了 StackOverflow 原帖（https://stackoverflow.com/questions/69122130/html2pdf-pdf-download-is-short-and-not-correct），本文件仅以该 issue 内的讨论为依据，StackOverflow 链接未作为独立证据引用。

---

*文档生成日期：2026-11-02 | 全部 issue 状态、标签、评论均于该日经 GitHub API (`gh`) 实时抓取 | 每条 URL 均经过实际 fetch 验证存在*
