# Benchmark Reproduction & Methodology

<p align="right">
  <strong>English</strong> | <a href="./benchmark.zh-CN.md">中文</a>
</p>

Comparing html2pdf.js 0.14.0, Web Printer 2.0.0 (commit `3c38b3e`, baseline), and current 3.0 development code (current).

## Reproduction

```sh
npm ci
npm run benchmark                      # Default 3 runs per group
BENCHMARK_REPEATS=1 BENCHMARK_SCENARIOS=text,table npm run benchmark   # Run specific scenarios
BENCHMARK_OUTPUT=.benchmark/full npm run benchmark                     # Specify custom output directory
```

The output directory contains `report.html` (visual comparison), `results.json` (raw metrics), `benchmark-summary.md`, and exported PDFs from each engine. Run `npm run benchmark:serve` to launch the interactive review workbench.

## Test Environment & Configuration

- **Hardware**: Apple M1 Pro (8-core CPU: 6 Performance + 2 Efficiency), 16 GB Unified Memory.
- **OS & Runtime**: macOS 26.2 (Darwin arm64), Node.js v25.8.2, Playwright v1.56.1.
- **Browser Engine**: Chromium 141.0.7390.37 (Headless), Viewport 1440 × 1000, DPR 1.0.
- **Page & Paper Specs**: A4 Portrait (210 mm × 297 mm), 10 mm margins, source render container width 718 px, html2canvas scale 2, PNG lossless (Web Printer uses PNG FAST; html2pdf uses jsPDF compress: true), no page numbers.
- **Execution & Statistics**: Each scenario is executed independently 3 times; duration takes the median. The three engines alternate execution order on each run, using fresh browser contexts to prevent cache/state interference.
- **Memory Sampling**: Connects to Chromium processes via Chrome DevTools Protocol (CDP), sampling RSS memory every 100 ms across process trees (including shared memory and base browser overhead, recording peak lower bound).
- **PDF Content Verification**: Every output PDF is strictly rasterized and validated via PDF.js: checks for blank pages, expected page count, and validates that sequential color markers (10 per page group) are never duplicated or omitted. Fails immediately on any verification defect even if the export Promise resolves.
- **Geometric & Visual Tolerance**: Geometric alignment threshold 0.6 CSS px; pixel diff evaluated at max channel RGB delta > 32.
- **html2pdf Parameters**: Monolithic canvas, `pagebreak: css + legacy`, avoid `img, canvas, svg, pre, h1–h6, tr`; without Web Printer's single-page budget limits.

## Results (Apple M1 Pro / 16GB Unified Memory, Median of 3 Runs)

Duration in ms (median); RSS sampled every 100 ms across Chromium process tree.

| Scenario | Engine | Success | Pages | Duration | File KiB | Peak RSS MiB |
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

### Failure Analysis (from PDF Verification)

| Scenario | Engine | Symptoms |
|---|---|---|
| layout | baseline | 1 blank page (trailing padding isolated into a standalone page) |
| layout | html2pdf | 1 blank page |
| long-15 | html2pdf | Sequential markers appeared 151 times / 150 expected (duplicated content) |
| long-20 | html2pdf | Sequential markers appeared 205 times / 200 expected (duplicated content) |
| long-50 | html2pdf | All 50 pages blank, 0/500 markers (monolithic canvas exceeded browser limits) |

### Geometric and Visual Differences (Single Run, Fixed Samples)

| Scenario | Engine | Max Coordinate Delta (px) | Text Line Reflow | Unsafe Breakpoints | Source vs. Snapshot Pixel Delta |
|---|---|---:|---:|---:|---:|
| text / table / layout | baseline vs current | 0 | 0 | 0 | 0.000% |
| media | baseline vs current | 0 | 0 | 0 | 0.060% |
| scroll | baseline | 160 | 60 | 0 | 4.161% |
| scroll | current | 0 | 0 | 0 | 0.000% |

## Why These Differences Exist

html2pdf.js (html2canvas + jsPDF) and Web Printer follow fundamentally different pagination architectures:

**Pagination Mechanism**: When html2pdf.js detects that an element crosses a page boundary, it injects an empty calculated spacer `div` before it to push it down (`pagebreaks.js` avoid rule); when exporting, it slices the single giant canvas by fixed pixel intervals (`worker.js` `toCanvas()` / `toPdf()`). This mutates the host DOM and slices blindly across pixel boundaries without semantic content awareness.

Web Printer's `measureDocument()` collects text line boxes and atomic elements as `Interval[]`, and `paginate()` computes safe breakpoints along these intervals, falling back to interval tops when necessary without inserting or shifting any DOM nodes (`src/lib/core/pagination/paginator.ts`).

**Visual Fidelity Guarantees**: `cloneWithResolvedStyles()` freezes computed styles, locks print root width, clones form values and canvas buffers, and pins fixed/sticky positions (`src/lib/adapters/dom/snapshot.ts`).

**Long Document Capture Strategy**: html2pdf.js calls html2canvas only once on the entire document to produce a single massive canvas, then slices it. Web Printer captures page by page after pagination is calculated, giving each page an isolated pixel budget and immediately releasing canvas resources (`src/lib/adapters/canvas/page-capture.ts`). This eliminates browser canvas allocation crashes on long documents (e.g. 50+ pages).

## Conclusions

- Current code passed PDF verification 3/3 across all scenarios.
- In this hardware environment (Apple M1 Pro / 16GB Unified Memory), html2pdf.js takes ~1.8–2.5x longer on verified scenarios up to 10 pages (~2.0x faster on 5 pages, ~1.8x faster on 10 pages). On 15+ pages, html2pdf.js fails PDF verification (duplicated content on 15/20 pages, all-white output on 50 pages).
- 3.0 improves correctness and edge cases (scroll, layout) over 2.0.0.

## Extreme Scale & Reliability Stress Testing

Run `npm run benchmark:stress` locally to reproduce automated stress and soak tests:

| Test Item | Scenario Setup | Measured Performance | Verification & Conclusion |
| :--- | :--- | :--- | :--- |
| **100-Page Extreme Scale Export** | 100-page continuous mixed-media doc | 68.6 s · 32.0 MiB PDF · Peak RSS 818.5 MiB | 100/100 pages verified via PDF.js; 1,000 sequential markers intact |
| **20-Round Continuous Soak Test** | 20 consecutive export runs with zero delay | 20/20 (100% success) · Net RSS drift +10.9 MiB (< 3%) | Page canvases & offscreen DOM destroyed immediately; no memory leak |
| **Mid-flight Abort & Fast Re-entry** | Aborted via AbortController mid-flight and immediately re-triggered | Abort latency < 10 ms · 0 DOM residual · Subsequent run 100% clean | Graceful cancellation and high-frequency re-entrancy without state pollution |
| **Single-Tab Physical Capacity Probe** | Scaling from 100 → 200 → 300 pages | 200 pages succeeded (331.6 s / 64.2 MiB PDF / 1.3 GiB RSS); 300 pages hit V8 old space heap limit | Recommended single-job safe capacity ceiling is **150–200 pages**; larger docs should use `startPage` / `endPage` for ranged chunking |
