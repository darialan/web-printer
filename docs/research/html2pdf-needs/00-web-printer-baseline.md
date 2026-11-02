# 对照基线：Web Printer 3.0 的能力边界

> 用途：为 html2pdf.js 用户需求调研提供"差异化机会"的评判基准。
> 事实来源：本仓库代码与文档（`src/lib`、`docs/`、`README.md`），非外部推测。
> 结论仅在标注的提交与版本口径下成立。

## 1. 渲染与输出管线（决定保真度天花板）

Web Printer 3.0 与 html2pdf.js **共用同一套光栅化后端**：

| 环节 | Web Printer 3.0 | html2pdf.js 0.14.0 |
| --- | --- | --- |
| DOM → 位图 | `html2canvas` ^1.4.1（`src/lib/adapters/canvas/page-capture.ts:1,57`） | `html2canvas` ^1.4.1 |
| 位图 → PDF | `jspdf` ^4.2.1，`pdf.addImage(canvas, 'PNG', …)`（`src/lib/adapters/pdf/jspdf-writer.ts:34`） | `jsPDF` + `addImage` |

**依赖版本已核对到一手来源**（`gh api repos/eKoopmans/html2pdf.js/contents/package.json`）：
html2pdf.js 0.14.0 声明 `html2canvas ^1.0.0` + `jspdf ^4.0.0`，
npm `latest` 即 0.14.0 —— 与本仓库的 html2canvas 1.4.1 / jspdf 4.x **同代**。

**推论（必须写进最终报告，避免过度宣称）**：

- 任何由 **html2canvas 光栅化能力** 造成的保真度缺口（SVG 渐变、`::before/::after`、
  混合模式、`backdrop-filter`、部分 CSS 伪元素、CORS 污染），Web Printer 3.0 **同样受限**。
  这类需求**不是** Web Printer 的差异化机会，除非更换光栅化后端。
- 两者的 PDF 输出都是**位图**，不含可选中文本层；正文不可检索、不可复制。
  这同样是**共享缺口**，不是差异化。
- 因此 Web Printer 3.0 的真实差异化只能来自**分页层与编排层**，而非保真度层。

## 2. html2pdf.js 0.14.0 的可配置面（一手来源核对）

来源：`gh api repos/eKoopmans/html2pdf.js/contents/type.d.ts`、`/contents/src/worker.js`、
`/contents/src/plugin/`、`/contents/src/index.js`。

- **基础选项全集**（`Worker.template.opt` 与 `Html2PdfOptions` 一致）：
  `filename` / `margin` / `image{type,quality}` / `enableLinks` / `html2canvas{}` / `jsPDF{}`。
  - **没有** header、footer、pageNumber、pageSize 预设、orientation 之外的纸张预设、
    缩放/比例、进度回调、取消信号等任何一项。
- **插件仅三个**（`src/index.js` 的 import）：
  `jspdf-plugin.js`、`pagebreaks.js`、`hyperlinks.js`。
- **`pagebreak` 插件的全部能力**（`src/plugin/pagebreaks.js` 头注释）：
  `mode`（`'avoid-all'` / `'css'` / `'legacy'`，默认 `['css','legacy']`）、
  `before` / `after` / `avoid` —— **全部是 CSS 选择器**。
  没有"按内容测量断点"的入口；`avoid` 只是"别在这个元素内部断开"的意图声明，
  实际切页仍按像素高度。
- **分页会改写 DOM**：`pagebreaks.js` 通过插入 spacer `div` 把元素推到下一页；
  切页再由 `worker.js` 的 `toCanvas()` / `toPdf()` 按像素高度完成。
- **无取消 / 无进度 / 无超时**：类型定义中不存在 `AbortSignal` 或 `onProgress`。

> 推论：html2pdf.js 用户"想要的功能"中，**页眉页脚、页码、按内容分页、进度与取消、
> 分页可诊断**五项在 0.14.0 的公开 API 里根本不存在，不是"有 bug"而是"没有该能力"。

## 3. Web Printer 3.0 已具备（可主张的差异化）

