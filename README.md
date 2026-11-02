<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/darialan/web-printer@master/assets/readme/brand-mark.svg" width="48" height="48" alt="Web Printer">
</p>

<h1 align="center">Web Printer</h1>

<p align="center"><strong>专注长文档与业务报表的内容感知分页，保留打印视图布局，可靠导出 PDF 和图片。</strong></p>
<p align="center"><em>Print what you see. Break where it makes sense.</em></p>

<p align="center">针对 React / Vue / Angular 等现代前端生成的业务报表、财务审计单据、长表格与合同等固定打印视图，彻底解决传统客户端 HTML-to-PDF 方案中的<b>文字腰斩截断、表格拦腰砍断、逐页累积漂移、组件大面积空白与超长文档崩溃白屏</b>等结构性问题。</p>

<p align="center">
  <a href="https://pdf-demo-phi.vercel.app/#/playground">在线工作台</a> · <a href="https://pdf-demo-phi.vercel.app/#/benchmark">基准对照实验台</a> · <a href="https://www.npmjs.com/package/@darialan/web-printer">npm 包</a> · <a href="https://github.com/darialan/web-printer/blob/master/docs/npm-package-guide.md">接入指南</a> · <a href="https://github.com/darialan/web-printer/blob/master/docs/benchmark.md">Benchmark 报告</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@darialan/web-printer"><img src="https://img.shields.io/npm/v/@darialan/web-printer?color=245e48" alt="npm 版本"></a>
  <a href="https://github.com/darialan/web-printer/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@darialan/web-printer?color=245e48" alt="License MIT"></a>
  <a href="https://pdf-demo-phi.vercel.app/#/playground"><img src="https://img.shields.io/badge/demo-live-245e48" alt="在线 Demo"></a>
</p>

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/darialan/web-printer@master/assets/readme/hero.svg" width="100%" alt="Web Printer 分页导出示意图：左侧为核心定位与价值主张，右侧直观对比传统像素硬切导致的截断与 Web Printer 的内容感知安全断点">
</p>

<p align="center">客观基准场景全部通过 · A4 / A3 / A5 / Letter 多种纸张 · 纯浏览器端 0 服务端依赖 · MIT 开源</p>

