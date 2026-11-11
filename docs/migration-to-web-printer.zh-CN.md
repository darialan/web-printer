# 从 WebPDF Printer 迁移至 Web Printer

<p align="right">
  <a href="./migration-to-web-printer.md">English</a> | <strong>中文</strong>
</p>

新品牌为 **Web Printer**；新包为 `@darialan/web-printer`。原 `@darialan/web-pdf-printer@1.0.2` 保持可下载。

```sh
npm uninstall @darialan/web-pdf-printer
npm install @darialan/web-printer
```

## 导出 API

`outputDocument({ format: 'pdf' | 'png' })` 是通用接口。`outputPDF()` 仍是仅输出 PDF 的兼容接口；真正与 PDF 格式有关的名称不作无意义替换。

```ts
import { outputDocument, outputPDF } from '@darialan/web-printer';
await outputDocument({ element: document.getElementById('content'), filename: 'report', format: 'png' });
```

React 集成改从独立入口导入，保证普通 JS/Vue 项目导入核心库时不必安装 React：

```tsx
import { useWebPrinter } from '@darialan/web-printer/react';
const { exportDocument, isExporting, progress, cancel } = useWebPrinter();
await exportDocument({ element: document.getElementById('content'), filename: 'report', format: 'png' });
```

旧 Hook 名称 `usePdfPrint`、`UsePdfPrintState`、`UsePdfPrintProgress` 在 `/react` 子入口保留；返回值仍有 `exportPDF`、`isPrinting`。不要从新包根入口导入 React Hook。旧包自己的入口不变。

## HTML 标记

| 推荐 | 仍可识别的旧标记 |
| --- | --- |
| `data-print-atomic="true"` / `.print-atomic` | `data-pdf-atomic="true"` / `.pdf-atomic` |
| `data-print-atomic="true"` / `.print-atomic`（推荐） | 旧 keep-together="true" 标记仍识别为 atomic |
| `data-print-splittable="true"` / `.print-splittable`（元素分类；默认递归，命中整块保护偏好时放得下则整体保护，超高时递归） | 旧 keep-together="split" 标记仍映射到 splittable |
| `data-print-break="split"` / `.print-force-split` | 保留为无操作旧标记 |

推荐常量为 `PRINT_ATTRIBUTES`、`PRINT_CLASSES`；`PDF_PRINT_ATTRIBUTES`、`PDF_PRINT_CLASSES` 保留 atomic / splittable 旧值，ignore 常量已在 3.0 改造中删除。业务选择器配置优先级与分页算法不变。检查事件使用 `print-inspection`；旧 `pdf-print-inspection` 事件继续发送。内部快照/调试属性改为 `data-print-snapshot` / `data-print-debug`，它们属于内部实现，不应由业务代码生成。

**节点分类重构（另见 `docs/npm-package-guide.md` 第五节）**：`classifyPrintNode()` 对元素显式返回 `{ kind: 'atomic', label }` 或 `{ kind: 'splittable' }`；文本节点由 DOM 层使用 Range 单独测量。`tr`、`[role="row"]` 与 splittable 标记均属于 splittable 元素；整块优先保护选择器使其放得下时整体保护，超高时递归，不报错。`ruleConfig.splittable` 注册额外的整块保护偏好；`ruleConfig.atomic` 则严格保护并在超高时报错。

GitHub 源码仓库和现有站点 URL 保持稳定；产品名称与 npm 安装入口已更名。工作区目录和 Vercel 项目 ID 属于部署基础设施，不改变内容或下载能力。

## 2.x 到 3.0

旧 ignore 配置和标记会阻止导出，需要先迁移，详见 [3.0 迁移说明](https://github.com/darialan/web-printer/blob/master/docs/migration-to-v3.md)。
