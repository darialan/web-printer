# Benchmark 复现与口径

对比 html2pdf.js 0.14.0、Web Printer 2.0.0（提交 `3c38b3e`，baseline）和当前 3.0 开发代码（current）。

## 复现

```sh
npm ci
npm run benchmark                      # 默认每组 3 次
BENCHMARK_REPEATS=1 BENCHMARK_SCENARIOS=text,table npm run benchmark   # 只跑部分样本
BENCHMARK_OUTPUT=.benchmark/full npm run benchmark                     # 指定输出目录
```

输出目录含 `report.html`（图像对比）、`results.json`（原始数据）、`benchmark-summary.md`、各引擎实际 PDF。`npm run benchmark:serve` 可打开交互式实验台。

## 测试环境与配置参数

- **测试硬件 (Hardware)**：Apple M1 Pro 芯片（8 核 CPU：6 性能核 + 2 能效核），16 GB 统一内存（Unified Memory）。
- **操作系统与运行时 (OS & Runtime)**：macOS 26.2 (Darwin arm64)，Node.js v25.8.2，Playwright v1.56.1。
- **浏览器与内核 (Browser Engine)**：Chromium 141.0.7390.37（Headless），视口 1440 × 1000，设备像素比 DPR 1.0。
- **页面与纸张规范 (Page Specs)**：A4 纵向（210 mm × 297 mm），页边距 10 mm，源渲染容器宽 718 px，html2canvas scale 2，PNG 无损（Web Printer 使用 PNG FAST，html2pdf 采用 jsPDF compress: true），不加页码。
- **执行与统计机制**：每个场景样本独立运行 3 次取耗时中位数；三引擎在每次重复中轮换执行顺序，且每次执行均使用全新的独立浏览器上下文隔离缓存与状态。
- **内存采样机制**：通过 Chrome DevTools Protocol (CDP) 定位 Chromium 进程树，每 100 ms 采集并累加相关进程 RSS 内存之和（包含共享内存与浏览器基础开销，记录为峰值下界）。
- **PDF 内容校验**：导出的每份 PDF 均使用 PDF.js 逐页栅格化严格校验：检测是否存在空白页、页数是否与预期一致、以及长文档中植入的 10 个顺序色彩标记（目标页各一组）是否发生重复或遗漏。只要校验未通过即标记为失败，即使导出 Promise 成功 resolve。
- **几何与视觉容差**：几何对齐阈值 0.6 CSS px；像素差异以 RGB 最大通道差 > 32 判定。
- **html2pdf 参数**：整页 Canvas，`pagebreak: css + legacy`，`avoid` 为 `img, canvas, svg, pre, h1–h6, tr`；未套用 Web Printer 的单页像素上限。

## 结果（Apple M1 Pro / 16GB 统一内存，3 次独立重复取中位数）

耗时为中位数，单位 ms；RSS 为 Chromium 全进程每 100 ms 采样之和，包含共享页与浏览器基础开销，只是峰值下界。