[为什么选择 Web Printer](#why-web-printer) · [核心机制对比](#核心机制对比) · [分页可诊断与保护](#分页可诊断与保护) · [对比 html2pdf.js](#对比-html2pdfjs) · [能力边界声明](#能力边界声明) · [快速开始](#快速开始) · [文档](#文档)

---

### Why Web Printer?

传统客户端导出工具（如 html2pdf.js）的核心痛点，并非开发者凭空想象，而是 GitHub 社区长期反馈的真实生产障碍。Web Printer 针对这些痛点提供了根本性的架构破局：

- **杜绝文字半行截断（解决 [#692](https://github.com/eKoopmans/html2pdf.js/issues/692) 审计报告文字截断）**：传统方案按固定像素高度盲目下刀；Web Printer 通过 DOM Range 精确测量真实文字行高，将切刀严格约束在文字行间安全空隙，决不切断半行文字。
- **表格整行保护与长表格跨页表头（解决 [#281](https://github.com/eKoopmans/html2pdf.js/issues/281) 表头丢失与行切断）**：表格数据行优先整行原子保护；跨页时自动复制并注入 `<thead>` 表头，数十页数据对账依然清晰明了。
- **零逐页累积漂移（解决 [#393](https://github.com/eKoopmans/html2pdf.js/issues/393) 每页累积 1px 误差）**：告别在 DOM 中插入空白 spacer div 模拟分页的脆弱机制，采用独立沙盒快照与精确坐标系，无论 20 页还是 50 页，分页边界绝对精准，累积误差归零。
- **语义化元素分类，告别大面积怪异留白（解决 [#512](https://github.com/eKoopmans/html2pdf.js/issues/512) 信用报告空白）**：精细区分不可拆分的原子块（`atomic`，如印章、图表、签名）与可拆分容器（`splittable`，如列表、组件流），避免传统 `avoid-all` 把整页顶空。
- **逐页分块渲染，50+ 页超长文档不白屏（解决 [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) Canvas 超限白屏）**：严格控制单次 Canvas 资源，先计算全部分页断点，再逐页独立光栅化，内存恒定受控，杜绝单张超大 Canvas 突破浏览器限制（16384px / 32767px）导致的 20+ 页全白屏或崩溃。
- **离屏沙盒快照，宿主 DOM 零污染（解决 [#853](https://github.com/eKoopmans/html2pdf.js/issues/853) 样式重排与耗时）**：测量与截图完全在离屏沙盒完成，不克隆重排宿主庞大的 Material/Bootstrap 树，源页面样式与交互分毫不受影响。

---

## 核心机制对比

为什么传统方案会截断文字？为什么长文档会导出成空白？根本原因在于底层的流水线架构设计：

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/darialan/web-printer@master/assets/readme/pipeline-comparison.svg" width="100%" alt="底层实现机制对比：html2pdf.js 整页大图像素硬切流水线 vs Web Printer 3.0 内容感知与逐页渲染流水线">
</p>

| 环节 | 传统方案（如 html2pdf.js） | Web Printer 3.0 |
| --- | --- | --- |
| **DOM 隔离** | 在宿主页面容器内克隆并重排，改写 DOM 插入 spacer div 撑高 | **独立离屏沙盒快照**，源 DOM 零污染，宿主样式交互不受影响 |
| **分页决策** | 盲目按纸张像素高度算术等分，切刀位置与 DOM 内容无关 | **DOM Range 视觉行测量**，识别文字行与表格行安全断点 |
| **元素保护** | `avoid-all` 一刀切，常导致大容器整体下沉产生大面积空白 | **细粒度分类**：`atomic`（原子保护）与 `splittable`（递归拆分） |
| **光栅化过程** | 一次性生成整页超大 Canvas，页数多时超出浏览器高度上限 | **逐页分块渲染**（Page-by-Page），单页用完即释放，内存恒定受控 |
| **过程控制** | 无法取消，无真实逐页进度，大型应用容易卡死 | 原生支持 `AbortSignal` 取消、逐页进度回调与超时控制 |

---

## 分页可诊断与保护

Web Printer 提供了完整的分页诊断与保护机制，让分页不再是黑盒黑魔法：

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/darialan/web-printer@master/assets/readme/inspectable-preview.svg" width="100%" alt="工作台可诊断分页视图：左侧在真实报表上标记 atomic 行保护与安全断点，右侧为同源布局输出的标准 A4 预览">
</p>

- **声明式标记**：通过 `data-print-atomic="true"` 保护签名、印章、图表整块不拆；通过 `data-print-splittable="true"` 允许容器在子元素或文字行间灵活拆分。
- **零侵入规则注册**：也可以通过 `configurePrint({ atomic: ['.seal', '.chart'] })` 在业务层统一配置类名选择器，无需修改模板。
- **布局检查 API**：使用 `inspectPrintLayout()` 可以在不触发渲染的情况下，直接返回页数、断点位置、受保护区间及测量耗时，供前端校验与调试。

---

## 对比 html2pdf.js

以下数据来自本机（Chromium 141，DPR 1.0，A4 纵向，每组 3 次独立重复取中位数）客观基准测试：

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/darialan/web-printer@master/assets/readme/benchmark-table.svg" width="100%" alt="当前代码与 html2pdf.js 0.14.0 的本机 Benchmark 对照表：8 个场景中当前代码全部通过 PDF.js 逐页渲染校验，html2pdf.js 在 Flex/Grid 布局与 20/50 页长文档上未通过校验">
</p>

| 场景 | 对应痛点 | html2pdf.js 0.14.0 的表现 | Web Printer 3.0 |
| --- | --- | --- | --- |
| **长文本与混合字体** | [#692](https://github.com/eKoopmans/html2pdf.js/issues/692) 文字截断 | 1,761 ms · 纯像素硬切，文字行可能拦腰截半 | **759 ms** · 通过（DOM Range 按行测量，文字完整） |
| **复杂与嵌套表格** | [#281](https://github.com/eKoopmans/html2pdf.js/issues/281) 表头丢失 | 3,117 ms · 跨页无表头，表格行易被截裂 | **1,237 ms** · 通过（表格行保护，跨页自动补表头） |
| **Flex / Grid 布局** | [#666](https://github.com/eKoopmans/html2pdf.js/issues/666) 布局偏移 | ❌ **未通过**（PDF.js 校验第 2 页出现空白） | **630 ms** · 通过（保持原网页 CSS 布局） |
| **图文、Canvas 与 SVG** | [#1028](https://github.com/eKoopmans/html2pdf.js/issues/1028) 资源渲染 | 1,236 ms | **667 ms** · 通过 |
| **滚动容器与定位元素** | [#277](https://github.com/eKoopmans/html2pdf.js/issues/277) 定位重叠 | 1,221 ms | **639 ms** · 通过 |
| **5 页长文档** | 基础多页导出 | 4,382 ms | **2,167 ms** · 通过 |
| **20 页长文档** | [#393](https://github.com/eKoopmans/html2pdf.js/issues/393) 累积漂移 | ❌ **未通过**（内容标记重复出现 205 次/期望 200 次） | **9,959 ms** · 通过（20 页断点准确，零累积误差） |
| **50 页超长文档** | [#19](https://github.com/eKoopmans/html2pdf.js/issues/19) 超限白屏 | ❌ **严重故障**（Canvas 突破高度上限，50 页全部空白） | **34.9 s** · 通过（逐页渲染，耗时随页数线性增长） |

> 注："未通过" 指使用 PDF.js 对导出的 PDF 逐页进行像素校验失败（出现空白页或内容标记重复）。完整测试方法、参数口径与机制分析详见 [Benchmark 复现与口径](https://github.com/darialan/web-printer/blob/master/docs/benchmark.md)。

---

## 能力边界声明

为了避免过度宣传，我们诚实声明 Web Printer 3.0 的技术边界：

- **位图 PDF 输出**：当前版本与 html2canvas + jsPDF 共享光栅化底座，导出的 PDF 页面由高保真位图构成，**正文暂不包含可选中文本层**，暂不支持使用 `Ctrl+F` 检索页面文本。
- **底层光栅化限制**：受限于 html2canvas 本身的能力，部分现代 CSS 实验性属性（如高级混合模式、复杂 CSS 遮罩滤镜）及跨域未经 CORS 许可的图片资源同样受限。
- **定位收敛**：Web Printer 不追求兼容所有带有复杂动态交互的任意网页，而是**高度专注于现代前端框架生成的固定打印视图（报表、单据、合同、长文章）**，并在**内容感知分页计算、结构完整性保护、逐页分块渲染编排与超长文档稳定性**上提供确定性保障。

---

## 快速开始

### 安装

```sh
npm install @darialan/web-printer
```

### 原生 TypeScript / JavaScript

```ts
import { outputDocument } from '@darialan/web-printer';

await outputDocument({
  element: document.getElementById('report')!,
  filename: '财务审计报告',
  format: 'pdf', // 或 'png'：逐页 PNG 并自动打包为 ZIP
  paper: 'a4',   // 默认 A4 纵向，支持 'a3' | 'a5' | 'letter' 或自定义尺寸
  onProgress: (completed, total) => {
    console.log(`导出进度：${completed} / ${total} 页`);
  },
});
```

### React 集成

```tsx
import { useRef } from 'react';
import { useWebPrinter } from '@darialan/web-printer/react';

export function AuditReport() {
  const printRef = useRef<HTMLDivElement>(null);
  const { exportDocument, isExporting, progress, error, cancel } = useWebPrinter();

  return (
    <div>
      <div className="toolbar">
        <button
          disabled={isExporting}
          onClick={() =>
            exportDocument({
              element: printRef.current,
              filename: 'audit-report',
              format: 'pdf',
            }).catch(() => {})
          }
        >
          {isExporting ? `正在导出 (${progress.completed}/${progress.total} 页)` : '导出 PDF'}
        </button>

        {isExporting && <button onClick={cancel}>取消导出</button>}
      </div>

      {error && <p className="error" role="alert">{error.message}</p>}

      {/* 待导出的业务报表内容 */}
      <div ref={printRef} className="report-container">
        <h1>2026 年度企业财务审计报告</h1>

        {/* 标记为 atomic，整块保护不拆分 */}
        <div data-print-atomic="true" className="kpi-summary-cards">
          <p>核心指标概览...</p>
        </div>

        {/* 表格行自动享受优先整行保护，跨页自动续接表头 */}
        <table>
          <thead>
            <tr><th>核算科目</th><th>期初金额</th><th>期末金额</th></tr>
          </thead>
          <tbody>
            <tr><td>流动资产</td><td>¥ 12,000,000</td><td>¥ 15,300,000</td></tr>
          </tbody>
        </table>

        {/* 签字盖章栏原子保护 */}
        <div data-print-atomic="true" className="signature-box">
          <p>审计师签字与盖章</p>
        </div>
      </div>
    </div>
  );
}
```

> 在 Next.js App Router 中，请在客户端组件（`'use client'`）内调用。

---

## 常用 API

| API | 说明 |
| --- | --- |
| `outputDocument(options)` | 主导出函数，支持直接下载或返回 `Blob`（`download: false`） |
| `createPrintSession(options)` | 冻结一次离屏沙盒快照，供连续生成缩略图、预览及最终导出复用 |
| `inspectPrintLayout(options)` | 仅测量布局与计算断点，返回页数、断点数组、受保护区间及耗时 |
| `configurePrint(config)` | 全局注册 `atomic` 或 `splittable` 选择器（如 Ant Design / Element 表格行） |
| `visualizePageBreaks(pages, element)` | 在页面上直观绘制绿色分页线，便于调试排查 |

---

## 文档

- [接入指南](https://github.com/darialan/web-printer/blob/master/docs/npm-package-guide.md)：参数详解、HTML 标记规则、框架接入与算法实现
- [Benchmark 复现与口径](https://github.com/darialan/web-printer/blob/master/docs/benchmark.md)：对比 html2pdf.js 的实测数据、复现脚本与机制剖析
- [3.0 迁移说明](https://github.com/darialan/web-printer/blob/master/docs/migration-to-v3.md)：元素分类（atomic / splittable）与破坏性变更说明
- [输出层说明](https://github.com/darialan/web-printer/blob/master/docs/output-formats.md)：PDF / PNG writer 协议、打包机制与失败语义

---

## License

MIT © [darialan](https://github.com/darialan)
