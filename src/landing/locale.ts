import { useEffect, useState } from 'react';

export type Locale = 'zh' | 'en';
const STORAGE_KEY = 'web-printer-locale';

export const copy = {
  zh: {
    title: 'Web Printer · 让网页保持原貌，让分页发生在正确的位置',
    description: '一款面向复杂 Web 页面的视觉保真分页导出工具。针对传统 HTML-to-PDF 方案中的布局变化、内容截断和长页面渲染问题，提供更精细、可诊断的分页控制。',
    skip: '跳至主要内容', nav: '全局导航', home: 'Web Printer 首页', features: '核心优势', examples: '场景示例', integration: '快速接入', faq: '常见问题', workbench: '打开工作台',
    dark: '切换到暗色主题', light: '切换到亮色主题', github: '查看 GitHub 仓库', language: '切换到英文',
    headline: ['让网页保持原貌，', '让分页发生在正确的位置。'],
    sloganEn: 'Print what you see. Break where it makes sense.',
    lede: '面向复杂 Web 页面的视觉保真分页导出引擎。针对传统 HTML-to-PDF 方案中的布局失真、内容截断和长页面渲染限制，在浏览器内实现精细、可诊断的多页 PDF 与 PNG 导出。',
    tagline: 'Less clipping. More fidelity. Smarter page breaks.',
    try: '体验打印工作台', viewCode: '查看接入代码', note: 'MIT 开源 · 纯浏览器运行 · 零服务端依赖',
    caption: '视觉保真 · 智能避让断点 · 逐页微切片渲染 · 独立调试层',
    stackTitle: '适配你的技术栈', stackBody: '纯 JavaScript / TypeScript 核心，无缝支持 React、Vue、Next.js 及原生中后台系统。', stackLabel: '技术栈接入示例',
    featureTitle: '为什么选择 Web Printer？', featureBody: '专为后台报表、业务单据、可视化大屏等复杂已渲染页面设计，彻底告别粗暴切片。',
    rules: [
      {
        title: '视觉保真 · Layout Preserving',
        body: '尽量保留原页面的样式、宽度与布局，减少导出过程中的缩放和意外重排。忠实保留内部滚动区域当前可视状态、表单填写值及 Canvas 绘制内容。',
        specimen: 'Layout Preserving',
      },
      {
        title: '智能分页 · Content-Aware Pagination',
        body: '按视觉行测量实际文字位置，智能识别表格行、图片、SVG 与代码块边界。计算安全切分断点，杜绝文字被拦腰切半或关键内容被截断。',
        specimen: 'Content-Aware',
      },
      {
        title: '逐页渲染 · Page-by-Page Rendering',
        body: '先纯函数计算全局安全分页，再按 PageSlice 逐页渲染微 Canvas。彻底摆脱整张超长截图带来的浏览器尺寸与显存上限，保证数十页长文档稳定导出。',
        specimen: 'Page-by-Page',
      },
      {
        title: '分页可诊断 · Inspectable Pagination',
        body: '提供独立调试图层，实时透视安全分页物理断点、受保护区间与布局测量信息。让每一处分页决策透明可溯、精确定位排查。',
        specimen: 'Inspectable',
      },
    ],
    examplesTitle: '面向复杂 Web 页面的真实场景', examplesBody: '真实后台报表、长单据、图文混排与自定义页眉页脚，均经过严格客观测试。', openExample: '打开示例',
    scenes: [
      { title: '多行长表格', body: '45 行带复杂表头与长单元格表格，检验表格行智能避让与跨页完整性。', type: '长表格单据' },
      { title: '长文章排版', body: '连续正文按实际文字行测量换页，段落跨页自然延续，文字行绝不截半。', type: '文字排版' },
      { title: '复杂图文与代码', body: '技术报告混合公式、代码块、矢量图与图片，原子元素整体换页保护。', type: '技术文档' },
      { title: '页眉页脚与页码', body: '每页固定重复企业抬头、防伪信息与动态页码，共享物理尺寸几何模型。', type: '自定义布局' },
    ],
    integrateTitle: '极简接入现有工程', integrateBody: '安装 NPM 包，在页面已渲染的 DOM 容器上调用统一的导出接口。', steps: [
      ['安装 NPM 包', '支持 ESM 与 CommonJS，TypeScript 类型完整提供，React Hook 独立可选引入。'],
      ['指定打印容器', '直接传入待导出的业务 DOM 根节点，自动等待图片与 Web Fonts 加载就绪。'],
      ['一键导出多格式', 'PDF 单文件输出，或逐页高清 PNG 打包为 ZIP，共用同一份精准分页计划。'],
    ], docs: '阅读接入文档', codeTabs: '框架接入示例', copy: '复制', copied: '已复制', copyError: '请手动复制', copyInstall: '复制安装命令', copyCommand: '复制命令', copyCode: '复制代码', install: 'npm 安装命令',
    faqTitle: '接入前，了解这些', faqBody: '运行机制、格式输出与当前的技术支持边界。',
    questions: [
      ['它与传统 html2pdf.js 有何本质区别？', '传统方案（如 html2pdf.js）通常将整页 HTML 截成一张超长 Canvas，容易在长文档下遭遇浏览器尺寸上限导致空白 PDF，且分页时按固定高度粗暴截切，极易切半文字行或造成空白；Web Printer 采用先计算安全区间再逐页微渲染架构，实现文字行避让并杜绝大 Canvas 崩溃。'],
      ['依赖具体的前端框架或组件库吗？', '核心包不依赖 React，也不绑定 Ant Design 等任何 UI 库。它直接测量浏览器已渲染出的真实 DOM 与 Range 几何，可在原生 JS、Vue 3、Angular、React 等任意现代项目中使用。'],
      ['需要部署服务端生成服务（如 Puppeteer）吗？', '完全不需要。分页测量、切片渲染与 PDF/PNG 组装全部在浏览器端完成，节约服务器资源与网络传输带宽。跨域图片只需对应静态资源服务器允许 CORS 即可。'],
      ['导出的 PDF 中的文字可以被选中和搜索吗？', '当前版本的 PDF 正文是由逐页高质量 Canvas 栅格化渲染的图像切片，暂不提供可复制搜索的原生矢量文字层。这一设计换取了对 CSS 现代排版、Canvas 动态图表与复杂 DOM 状态的最大保真度。'],
      ['哪些样式特性需要提前在业务中验证？', '截图底座受 html2canvas 渲染能力支持范围影响。现代 CSS 特性如 oklch() / color-mix() 会报错；跨域 iframe、Web Components Shadow DOM 及全屏视频不属于默认保真边界，建议在接入前用实际业务单据测试。'],
      ['可以用于商业项目与企业内部系统吗？', '完全可以。本包采用商业友好的 MIT 开源许可证，分发与集成时保留原版权声明即可。'],
    ],
    footerLine: '让网页保持原貌，让分页发生在正确的位置。', footerNote: 'MIT 开源许可 · Web Printer 3.0',
  },
  en: {
    title: 'Web Printer · Print what you see. Break where it makes sense.',
    description: 'A layout-preserving, content-aware pagination and export engine for complex web pages. Avoid clipping, distortion, and canvas limits in browser-side PDF/PNG export.',
    skip: 'Skip to content', nav: 'Main navigation', home: 'Web Printer Home', features: 'Features', examples: 'Examples', integration: 'Quick Start', faq: 'FAQ', workbench: 'Open Workbench',
    dark: 'Switch to dark theme', light: 'Switch to light theme', github: 'View GitHub repository', language: 'Switch to Chinese',
    headline: ['Print what you see.', 'Break where it makes sense.'],
    sloganEn: 'Less clipping. More fidelity. Smarter page breaks.',
    lede: 'A visual-preserving, content-aware pagination and export engine for complex web pages. Solves layout shifts, clipped lines, and long-canvas limits in traditional HTML-to-PDF tools.',
    tagline: 'Less clipping. More fidelity. Smarter page breaks.',
    try: 'Try Workbench', viewCode: 'View Code', note: 'MIT Licensed · Runs in Browser · Zero Server Overhead',
    caption: 'High Fidelity · Content-Aware Breaks · Page-by-Page Canvas · Inspectable Layers',
    stackTitle: 'Fits Your Stack', stackBody: 'Pure JavaScript / TypeScript core, smoothly integrating with React, Vue, Next.js, and vanilla web applications.', stackLabel: 'Framework integration examples',
    featureTitle: 'Why Web Printer?', featureBody: 'Built specifically for dashboards, enterprise bills, data tables, and long articles.',
    rules: [
      {
        title: 'Layout Preserving',
        body: 'Faithfully maintains existing CSS styles, column widths, and flex/grid layout. Freezes container scrollports, sticky elements, input values, and live canvas drawings.',
        specimen: 'Layout Preserving',
      },
      {
        title: 'Content-Aware Pagination',
        body: 'Measures rendered text lines via Range.getClientRects() and identifies table rows, figures, and code blocks. Calculates safe break boundaries to prevent severed text.',
        specimen: 'Content-Aware',
      },
      {
        title: 'Page-by-Page Rendering',
        body: 'Computes global slices mathematically first, then captures individual page-sized canvases. Completely avoids browser canvas dimension limits and out-of-memory crashes on long docs.',
        specimen: 'Page-by-Page',
      },
      {
        title: 'Inspectable Pagination',
        body: 'Provides an independent debug overlay that illuminates physical break lines, protected intervals, and geometry metrics. Every break decision is inspectable and transparent.',
        specimen: 'Inspectable',
      },
    ],
    examplesTitle: 'Built for Complex Web Pages', examplesBody: 'Enterprise reports, lengthy forms, mixed layouts, and custom headers/footers validated against real-world test cases.', openExample: 'Open Example',
    scenes: [
      { title: 'Long Tables', body: 'A 45-row table with complex columns to test row-level boundary avoidance.', type: 'Table & Billing' },
      { title: 'Long-form Articles', body: 'Continuous typography measured line by line to keep reading flow unbroken.', type: 'Typography' },
      { title: 'Mixed Technical Media', body: 'Formulas, code blocks, SVGs, and images kept whole across page transitions.', type: 'Tech Docs' },
      { title: 'Repeating Headers & Footers', body: 'Consistent branding, security notes, and dynamic page counters across pages.', type: 'Custom Layout' },
    ],
    integrateTitle: 'Add It to Your App', integrateBody: 'Install the NPM package and call a unified export API on any rendered DOM container.', steps: [
      ['Install Package', 'TypeScript definitions included; optional React Hooks entry point available via @darialan/web-printer/react.'],
      ['Select Container', 'Pass the target DOM element directly; asynchronous assets and web fonts settle automatically.'],
      ['Export PDF & PNG', 'Download a single multi-page PDF or individual lossless PNG pages in a ZIP archive.'],
    ], docs: 'Read Integration Docs', codeTabs: 'Framework Examples', copy: 'Copy', copied: 'Copied', copyError: 'Copy manually', copyInstall: 'Copy install command', copyCommand: 'Copy command', copyCode: 'Copy code', install: 'npm install command',
    faqTitle: 'Before You Integrate', faqBody: 'Architecture, rendering formats, and known technical boundaries.',
    questions: [
      ['How does it differ from html2pdf.js?', 'Traditional tools (like html2pdf.js) capture one monolithic canvas, which frequently hits browser canvas size limits on long pages resulting in blank PDFs, and slices across arbitrary heights clipping text lines in half. Web Printer calculates content intervals first and renders page by page.'],
      ['Does it depend on React or a specific UI library?', 'The core package has zero framework dependencies. It interacts directly with the browser DOM and Range API, functioning seamlessly in Vue, React, Angular, and vanilla JS.'],
      ['Is a backend PDF service (e.g. Puppeteer) required?', 'No server required. All geometry calculation, canvas slicing, and PDF/PNG composition execute entirely on the client side.'],
      ['Is text selectable and searchable in the exported PDF?', 'Exported PDF pages currently contain canvas-rasterized high-resolution image slices. Selectable native text layers are not currently included, maximizing visual fidelity for complex CSS layouts.'],
      ['Which CSS features need verification in production?', 'Rendering depends on html2canvas capabilities. Advanced modern color models like oklch() / color-mix() are unsupported; cross-origin iframes and Shadow DOM should be validated in your environment.'],
      ['Can it be used in commercial projects?', 'Yes. The package is distributed under the permissive MIT license.'],
    ],
    footerLine: 'Print what you see. Break where it makes sense.', footerNote: 'MIT Licensed · Web Printer 3.0',
  },
};

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get('lang');
      if (requested === 'zh' || requested === 'en') return requested;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    } catch { /* Storage can be unavailable in private contexts. */ }
    return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', locale);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = copy[locale].title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy[locale].description);
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* Keep switching functional without storage. */ }
  }, [locale]);
  return [locale, setLocale] as const;
}
