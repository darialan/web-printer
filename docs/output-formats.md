# Output Formats: PDF & Paginated PNG

<p align="right">
  <strong>English</strong> | <a href="./output-formats.zh-CN.md">中文</a>
</p>

PDF and paginated PNG share the same snapshot, pagination results, and page-by-page canvas captures; the Writer layer only handles paper composition and file encoding.

## Usage

In the workbench toolbar, select formats via the dropdown arrow next to the export button. Default is PDF. "PNG Pages (ZIP)" saves each page as a full paper image and packages them into a `.zip` archive to prevent multiple automatic downloads from being blocked by the browser. Files are sequentially named `page-001.png`, `page-002.png`, etc.

```ts
import { outputDocument, outputPDF } from '@darialan/web-printer';

const controller = new AbortController();
const result = await outputDocument({
  element: document.getElementById('content'),
  filename: 'report',
  format: 'png', // 'pdf' | 'png', default: 'pdf'
  download: false, // Set false to inspect Blob programmatically
  signal: controller.signal,
  onProgress: (completed, total) => console.log(completed, total),
});
// PNG mode: result.blob is application/zip containing individual PNG pages.
// PDF mode: result.blob is application/pdf.
// result.pages / bytes / layoutMs / totalMs / captures are available in both modes.

// Traditional PDF export remains fully compatible:
await outputPDF({ element: document.getElementById('content'), filename: 'report' });
```
