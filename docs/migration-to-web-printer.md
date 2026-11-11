# Migrating from WebPDF Printer to Web Printer

<p align="right">
  <strong>English</strong> | <a href="./migration-to-web-printer.zh-CN.md">中文</a>
</p>

The new package identity is **Web Printer** under `@darialan/web-printer`. Legacy `@darialan/web-pdf-printer@1.0.2` remains downloadable.

```sh
npm uninstall @darialan/web-pdf-printer
npm install @darialan/web-printer
```

## Export API

`outputDocument({ format: 'pdf' | 'png' })` is the unified entry point. `outputPDF()` remains supported for PDF export.

```ts
import { outputDocument, outputPDF } from '@darialan/web-printer';
await outputDocument({ element: document.getElementById('content'), filename: 'report', format: 'png' });
```

React integration is imported from a dedicated subpath to prevent bundling React in vanilla JS or Vue projects:

```tsx
import { useWebPrinter } from '@darialan/web-printer/react';
const { exportDocument, isExporting, progress, cancel } = useWebPrinter();
await exportDocument({ element: document.getElementById('content'), filename: 'report', format: 'png' });
```
