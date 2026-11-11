# 变更日志 (CHANGELOG)

本文档记录 `@darialan/web-printer` 的所有版本发布与功能演进。遵循 [Semantic Versioning](https://semver.org/) 规范。

---

## [3.2.0] - 2026-11-11

### 新增功能 (Features)

- **指定页码区间导出 (`startPage` / `endPage`)**：
  - `PrintSettings`、`outputDocument`、`exportPreparedLayout` 及 `buildHtmlPreviewData` 支持 `startPage` 与 `endPage` 参数（1-based，包含起止页）；
  - 支持按需渲染与切片，仅对选中的页码区间执行 Canvas 捕获与 PDF 组装，降低超长文档导出时的内存峰值并支持大文件分卷导出；
  - 纯计算层通过 `resolvePageRange(totalCount, startPage?, endPage?)` 进行统一边界容错与语义解析。
- **上线前极限压力与稳定性测试套件 (`benchmark:stress`)**：
  - 新增 `npm run benchmark:stress` 自动化测试套件（涵盖 100 页超长规模压测、20 轮连续高频浸泡零泄漏测试、中途取消与重入测试）；
  - 新增单标签页物理容量边界探顶工具 `scripts/benchmark/probe-page-limit.mjs`，实测确定纯浏览器端单次导出安全容量边界约为 150～200 页。
- **基准测试场景覆盖扩充与环境规格明确**：
  - 新增 10 页与 15 页与 `html2pdf.js 0.14.0` 的基准对比样本；
  - 明确并规范记录测试硬件配置（Apple M1 Pro 8 核 / 16GB 统一内存 / macOS / Chromium 141 / Node.js v25）。
- **工具栏与国际化支持**：
  - 落地页与工作台完整支持中英文多语言切换；
  - 纸张预览与工作台工具栏控制解耦，优化紧凑型悬浮窗体验。

### 修复与优化 (Bug Fixes & Enhancements)

- **解除 DOM 测量硬编码上限**：
  - 移除测量阶段写死的 `200,000px` 根节点高度限制与 `200,000` 字符上限拦截，去除不必要的人工干预，遵循自然运行时与异常处理规范。
- **全量代码注释与 JSDoc 英文化**：
  - 遵循开源生态规范完成核心库代码注释与 JSDoc 文档的英文标准化重构。

---

## [3.1.0] - 2026-11-10

### 新增功能 (Features)

- **原生纸张预览浮窗 (`previewPrint`)**：
  - 新增核心库直出 API `previewPrint(options: PreviewPrintOptions | HTMLElement)`，纯原生 DOM 构建，不依赖 React 或任何第三方 UI 库，任何框架（Vue / React / 原生 JS）均可一行调用。
  - 支持快捷交互：浮窗拖拽移动、缩放控制（50% ~ 200%）、逐页翻页、自适应适合宽度/适合页面、全屏预览视图与 ESC 键快捷退出。
  - 提供全局单例安全管控与 `closePrintPreview()` 方法。
  - React Hook `useWebPrinter` 同步扩展返回 `openPreview` 方法。
- **分页标记 API 简写重载**：
  - `visualizePageBreaks` 支持单参调用：既支持原 `visualizePageBreaks({ element })`，也支持简化写法 `visualizePageBreaks(element)`。

### 修复与优化 (Bug Fixes & Enhancements)

- **通用 SVG 边距规整与公式导出修复**：
  - 彻底修复 `html2canvas` 导出时，带有 `margin: 0 auto` 或外边距的 block `<svg>` 矢量公式（MathJax / KaTeX / D3 图表等）在独立 SVG 格式中坐标二次偏移、导致公式被视口截断或 100% 变白的问题。
  - 在克隆阶段为带有外边距或块级居中的 SVG 自动插入布局承载容器，同时将 `<svg>` 自身边距归零，保证文档原本几何排版完全一致且矢量内容以 `(0, 0)` 为原点完整渲染。
- **示例文章语法修复**：
  - 修正测试样本 `torchoptics-article.html` 中第 219 行 `alt` 属性内部嵌套双引号导致代码泄漏的问题。
- **工作台与落地页体验调优**：
  - 优化工作台工具栏在窄屏/多标签下的换行布局，防止操作按钮被推出屏幕；
  - 增强全屏纸张预览在深色模式下的对比度与分页线展示。

---

## [3.0.0] - 2026-11-02

### 架构与核心演进 (Major Breaking Changes)

- **元素分类与分页算法彻底重构**：
  - 统一建立 `atomic`（原子保护项，禁止页中截断）与 `splittable`（流式可拆分容器，深入文本行 Range 测量拆分）双核心分类协议。
  - 移除旧版 `ignore` 方案，杜绝导出时隐藏元素导致的排版塌陷。
- **离屏快照与样式冻结引擎**：
  - 采用离屏克隆与计算样式完整冻结（Style Freezing），防止导出过程影响业务正在交互的宿主页面 DOM。
- **逐页切片与内存管控**：
  - 限制单页最大 8,000,000 像素安全水位，超预算自适应缩放；单页 Canvas 渲染后立即回收显存，支持百页级长文档安全导出。
- **双模打包与现代标准支持**：
  - 升级 Vite Library 编译管道，输出高品质 ESM / CJS / .d.ts 产物，全面兼容 Next.js、Nuxt、Webpack 及现代前端工程。