| 能力 | 代码/文档依据 | 对 html2pdf.js 用户需求的意义 |
| --- | --- | --- |
| 内容感知分页：文字行、表格行按边界测量断点 | `src/lib/core/pagination/`、`README.md` "智能分页" | 直接对应 html2pdf.js 的"整页截图 + 像素硬切"投诉 |
| 逐页渲染：先算分页，再逐页生成 Canvas | `README.md` "逐页渲染" | 直接对应长文档超画布上限导致全空白/重复 |
| 元素分类：`atomic` / `splittable` | `src/lib/core/types.ts:64-80` | 对应"表格行被拦腰截断""图片被劈开" |
| 声明式页眉/页脚 | `DeclarativeHeaderFooterConfig`（`core/types.ts:28`） | html2pdf.js 无原生页眉/页脚/页码 API |
| 独立页码系统（含中文格式） | `PageNumberConfig`（`core/types.ts:36`） | 同上 |
| 分页可诊断：分页线、保护区间、测量信息 | `src/lib/overlay/page-break-overlay.ts`、`ObservabilityStats` | 对应"分页出错但无从定位" |
| 导出过程可控：`AbortSignal`、逐页进度、超时上限 | `docs/migration-to-v3.md` "快照、调试和生命周期" | 对应长导出卡死、无法取消 |
| 源 DOM 不被污染：离屏快照 | `docs/migration-to-v3.md` | 对应"导出后页面样式被改乱" |
| 导出失败语义明确（无法安全分页时报错而非静默截断） | `docs/output-formats.md` | 对应"PDF 悄悄少了内容" |
| 纯浏览器、零服务端依赖 | `README.md` | 对应"必须自建 PDF 服务" |
| A4/A3/A5/Letter + 自定义 + 社交尺寸 + 横竖向 | `Paper`（`core/types.ts:13-24`） | 对应多种纸张需求 |
| PDF 单文件 或 逐页 PNG 打包 ZIP | `README.md` "一套布局，两种输出" | — |

## 4. Web Printer 3.0 尚未覆盖（潜在的真实空白）

> 仅列可从代码直接判定为"没有"的项，不含推测。

- **PDF 超链接 / 链接注释**：html2pdf.js 默认 `enableLinks: true`，并有 `src/plugin/hyperlinks.js`
  生成 jsPDF 链接注释；本仓库 `src/lib/adapters/pdf/jspdf-writer.ts` 只调用 `addImage`，
  **无 `link()` / 注释生成**。这是 html2pdf.js 有、Web Printer 3.0 无的能力（回归项，非共享天花板）。
- **可选中 / 可搜索正文**：输出为 PNG 位图（`jspdf-writer.ts:34`），正文无文本层。
- **矢量 PDF**：同上。
- **表单字段 / PDF/A / 电子签名 / 书签 / 目录**：无对应输出层。
- **服务端 / Node 渲染**：仅浏览器端（`README.md` "纯浏览器执行"）。
- **超长文档（数百页）的渲染耗时**：本机 50 页约 35 s（`docs/benchmark.md`），耗时随页数线性增长。

## 5. 本仓库已有的 html2pdf.js 对照口径（可直接引用，无需重测）

来源：`docs/benchmark.md`（本机单次完整运行，3 次重复；Chromium 141，1440×1000，DPR 1）。

| 样本 | html2pdf.js | Web Printer current |
| --- | --- | --- |
| layout（Flex/Grid） | 0/3 通过 PDF 校验（1 页空白） | 3/3 通过 |
| long-20 | 0/3（标记出现 205 次 / 期望 200 次，内容重复） | 3/3，20 页 |
| long-50 | 0/3（50 页全空白，0/500 标记） | 3/3，50 页，约 35 s |
| text / table / media / scroll | 通过，耗时为本库 1.9–2.5 倍 | 通过 |
| long-5 / long-20 / long-50 耗时 | 4.4 s / 9.8 s（20 页）/ — | 2.2 s / 10.0 s / 35.0 s |

`docs/benchmark.md` 已给出的机制结论：html2pdf.js 在分页时**先改 DOM**（插入按高度计算的空 `div` 把元素推到下一页），
再对整页 Canvas 按像素高度切页；切割只认像素坐标，不知道内容边界。

## 6. 使用本基线时的三条纪律

1. **不把 html2canvas 光栅化缺口算作 Web Printer 的机会** —— 两者共享天花板。
2. **不把"Web Printer 已有"的能力重复包装成"新机会"** —— 已在第 3 节列明。
3. **差异化机会必须落成"可验证的动作"**（补什么、验什么、在哪个真实业务页面复测），
   且必须标明它对应 html2pdf.js 的哪条 issue 证据。