| 样本 | 引擎 | 成功 | 页数 | 耗时 | 文件 KiB | 采样 RSS MiB |
|---|---|---:|---:|---:|---:|---:|
| text | baseline | 3/3 | 2 | 778 | 782 | 451 |
| text | current | 3/3 | 2 | 759 | 782 | 436 |
| text | html2pdf | 3/3 | 2 | 1,761 | 794 | 433 |
| table | baseline | 3/3 | 3 | 1,230 | 1,287 | 461 |
| table | current | 3/3 | 3 | 1,237 | 1,287 | 475 |
| table | html2pdf | 3/3 | 3 | 3,117 | 1,273 | 468 |
| layout | baseline | 0/3 | — | — | — | 408 |
| layout | current | 3/3 | 2 | 630 | 578 | 409 |
| layout | html2pdf | 0/3 | — | — | — | 443 |
| media | baseline | 3/3 | 2 | 685 | 409 | 413 |
| media | current | 3/3 | 2 | 667 | 409 | 446 |
| media | html2pdf | 3/3 | 2 | 1,236 | 411 | 452 |
| scroll | baseline | 3/3 | 2 | 637 | 465 | 437 |
| scroll | current | 3/3 | 2 | 639 | 445 | 436 |
| scroll | html2pdf | 3/3 | 2 | 1,221 | 469 | 439 |
| long-5 | baseline | 3/3 | 5 | 2,188 | 1,548 | 451 |
| long-5 | current | 3/3 | 5 | 2,167 | 1,548 | 453 |
| long-5 | html2pdf | 3/3 | 5 | 4,382 | 1,560 | 483 |
| long-10 | baseline | 3/3 | 10 | 4,359 | 3,101 | 578 |
| long-10 | current | 3/3 | 10 | 4,265 | 3,101 | 575 |
| long-10 | html2pdf | 3/3 | 10 | 7,798 | 3,113 | 601 |
| long-15 | baseline | 3/3 | 15 | 6,908 | 4,700 | 578 |
| long-15 | current | 3/3 | 15 | 6,959 | 4,699 | 556 |
| long-15 | html2pdf | 0/3 | — | — | — | 684 |
| long-20 | baseline | 3/3 | 20 | 9,808 | 6,311 | 556 |
| long-20 | current | 3/3 | 20 | 9,959 | 6,311 | 540 |
| long-20 | html2pdf | 0/3 | — | — | — | 652 |
| long-50 | baseline | 3/3 | 50 | 35,400 | 16,030 | 615 |
| long-50 | current | 3/3 | 50 | 34,984 | 16,030 | 643 |
| long-50 | html2pdf | 0/3 | — | — | — | 508 |

### 失败原因（来自 PDF 校验）

| 样本 | 引擎 | 现象 |
|---|---|---|
| layout | baseline | 1 页空白（分页把末尾 padding 单独成页） |
| layout | html2pdf | 1 页空白 |
| long-15 | html2pdf | 标记出现 151 次 / 期望 150 次（内容被重复） |
| long-20 | html2pdf | 标记出现 205 次 / 期望 200 次（内容被重复） |
| long-50 | html2pdf | 50 页全空白，0/500 标记（整页 Canvas 很可能超出浏览器尺寸上限，未单独验证） |

### 几何与视觉（单次，固定样本）

| 样本 | 引擎 | 坐标最大差 px | 文字行变化 | 不安全断点 | 源 / 快照像素差 |
|---|---|---:|---:|---:|---:|
| text / table / layout | baseline 与 current | 0 | 0 | 0 | 0.000% |
| media | baseline 与 current | 0 | 0 | 0 | 0.060% |
| scroll | baseline | 160 | 60 | 0 | 4.161% |
| scroll | current | 0 | 0 | 0 | 0.000% |

PDF 回拼与源图的差异包含 PDF 光栅化、边距与算法有意留出的页底空白，三个引擎都在 9%–20% 之间，不用作引擎优劣的判断，只用于定位差异图。html2pdf 没有可比较的快照阶段，且其分页填充无法按源坐标反推。

## 为什么会有这些差异

html2pdf.js（html2canvas + jsPDF）和本库在分页判断上走了不同路径，这是上面结果的来源，不只是耗时差异。

**分页机制**：html2pdf.js 检测到某元素跨页后，会在它前面插入一个按高度计算出来的空 `div`，把元素推到下一页（`pagebreaks.js` 的 avoid 规则）；导出时再对整页 Canvas 按像素高度切出每一页（`worker.js` 的 `toCanvas()` / `toPdf()`）。分页结果会反过来改变被导出内容的 DOM 结构，且切割按像素坐标，不知道内容边界。

本库的 `measureDocument()` 把文字行和受保护元素收集为 `Interval[]`，`paginate()` 只在这些区间上计算安全断点，必要时整体回退到区间顶部，不插入、不移动任何节点（`src/lib/core/pagination/paginator.ts`）。代价是页面底部可能留白：分页算法不会为了填满纸张去重排原始内容。

