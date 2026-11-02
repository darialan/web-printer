# 从 2.x 迁移到 3.0

本文说明从 2.x 升级到 3.0 的破坏性变更与迁移方式。

## 删除 ignore API 和标记

`ElementRule` 只保留 `{ kind: 'atomic', label }` 与 `{ kind: 'splittable' }`。`PrintRuleConfig.ignore`、所有 `PRINT_*` / `PDF_PRINT_*` 常量中的 `IGNORE` 已删除。JavaScript 传入含 `ignore` 键的配置（即使为空）或旧 `{ kind: 'ignore' }` 规则会明确报错。

导出、布局准备、资源等待、快照克隆和测量会检查打印根及后代中的 `[data-print-ignore]`、`.print-ignore`、`[data-pdf-ignore]`、`.pdf-ignore`。只要属性存在就需要迁移，包括值为 `false` 或 CSS 已隐藏的节点。检测失败时停止导出，不继续生成可能泄露旧内容的文件。

把操作区放在打印根外，并移除旧配置、常量和标记：

```html
<button id="export">导出报告</button>
<article id="report">
  <h1>报告</h1>
  <p>这里的已渲染内容都属于导出范围。</p>
</article>
```

```ts
await outputDocument({
  element: document.getElementById('report'),
  filename: 'report',
  ruleConfig: {
    atomic: ['.signature'],
    splittable: ['.long-card'],
  },
});
```

默认不会按按钮、分页器、交互属性或业务类名删除内容。`display:none`、`visibility:hidden`、`hidden` 仍按浏览器实际 CSS 结果处理；可见性不是分页分类。

`excludedElements` 与 `transformSnapshotNode` 是原有的调用方显式快照定制能力，仍保留。它们可能改变布局，使用后的结果不属于默认视觉保真保证；新接入优先选择合适的打印根节点。`resourceExcludedElements` 只跳过源资源等待，供替换资源的变换使用。

## Atomic 与 splittable

Atomic 整体保护，超过单页可见容量报错。Splittable 递归分析子节点；表格行与 `ruleConfig.splittable` 注册的选择器整体放得下时优先保留，超高时继续测量内部文字行和原子元素。`data-pdf-atomic`、`data-pdf-splittable` 及旧 keep-together 别名继续识别，旧 forceSplit 标记仍为无操作。

相邻受保护区间的共同边界可以分页，重叠区间会合并。最后一页只剩 padding 等未保护区域时，在两页均有合法容量的前提下，把末行或末块一起移到尾页；不丢弃原始范围。

## 快照、调试和生命周期

内部滚动区域保留原裁剪尺寸、`scrollTop` 与 `scrollLeft`；fixed 和 sticky 冻结到当前几何位置。源 DOM 不作布局修改。多选 select、input、textarea 和可读取 Canvas 的当前状态会复制到快照。

调试层独立于业务根节点，不再修改其 position，也不再按业务节点上的 `data-print-debug` 删除内容。只排除库自己持有的调试层。`ObservabilityStats.ignore` 改为 `excluded`，仅统计调用方显式排除的区域。

`cleanup()` 和会话 `dispose()` 可重复调用。截图取消会释放该次截图持有的 iframe，迟到的 Canvas 也会清零；单页截图最多等待 30 秒。资源预检仍为 15 秒。源区域在准备布局至清理期间拒绝并发导出。

`outputDocument()` 增加 `captures` 时序和像素诊断。既有 `blob / pages / bytes / layoutMs / totalMs`、进度回调、会话与 PDF／PNG Writer 协议保留。

## 验证后再升级

```sh
npm run check:full
npm run benchmark
npm pack --dry-run
```

图像、性能与依赖差异口径见 [Benchmark](https://github.com/darialan/web-printer/blob/master/docs/benchmark.md)。已知无法还原的 CSS 应在实际业务页复测；固定样本通过不代表任意网站都能完全还原。
