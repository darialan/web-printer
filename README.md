<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/darialan/web-printer@master/assets/readme/hero.svg" width="100%" alt="Web Printer 分页导出示意图：一个长页面被切分为多页 A4，并输出 PDF 或逐页 PNG">
</p>

浏览器内的 HTML 分页引擎：保留现有样式，输出 PDF 或逐页 PNG。

[在线工作台](https://pdf-demo-phi.vercel.app/#/playground) · [npm](https://www.npmjs.com/package/@darialan/web-printer) · [接入指南](https://github.com/darialan/web-printer/blob/master/docs/npm-package-guide.md)

[特性](#特性) · [安装](#安装) · [快速开始](#快速开始) · [架构](#架构) · [API](#api) · [仓库结构](#仓库结构) · [开发](#开发) · [文档](#文档)

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/darialan/web-printer@master/assets/readme/workbench-table.webp" width="100%" alt="工作台在真实表格上标记 atomic 行保护，右侧显示导出的纸张预览">
</p>

工作台在真实页面上标出 `atomic` 区间与分页状态，右侧是同一份布局生成的纸张预览。

## 特性

- **按内容分页**：文字按行测量，表格优先按行换页，图片、代码块和公式整块保护，不会被拦腰截断。
- **一套布局，两种输出**：PDF 单文件，或逐页 PNG 打包 ZIP；两种格式共用同一份分页结果。
- **纯浏览器执行**：不需要服务端 PDF 服务，适合报表、单据、合同和长文章导出。
- **不污染源页面**：测量和截图都在离屏快照里完成，导出前后源 DOM 的样式与内容不变。
- **可控的导出过程**：支持 `AbortSignal` 取消、逐页进度、缩略图预览和分页检查。
- **TypeScript 优先**：类型随包提供，核心入口无 React 依赖。

## 安装

```sh
npm install @darialan/web-printer
```

## 快速开始

```ts
import { outputDocument } from '@darialan/web-printer';

await outputDocument({
  element: document.getElementById('report')!,
  filename: 'report',
  format: 'pdf', // 'png'：逐页 PNG，打包为 ZIP
});
```

`download: false` 只返回 Blob；`signal` 取消导出；`onProgress(completed, total)` 报告页进度。返回 `{ blob, pages, bytes, layoutMs, totalMs }`。

## 架构

分页与渲染分离：DOM 先被降维成受保护区间，再由纯函数算出分页计划，最后逐页执行截图。

### 系统分层

```mermaid
flowchart TD
  subgraph Application["Application"]
    AP["print-service / print-pipeline / print-session<br/>编排流程、取消与生命周期"]
    HK["hooks（React）· overlay（调试可视化）"]
  end
  subgraph Core["Core（纯计算，不依赖 DOM / React / 第三方库）"]
    CR["rules：ignore / atomic 判定 + splittable 策略<br/>pagination：paginate（排序·合并·安全断点）<br/>geometry：纸张尺寸与 capacity"]
  end
  subgraph Adapters["Adapters"]
    AD["dom：快照 + 测量<br/>resources：字体 / 图片就绪<br/>canvas：html2canvas 截图"]
  end
  subgraph Output["Output"]
    OU["PDF writer（jsPDF）· PNG writer + ZIP · 页码"]
  end

  HK --> AP
  AP --> CR
  AP --> AD
  AP --> OU
  AD --> CR
  OU --> CR
```

四层依赖严格单向：`Application` 编排 `Adapters` 与 `Output`；两者都只依赖 `Core` 的纯函数，`Core` 不反向依赖任何一层，也不触碰 `document`/`window`。测量与渲染复用**同一份快照**，避免"预览能看、导出不一样"。

### 核心分页算法

DOM 降维成区间（measureDocument）与区间转为分页结果（paginate）是两个独立阶段，前者依赖 DOM，后者是纯函数：

```mermaid
flowchart TD
  N["当前节点"] --> T{Text Node?}
  T -->|是| X2["Range.getClientRects() 逐行测量"]
  T -->|否，Element| R{命中 ignore?}
  R -->|是| IG["跳过整个子树"]
  R -->|否| AT{命中 atomic?}
  AT -->|是| MEA["读取 getBoundingClientRect"]
  MEA --> H{高度 ≤ capacity?}
  H -->|是| P1["整块加入区间，停止下钻"]
  H -->|否| ERR["抛错：不可拆分区域超高"]
  AT -->|否| KT{命中 splittable?}
  KT -->|是| MEA2["读取 getBoundingClientRect"]
  MEA2 --> H2{高度 ≤ capacity?}
  H2 -->|是| P1
  H2 -->|否| DESC["递归分析子节点"]
  KT -->|否| DESC

  X2 --> RANGES[("Interval[] 受保护区间")]
  P1 --> RANGES

  RANGES --> SORT["按 top 排序"]
  SORT --> MERGE["线性扫描合并重叠/相邻区间"]
  MERGE --> ADV["从上一页末尾起，按 capacity 推进名义切点"]
  ADV --> HIT{名义切点落入某区间内部?}
  HIT -->|是| RETREAT["安全断点回退至该区间顶部"]
  HIT -->|否| KEEP["名义切点本身即安全断点"]
  RETREAT --> PAGE[("PageSlice")]
  KEEP --> PAGE
  PAGE -->|未到文档末尾| ADV
```

`ignore`、`atomic` 是仅有的两种显式节点分类；`splittable` 是独立分页策略（默认覆盖表格行 `tr`、`[role="row"]`），整体放得下时优先保护，超高时继续递归且不报错。受保护区间与文本行区间一起交给与 DOM 无关的 `paginate()` 完成排序、合并与安全断点计算。

C4 视图（System Context / Container / Component）见[架构文档](https://github.com/darialan/web-printer/blob/master/docs/architecture/README.md)；完整算法说明见[底层原理](https://github.com/darialan/web-printer/blob/master/docs/internals.md)。

## API

### 导出

| 参数 | 说明 |
| --- | --- |
| `element` | 打印区域；同源 `<iframe>` 可直接传入 |
| `format` | `'pdf'`（默认）或 `'png'` |
| `download` | 默认 `true`；`false` 时只返回 Blob |
| `settings` | 纸张、方向、边距、页眉页脚、页码；默认 A4 纵向、四边 10mm |
| `header` / `footer` | 每页重复渲染的独立 DOM 元素 |
| `onProgress` | `(completed, total) => void`，每页完成后回调 |
| `maxPages` | 默认 100，超出直接报错 |
| `rules` / `ruleConfig` | 覆盖或追加分页规则 |
| `signal` | `AbortSignal`，页面之间检查取消 |

返回 `{ blob, pages, bytes, layoutMs, totalMs }`。只导出 PDF 时也可以用 `outputPDF()`。

### 内容保护

默认即按文字行、子元素递归分析分页，不需要显式声明"可分割"。在 HTML 上标记例外，不绑定框架或组件库：

```html
<article>长文章正文（默认递归分析，直接写即可）</article>
<figure data-print-atomic="true">整块保护的配图与说明</figure>
<div data-print-ignore="true">不参与导出的工具栏</div>
```

- `data-print-atomic="true"` / `.print-atomic`：整块换页，严格不可分割；单块超过一页时明确报错，不提供降级路径
- `data-print-ignore="true"` / `.print-ignore`：从导出中排除，不占用纸张空间
- `data-print-splittable="true"` / `.print-splittable`：元素分类为 `splittable`；默认递归测量子节点，命中整块优先保护选择器时，整体放得下则优先保护，过高时递归拆分，不报错；表格行（`tr`、`[role="row"]`）默认采用此偏好
- `data-print-keep-together="split"` / `.print-keep-or-split`：旧标记，仍映射到 splittable 策略
- `data-print-break="split"` / `.print-force-split`：旧标记，保留为无操作；默认节点本就递归分析

> 元素分类明确为 `ignore`、`atomic` 或 `splittable`；文本节点不参与元素分类，由 Range 按视觉行测量。`ruleConfig.splittable` 注册额外的整块优先保护选择器。详见[迁移说明](https://github.com/darialan/web-printer/blob/master/docs/migration-to-web-printer.md)。

也可以不修改模板，用 `ruleConfig` 或 `configurePrint()` 注册选择器。

### 预览与检查

| API | 用途 |
| --- | --- |
| `createPrintSession(options)` | 冻结一次布局，供 `thumbnail(index)`、`exportDocument()` 复用；用完调用 `dispose()` |
| `inspectPrintLayout({ contentElement, ...options })` | 只测量与检查，返回页数、断点、受保护区间和耗时 |
| `calculatePagesArray(options)` | 只返回分页断点数组 |
| `configurePrint(config)` / `resetPrintRules()` | 全局注册或重置规则选择器 |
| `visualizePageBreaks(pages, element)` / `clearPageBreaks()` | 在源页面绘制或清理分页线 |

### React

```tsx
import { useRef } from 'react';
import { useWebPrinter } from '@darialan/web-printer/react';

export function Report() {
  const content = useRef<HTMLDivElement>(null);
  const { exportDocument, isExporting, progress, error, cancel } = useWebPrinter();

  return (
    <>
      <button
        disabled={isExporting}
        onClick={() =>
          exportDocument({
            element: content.current,
            filename: 'report',
            format: 'pdf',
          }).catch(() => {})
        }
      >
        {isExporting ? `导出中 ${progress.percent}%` : '导出 PDF'}
      </button>
      {isExporting && <button onClick={cancel}>取消</button>}
      {error && <p role="alert">{error.message}</p>}
      <div ref={content}>页面内容</div>
    </>
  );
}
```

在 Next.js App Router 中，请在客户端组件（`'use client'`）里调用。

## 仓库结构

<details>
<summary>展开目录</summary>

```text
src/lib/
├── core/          # 纯计算：分页、几何、规则
├── adapters/      # DOM 测量、快照、Canvas 截图、jsPDF
├── application/   # 流水线、导出服务、打印会话、取消
├── output/        # PDF / PNG writer、ZIP、页码
├── hooks/         # React 集成（仅 /react 入口）
└── overlay/       # 分页线可视化调试
src/demo/          # 工作台示例
src/landing/       # 落地页
e2e/               # Playwright 端到端用例
docs/              # 对外文档
assets/readme/     # README 视觉资产
```

</details>

## 依赖与运行环境

- 无服务端依赖：分页、截图与组装全部在浏览器内完成。
- 可选 React 16.8+：仅 `/react` 入口使用。
- 现代浏览器：需要 Canvas 2D、Range 与 Font Loading API。

## 开发

```sh
npm ci
npm start            # 本地工作台
npm run check        # 类型检查 + npm 包单测
npm run check:full   # 单测 + 库/站点构建 + 浏览器 e2e
```

约定：`src/lib/core` 保持纯计算；依赖方向为 `demo / ui → application → adapters + core`，不要反向 import。提交前钩子、源码细节与文档维护约定见 [CONTRIBUTING.md](https://github.com/darialan/web-printer/blob/master/CONTRIBUTING.md)。

## 文档

- [接入指南](https://github.com/darialan/web-printer/blob/master/docs/npm-package-guide.md)：参数、规则、框架集成与实现原理
- [输出层说明](https://github.com/darialan/web-printer/blob/master/docs/output-formats.md)：PDF / PNG writer 与失败语义

## License

MIT © darialan