**视觉保真有前提**：`cloneWithResolvedStyles()` 冻结计算样式、锁定打印根宽度、复制表单值和 Canvas 内容、冻结 fixed / sticky 定位（`src/lib/adapters/dom/snapshot.ts`），默认的递归分析路径（atomic/splittable）因此不改变原始布局。但调用方传入的 `excludedElements` 会被整体移除；如果被排除的元素参与了布局（比如 flex 容器里的工具栏），移除它可能改变兄弟元素的宽度，进而改变换行和分页结果。[3.0 迁移说明](https://github.com/darialan/web-printer/blob/master/docs/migration-to-v3.md)把这类结果明确写为"不属于默认视觉保真保证"。

**长文档截图策略**：html2pdf.js 对整个容器只调用一次 html2canvas 生成完整长图，再切出每一页。本库在分页计算完成后逐页截图，每页有独立像素预算，用完立即释放 Canvas（`src/lib/adapters/canvas/page-capture.ts`），避免了一次性大图撑爆浏览器 Canvas 尺寸上限的风险——这解释了上面 20/50 页校验失败的现象。但这是正确性修复，不是性能方案：50 页文档仍需要 50 次独立的 html2canvas 调用，耗时随页数近似线性增长。

## 可以得出的结论

- 当前代码在全部样本上 3/3 通过 PDF 校验；2.0.0 在 layout 上失败，在 scroll 上快照坐标偏移最大 160 px。
- 在该硬件环境（Apple M1 Pro / 16GB 统一内存）与测试样本上，html2pdf.js 在 10 页及以内通过校验的样本中耗时约为 Web Printer 的 1.8–2.5 倍（5 页快约 2.0 倍，10 页快约 1.8 倍）；它在 15 页及以上长文档未通过 PDF 校验（15/20 页内容标记重复，50 页整页 Canvas 超限全白）。该倍数只适用于本次测试环境。
- 3.0 相对 2.0.0 在耗时、文件大小和内存上没有可观察的改善：长文档两者差异在运行间波动范围内（long-50 的 35.4 s 与 35.0 s）。本次改造的收益在于正确性（scroll、layout 样本），不是速度。

## 已知边界

- 长文档导出每页仍需 html2canvas 处理整份快照，50 页约 35 s，耗时随页数近似线性增长。局部渲染或缓存未实施，因为这需要证明不丢失页外样式，尚无测试依据。
- 固定样本通过不代表任意网站都能还原；`oklch()` / `color-mix()` 等 html2canvas 不支持的 CSS 仍会报错。
- 不同机器和浏览器版本的数据不可直接比较；RSS 不是精确分配峰值。

## 稳定性与极限压力测试（Stress & Soak Test）

执行 `npm run benchmark:stress` 可在本地复现针对超大文档、高频连续导出与取消重入的自动化套件：

| 压测项目 | 场景设定 | 实测表现 | 结论与验证指标 |
| :--- | :--- | :--- | :--- |
| **100 页极限规模导出** | 100 页超长图文文档单次导出 | 耗时 68.6 s · 产物 32.0 MiB · 峰值 RSS 818.5 MiB | 100/100 逐页校验通过，1,000 个顺序标记无一错漏 |
| **20 轮连续高频浸泡** | 连续执行 20 次无间隔导出任务 | 成功率 20/20 (100%) · 内存净波动 +10.9 MiB (< 3%) | 逐页 Canvas 与离屏快照即用即毁，无累积内存泄漏 |
| **中途取消与快速重入** | 导出进行中触发 AbortController 并立即重发 | 中止响应 < 10 ms · 临时 DOM 零残留 · 新任务完全正常 | 支持平稳取消与高频重入，无状态污染 |
| **单标签页物理上限实测** | 100 页 → 200 页 → 300 页探顶 | 200 页成功导出（331.6 s / 64.2 MiB PDF / 峰值 1.3 GiB）；300 页触及 V8 堆上限 | 推荐单次导出安全容量上限为 **150 ~ 200 页**；超大文档可利用 `startPage` / `endPage` 分卷导出 |
