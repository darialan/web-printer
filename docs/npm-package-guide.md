# @darialan/web-printer Developer Integration Guide & Architectural Reference

<p align="right">
  <strong>English</strong> | <a href="./npm-package-guide.zh-CN.md">中文</a>
</p>

This document is aimed at developers and system architects, providing comprehensive guidance on `@darialan/web-printer`'s architecture, package integration across modern frontend stacks, and core algorithmic mechanics.

---

## Table of Contents

1. [Architecture & Packaging](#1-architecture--packaging)
2. [Installation & Project Configuration](#2-installation--project-configuration)
   - [2.1 Package Installation & Dependencies](#21-package-installation--dependencies)
   - [2.2 Bundler Setup (Vite / Webpack / Next.js)](#22-bundler-setup-vite--webpack--nextjs)
3. [Quick Start & Common Scenarios](#3-quick-start--common-scenarios)
   - [3.1 Vanilla JavaScript](#31-vanilla-javascript)
   - [3.2 Vue 3 / Composition API](#32-vue-3--composition-api)
   - [3.3 React 18 / 19 (useWebPrinter Hook)](#33-react-18--19-usewebprinter-hook)
   - [3.4 Fixed Headers, Footers & Page Numbers](#34-fixed-headers-footers--page-numbers)
   - [3.5 Sandboxed iframe & Standalone Web Page Printing](#35-sandboxed-iframe--standalone-web-page-printing)
   - [3.6 Export Options & Preview API Reference](#36-export-options--preview-api-reference)
4. [Underlying Core Mechanics](#4-underlying-core-mechanics)
   - [4.1 Page Geometry Model & Physical Capacity Equation](#41-page-geometry-model--physical-capacity-equation)
   - [4.2 Offscreen Snapshot Cloning & Style Freezing](#42-offscreen-snapshot-cloning--style-freezing)
   - [4.3 Smart DOM Traversal & Line-Level Decomposition (Range ClientRects)](#43-smart-dom-traversal--line-level-decomposition-range-clientrects)
   - [4.4 Greedy Fallback Pure Pagination Algorithm](#44-greedy-fallback-pure-pagination-algorithm)
   - [4.5 Page-by-Page Slicing & Instant Canvas Reclamation](#45-page-by-page-slicing--instant-canvas-reclamation)
5. [Declarative Markup & Rules System](#5-declarative-markup--rules-system)
   - [5.1 HTML Attributes Protocol](#51-html-attributes-protocol)
   - [5.2 Programmatic Rules (PrintRuleConfig)](#52-programmatic-rules-printruleconfig)
   - [5.3 UI Component Library Adapters (Ant Design, Element Plus)](#53-ui-component-library-adapters-ant-design-element-plus)
6. [Visual Inspection & Debugging](#6-visual-inspection--debugging)
7. [Production FAQ & Known Boundaries](#7-production-faq--known-boundaries)

---

## 1. Architecture & Packaging

The repository is organized into a dual-mode architecture:
1. **Interactive Demo / Workbench**: Powered by React 18 + Ant Design (`npm start`).
2. **Core Library (`@darialan/web-printer`)**: Built via Vite Library Mode + TypeScript compiler, producing tree-shakable ESM and CJS bundles with full `.d.ts` types in `dist/`.

```
Repository Root
├── dist/                          # Build outputs
│   ├── index.mjs                  # ESM entry point (Vite, Rollup, native browser)
│   ├── index.cjs                  # CommonJS entry point (Node.js, Webpack 4/5)
│   ├── index.d.ts                 # Root TypeScript declarations
│   └── types/                     # Granular module-level .d.ts files
├── src/
│   ├── lib/                       # NPM Library source code (src/lib/index.ts)
│   │   ├── core/                  # Pure geometry, pagination algorithms, rules (zero DOM dependency)
│   │   ├── adapters/              # DOM measurement, style freezing, html2canvas capture, jsPDF writer
│   │   ├── application/           # Pipeline orchestration, service layer, cancellation signals
│   │   ├── hooks/                 # React useWebPrinter Hook
│   │   └── overlay/               # Visual page break lines & paper preview overlay (vanilla DOM)
│   └── demo/                      # Demonstration workbench & scenario templates
```

---

## 2. Installation & Project Configuration

### 2.1 Package Installation & Dependencies

```bash
# npm
npm install @darialan/web-printer

# pnpm
pnpm add @darialan/web-printer

# yarn
yarn add @darialan/web-printer
```

Peer dependencies: `html2canvas` and `jspdf` are bundled as direct runtime dependencies, so consumers do not need to install them manually. React is purely optional and imported only when using `@darialan/web-printer/react`.

### 2.2 Bundler Setup (Vite / Webpack / Next.js)

#### Vite
Works out of the box with standard ESM imports:
```ts
import { outputDocument, previewPrint, togglePageBreaks } from '@darialan/web-printer';
```

#### Next.js (App Router / Pages Router)
Because DOM operations, `canvas`, and `window` are client-only, ensure calls happen inside client components (`'use client'`) or dynamically import the library with SSR disabled:
```tsx
'use client';

import { useEffect } from 'react';
import { outputPDF } from '@darialan/web-printer';
```

---

## 3. Quick Start & Common Scenarios

### 3.1 Vanilla JavaScript

```html
<div id="print-area">
  <h1>Quarterly Business Report</h1>
  <div data-print-atomic="true">
    <p>This entire card will never be split across pages.</p>
  </div>
</div>

<button id="btn-export">Export PDF</button>
<button id="btn-preview">Preview Pages</button>

<script type="module">
  import { outputPDF, previewPrint } from '@darialan/web-printer';

  const el = document.getElementById('print-area');

  document.getElementById('btn-export').onclick = async () => {
    await outputPDF({
      element: el,
      filename: 'report.pdf',
    });
  };

  document.getElementById('btn-preview').onclick = async () => {
    await previewPrint({ element: el });
  };
</script>
```

### 3.2 Vue 3 / Composition API

```vue
<template>
  <button @click="handleExport" :disabled="loading">Export PDF</button>
  <button @click="handlePreview">Preview</button>

  <div ref="reportRef" class="report-container">
    <div v-for="item in list" :key="item.id" data-print-atomic="true" class="card">
      <h3>{{ item.title }}</h3>
      <p>{{ item.content }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { outputPDF, previewPrint } from '@darialan/web-printer';

const reportRef = ref<HTMLElement | null>(null);
const loading = ref(false);

const handleExport = async () => {
  if (!reportRef.value) return;
  loading.value = true;
  try {
    await outputPDF({
      element: reportRef.value,
      filename: 'vue-report.pdf',
    });
  } finally {
    loading.value = false;
  }
};

const handlePreview = async () => {
  if (reportRef.value) {
    await previewPrint({ element: reportRef.value });
  }
};
</script>
```

### 3.3 React 18 / 19 (useWebPrinter Hook)

```tsx
import React, { useRef } from 'react';
import { useWebPrinter } from '@darialan/web-printer/react';

export function ReportPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { exportDocument, openPreview, toggleBreaks, exporting, progress } = useWebPrinter();

  const handleExport = () => {
    if (containerRef.current) {
      exportDocument({
        element: containerRef.current,
        filename: 'financial-report.pdf',
        format: 'pdf',
      });
    }
  };

  return (
    <div>
      <div className="toolbar">
        <button onClick={handleExport} disabled={exporting}>
          {exporting ? `Exporting: ${progress?.completed}/${progress?.total}` : 'Export PDF'}
        </button>
        <button onClick={() => containerRef.current && openPreview(containerRef.current)}>
          Preview
        </button>
        <button onClick={() => containerRef.current && toggleBreaks(containerRef.current)}>
          Toggle Break Lines
        </button>
      </div>

      <div ref={containerRef}>
        <section data-print-atomic="true">Summary Card</section>
        <table>...</table>
      </div>
    </div>
  );
}
```

### 3.4 Fixed Headers, Footers & Page Numbers

```ts
await outputDocument({
  element: document.getElementById('print-area')!,
  header: document.getElementById('report-header')!, // Cloned & placed on every page top
  footer: document.getElementById('report-footer')!, // Cloned & placed on every page bottom
  settings: {
    paper: 'A4',
    orientation: 'portrait',
    margins: { top: 15, bottom: 15, left: 10, right: 10 },
    pageNumber: {
      enabled: true,
      position: 'bottom-right',
      format: 'slash', // e.g. "1 / 5"
    },
    startPage: 1,      // Optional 1-based page range
    endPage: 10,
  },
  filename: 'formal-document.pdf',
});
```

### 3.5 Export Options & Preview API Reference

```ts
export interface PrintOptions {
  element: HTMLElement | Document;
  header?: HTMLElement | null;
  footer?: HTMLElement | null;
  settings?: PrintSettings;
  filename?: string;
  format?: 'pdf' | 'png'; // Default: 'pdf'
  download?: boolean;     // Default: true (set false to receive Blob without auto-download)
  signal?: AbortSignal;   // AbortController signal for cancellation
  onProgress?: (completed: number, total: number) => void;
}
```

---

## 4. Underlying Core Mechanics

1. **DOM Range Line-Level Detection**:
   Instead of naively slicing canvases by height, Web Printer splits text nodes using DOM `Range.getClientRects()`. It measures true line boxes and finds the exact line where overflow occurs, snapping the page break between line boxes.
2. **Atomic Protection (`data-print-atomic="true"`)**:
   Any container marked atomic is measured as an indivisible unit. If it crosses the page bottom boundary, it is shifted completely to the top of the next page.
3. **Table Header Replication**:
   Table `<thead>` headers are automatically measured and injected at the top of subsequent table pages, keeping columns readable throughout multi-page tables.
4. **Isolated Offscreen Sandbox & Style Freezing**:
   Measurements occur in an isolated offscreen clone. Computed CSS styles are deep-frozen, preventing print-related mutations or reflows on the live user interface.
5. **Page-by-Page Micro-Slicing**:
   Canvases are rendered one page at a time with instant memory reclamation, safely handling 100+ page documents without exceeding the browser's single-canvas allocation ceilings.

---

## 5. Declarative Markup Protocol

| Attribute | Value | Behavior |
| :--- | :--- | :--- |
| `data-print-atomic` | `"true"` | Container will never be sliced in the middle; shifted to next page as a whole. |
| `data-print-splittable` | `"true"` | Explicitly marks a container as splittable at child element boundaries. |
| `data-print-pagebreak` | `"always"` | Forces a page break immediately before this element. |

---

## 6. License

MIT License. Designed and maintained for modern web applications.
