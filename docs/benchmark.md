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

## 参数

- 浏览器：Chromium 141.0.7390.37（Playwright），视口 1440 × 1000，DPR 1，macOS。
- A4 纵向，边距 10 mm，源区域宽 718 px，PNG，html2canvas scale 2，不加页码，最大 100 页。
- html2pdf：整页 Canvas，`pagebreak: css + legacy`，`avoid` 为 `img, canvas, svg, pre, h1–h6, tr`；未套用 Web Printer 的单页像素上限。
- 三个引擎的运行顺序按重复次数轮换，每次使用新的浏览器上下文。
- 每份 PDF 都用 PDF.js 逐页渲染校验：空白页、页数、长文档的 10 个顺序颜色标记（每目标页一组）是否各出现一次。校验不通过则记为失败，即使导出 Promise 已成功。
- 几何阈值 0.6 CSS px；像素差异为 RGB 最大通道差 > 32 的比例。

## 结果（本机一次完整运行，3 次重复）

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

- 当前代码在全部 8 个样本上 3/3 通过 PDF 校验；2.0.0 在 layout 上失败，在 scroll 上快照坐标偏移最大 160 px。
- 在本机、这批样本上，html2pdf.js 在 5 页及以内多数样本耗时约为 Web Printer 的 1.9–2.5 倍；它在 20 页以上长文档未通过 PDF 校验（整页 Canvas 是否为原因尚未单独验证）。该倍数只适用于本次环境。
- 3.0 相对 2.0.0 在耗时、文件大小和内存上没有可观察的改善：长文档两者差异在运行间波动范围内（long-50 的 35.4 s 与 35.0 s）。本次改造的收益在于正确性（scroll、layout 样本），不是速度。

## 已知边界

- 长文档导出每页仍需 html2canvas 处理整份快照，50 页约 35 s，耗时随页数近似线性增长。局部渲染或缓存未实施，因为这需要证明不丢失页外样式，尚无测试依据。
- 固定样本通过不代表任意网站都能还原；`oklch()` / `color-mix()` 等 html2canvas 不支持的 CSS 仍会报错。
- 不同机器和浏览器版本的数据不可直接比较；RSS 不是精确分配峰值。
