# Changelog

All notable changes to `@darialan/web-printer` are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

<p align="right">
  <strong>English</strong> | <a href="./CHANGELOG.zh-CN.md">中文更新日志</a>
</p>

---

## [3.2.1] - 2026-11-12

### Enhancements & i18n

- **English-First Documentation & Package Metadata**:
  - Set English as the default primary language for `README.md`, `CHANGELOG.md`, `package.json` description, and all `docs/*.md` documentation files, with Chinese translations maintained under `*.zh-CN.md`.
  - Updated README workbench screenshot, landing page showcase screenshots, and repository social preview graphics to English.
- **English Default UI & Preview Overlay**:
  - Set `en` as the default locale for the floating paper preview overlay (`createPrintPreviewView` / `previewPrint`), landing site, and HTML template while preserving dynamic Chinese switching.
  - Fixed `MiniPreviewBoundary` to propagate the active `locale` prop during error fallback rendering.
- **English Codebase & Error Messages**:
  - Standardized runtime error messages and source comments across `src/lib` to English.

---

## [3.2.0] - 2026-11-11

### Features

- **Selective Page Range Export (`startPage` / `endPage`)**:
  - `PrintSettings`, `outputDocument`, `exportPreparedLayout`, and `buildHtmlPreviewData` now accept `startPage` and `endPage` (1-based, inclusive).
  - Selective rendering & slicing: captures canvases and outputs PDF pages only for the chosen slice, reducing peak memory usage and enabling volume chunking for extra-long documents.
  - Safe boundary resolution via `resolvePageRange(totalCount, startPage?, endPage?)` with automatic clamping and validation.
- **Pre-Release Automated Stress & Soak Test Suite (`benchmark:stress`)**:
  - Added `npm run benchmark:stress` covering 100-page extreme scale exports, 20-round consecutive zero-leak soak tests, and mid-flight cancellation with instant re-entry.
  - Added physical capacity ceiling probe script (`scripts/benchmark/probe-page-limit.mjs`), identifying the safe continuous browser export boundary at ~150–200 pages.
- **Extended Benchmark Coverage & Standardized Hardware Specs**:
  - Added 10-page and 15-page baseline comparisons against `html2pdf.js 0.14.0`.
  - Documented explicit, standardized hardware specifications across docs and assets: Apple M1 Pro (8 cores), 16GB Unified Memory, macOS, Chromium 141, Node.js v25.
- **Decoupled Toolbar & Full Internationalization**:
  - Comprehensive English localization across the landing page, interactive workbench, and demo scenarios.
  - Decoupled toolbar controls and optimized compact floating paper preview widget.

### Bug Fixes & Enhancements

- **Removed Artificial DOM Measurement Limits**:
  - Removed hardcoded `200,000px` root height check and `200,000` character check from DOM measurement adapters, allowing natural runtime boundaries and standard exceptions to handle overflows.
- **English Code Comments & JSDoc**:
  - Rewrote and standardized all codebase comments and JSDoc documentation in professional English.

---

## [3.1.0] - 2026-11-10

### Features

- **Native Floating Paper Preview (`previewPrint`)**:
  - Introduced core API `previewPrint(options: PreviewPrintOptions | HTMLElement)` built with pure native DOM without React or external UI dependencies; works in Vue, React, or vanilla JS with a single function call.
  - Interactive controls: floating window dragging, zoom controls (50%–200%), page-by-page flipping, fit width/page, fullscreen mode, and Esc key dismissal.
  - Global singleton safety management and `closePrintPreview()` utility.
  - Extended React Hook `useWebPrinter` with `openPreview` method.
- **Shorthand Page Break Overlay API**:
  - `visualizePageBreaks` supports single argument overload: works as both `visualizePageBreaks({ element })` and `visualizePageBreaks(element)`.

### Bug Fixes & Enhancements

- **Block SVG Margin Normalization & Formula Export**:
  - Fixed an issue where centered or block `<svg>` vector formulas (MathJax, KaTeX, D3 charts) with margins shifted twice in standalone SVG exports, leading to clipping or blank whiteouts.
  - Auto-inserts layout container in clone stage while resetting SVG margins to zero, ensuring identical layout while rendering vectors from `(0, 0)`.
- **Sample Article Syntax Fix**:
  - Corrected nested double quotes in `alt` attribute of `torchoptics-article.html`.
- **Workbench & Landing Page Polishing**:
  - Improved toolbar wrapping on narrow screens to prevent action buttons from clipping;
  - Enhanced fullscreen paper preview contrast and break line display in dark mode.
