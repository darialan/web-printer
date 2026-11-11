import { createContext, createElement, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'zh' | 'en';
const STORAGE_KEY = 'web-printer-locale';

export function readStoredLocale(): Locale {
  try {
    const requested = new URLSearchParams(window.location.search).get('lang');
    if (requested === 'zh' || requested === 'en') return requested;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch { /* Storage can be unavailable in private contexts. */ }
  return 'en';
}

function syncDocumentLocale(loc: Locale) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', loc);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en';
    document.title = copy[loc].title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy[loc].description);
    localStorage.setItem(STORAGE_KEY, loc);
  } catch { /* Keep switching functional without storage or DOM. */ }
}

const LocaleContext = createContext<[Locale, (next: Locale) => void] | null>(null);

function LocaleProviderInternal({
  children,
  initialLocale,
}: {
  children?: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale || readStoredLocale());

  useEffect(() => {
    syncDocumentLocale(locale);
  }, [locale]);

  const setLocale = (next: Locale) => {
    syncDocumentLocale(next);
    setLocaleState(next);
  };

  const value = useMemo<[Locale, (next: Locale) => void]>(
    () => [locale, setLocale],
    [locale],
  );

  return createElement(LocaleContext.Provider, { value }, children);
}

/**
 * Root locale provider. Guarantees that all child components,
 * including lazy-loaded chunks and separate subtrees, stay in 100% sync.
 */
export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const existing = useContext(LocaleContext);
  // If already wrapped in a parent LocaleProvider and no initialLocale override is passed,
  // reuse the parent provider without introducing duplicate state.
  if (existing && !initialLocale) {
    return createElement(Fragment, null, children);
  }
  return createElement(LocaleProviderInternal, { initialLocale }, children);
}

export function useLocale(): [Locale, (next: Locale) => void] {
  const context = useContext(LocaleContext);
  const [localFallback, setLocalFallback] = useState<Locale>(readStoredLocale);

  // If inside a LocaleProvider, use the centralized Context state
  if (context) {
    return context;
  }

  // Fallback for standalone tests rendered outside of LocaleProvider
  const setFallback = (next: Locale) => {
    syncDocumentLocale(next);
    setLocalFallback(next);
  };

  return [localFallback, setFallback];
}

export const copy = {
  zh: {
    title: 'Web Printer · 让网页保持原貌，让分页发生在正确的位置',
    description: '保留网页样式，按内容分页，更快、更稳地导出 PDF 和图片。适合业务报表、长表格、合同和文章，彻底解决 html2pdf.js 的截断与白屏问题。',
    skip: '跳至主要内容',
    nav: '全局导航',
    home: 'Web Printer 首页',
    features: '核心优势',
    examples: '场景示例',
    integration: '快速接入',
    faq: '常见问题',
    workbench: '打开工作台',
    dark: '切换到暗色主题',
    light: '切换到亮色主题',
    github: '查看 GitHub 仓库',
    language: '切换到英文',
    headline: ['让网页保持原貌，', '让分页发生在正确的位置。'],
    sloganEn: 'Print what you see. Break where it makes sense.',
    lede: '在浏览器内按内容安全分页，稳定导出 PDF 与图片。',
    tagline: 'Less clipping. More fidelity. Smarter page breaks.',
    try: '体验打印工作台',
    viewCode: '查看接入代码',
    note: 'MIT 开源 · 纯浏览器端 0 服务端成本 · 无缝兼容 React / Vue / 原生 JS',
    caption: '内容感知断点 · 表格跨页续头 · 逐页独立渲染 · 离屏沙盒快照',
    stackTitle: '适配你的现代技术栈',
    stackBody: '核心包基于纯 JavaScript / TypeScript，提供 React 专属 Hook，无缝集成 Vue 3、Next.js 及企业内部中后台系统。',
    stackLabel: '技术栈接入示例',
    featureTitle: '为什么不直接用 html2pdf.js？',
    featureBody: '传统方案按固定高度粗暴硬切整张长截图，Web Printer 测量 DOM 真实行间几何，在安全间隙处自然换页。',
    rules: [
      {
        title: '视觉保真 · 离屏沙盒快照',
        body: '在独立沙盒快照中测量与渲染，宿主 DOM 零重排、零污染。保留原有 CSS 布局、Flex/Grid 排版与 Canvas 绘制内容。',
        specimen: 'Layout Preserving',
      },
      {
        title: '智能分页 · 内容感知断点',
        body: '基于 DOM Range 测量真实文字行高，在行间自然断开，杜绝半行文字截断。表格行优先整行保护，跨页自动补齐表头。',
        specimen: 'Content-Aware',
      },
      {
        title: '逐页渲染 · 50+ 页文档不白屏',
        body: '先纯函数计算安全分页断点，再逐页独立生成 Canvas。彻底避免单张超大 Canvas 突破浏览器尺寸限制导致的白屏崩溃。',
        specimen: 'Page-by-Page',
      },
      {
        title: '声明式保护 · 规则与调试透视',
        body: '支持添加 data-print-atomic="true" 声明印章、图表整块换页不拆分；提供可视化调试图层，实时透视物理断点。',
        specimen: 'Inspectable',
      },
    ],
    benchmarkTitle: 'Benchmark：与 html2pdf.js 客观实测',
    benchmarkBody: '在标准硬件（Apple M1 Pro / 16GB 统一内存）与测试环境下的真实耗时（取 3 次中位数）与导出内容校验对比。',
    benchmarkHeaders: ['测试场景', 'html2pdf.js (0.14.0)', 'Web Printer', '提升 / 结果'],
    benchmarkRows: [
      { scene: '长文本（2 页）', legacy: '1,761 ms', wp: '759 ms', gain: '快约 2.3 倍', pass: true },
      { scene: '复杂表格（3 页）', legacy: '3,117 ms', wp: '1,237 ms', gain: '快约 2.5 倍', pass: true },
      { scene: '普通长文档（5 页）', legacy: '4,382 ms', wp: '2,167 ms', gain: '快约 2.0 倍', pass: true },
      { scene: '中长文档（10 页）', legacy: '7,798 ms', wp: '4,265 ms', gain: '快约 1.8 倍', pass: true },
      { scene: '长文档（15 页）', legacy: '内容标记重复，校验失败', wp: '6.96 s', gain: '内容校验通过', pass: true },
      { scene: '长文档（20 页）', legacy: '内容标记重复，校验失败', wp: '9.96 s', gain: '内容校验通过', pass: true },
      { scene: '超长文档（50 页）', legacy: '导出结果全白，校验失败', wp: '34.98 s', gain: '内容校验通过', pass: true },
    ],
    benchmarkNote: '测试硬件与环境：Apple M1 Pro (8核 CPU, 16GB 统一内存) · macOS · Chromium 141 · DPR 1.0 · A4 纵向 (scale 2)。使用 PDF.js 严格校验实际导出的 PDF，包括空白页与内容标记。',
    benchmarkViewReport: '查看完整测试报告与复现方法',
    examplesTitle: '面向复杂 Web 页面的真实场景',
    examplesBody: '真实后台报表、长单据、图文混排与自定义页眉页脚，均经过严格客观测试。',
    openExample: '打开示例',
    scenes: [
      { title: '多行长表格', body: '45 行带复杂表头与长单元格表格，检验表格行智能避让与跨页完整性。', type: '长表格单据' },
      { title: '长文章排版', body: '连续正文按实际文字行测量换页，段落跨页自然延续，文字行绝不截半。', type: '文字排版' },
      { title: '复杂图文与代码', body: '技术报告混合公式、代码块、矢量图与图片，原子元素整体换页保护。', type: '技术文档' },
      { title: '页眉页脚与页码', body: '每页固定重复企业抬头、防伪信息与动态页码，共享物理尺寸几何模型。', type: '自定义布局' },
    ],
    integrateTitle: '极简接入现有工程',
    integrateBody: '安装 NPM 包，在页面已渲染的 DOM 容器上调用统一的导出接口。',
    steps: [
      ['安装 NPM 包', '支持 npm / yarn / pnpm，TypeScript 类型完备，React Hook 独立可选引入。'],
      ['声明保护区域 (可选)', '对不可拆分的签名章、指标卡添加 data-print-atomic="true"，对长容器添加 splittable。'],
      ['一键导出多格式', 'PDF 单文件输出，或逐页高清 PNG 打包为 ZIP，共用同一套高精度分页计算。'],
    ],
    docs: '阅读接入文档',
    codeTabs: '框架接入示例',
    copy: '复制',
    copied: '已复制',
    copyError: '请手动复制',
    copyInstall: '复制安装命令',
    copyCommand: '复制命令',
    copyCode: '复制代码',
    install: 'npm 安装命令',
    faqTitle: '接入前，了解这些',
    faqBody: '运行机制、格式输出与当前的技术支持边界。',
    questions: [
      ['它与传统 html2pdf.js 有何本质区别？', '传统方案（如 html2pdf.js）通常将整页 HTML 截成一张超长 Canvas，容易在长文档下遭遇浏览器显存与尺寸限制导致空白 PDF，且分页时按固定高度粗暴截切，极易切半文字行；Web Printer 采用先计算安全区间再逐页微渲染架构，实现文字行安全避让并杜绝大 Canvas 崩溃。'],
      ['导出的 PDF 中的文字可以被选中和搜索吗？', '当前版本的 PDF 正文是由逐页高质量 Canvas 栅格化渲染的图像切片，暂不提供可复制搜索的原生矢量文字层。这一设计换取了对 CSS 现代排版、Canvas 动态图表与复杂 DOM 状态的最大视觉保真度。'],
      ['依赖具体的前端框架或组件库吗？', '核心包不依赖 React，也不绑定 Ant Design 等任何 UI 库。它直接测量浏览器已渲染出的真实 DOM 与 Range 几何，可在原生 JS、Vue 3、Angular、React 等任意现代项目中使用。'],
      ['需要部署服务端生成服务（如 Puppeteer）吗？', '完全不需要。分页测量、切片渲染与 PDF/PNG 组装全部在浏览器端完成，节约服务器资源与网络传输带宽。跨域图片只需对应静态资源服务器允许 CORS 即可。'],
      ['哪些样式特性需要提前在业务中验证？', '截图底座受 html2canvas 渲染能力支持范围影响。现代 CSS 特性如 oklch() / color-mix() 会报错；跨域 iframe、Web Components Shadow DOM 及全屏视频不属于默认保真边界，建议在接入前用实际业务单据测试。'],
      ['可以用于商业项目与企业内部系统吗？', '完全可以。本包采用商业友好的 MIT 开源许可证，分发与集成时保留原版权声明即可。'],
    ],
    footerLine: '让网页保持原貌，让分页发生在正确的位置。',
    footerNote: 'MIT 开源许可 · Web Printer',
  },
  en: {
    title: 'Web Printer · Print what you see. Break where it makes sense.',
    description: 'Preserve web styling, paginate by content, and reliably export PDF and images faster and safer. Built for enterprise reports, data tables, contracts, and long articles.',
    skip: 'Skip to content',
    nav: 'Main navigation',
    home: 'Web Printer Home',
    features: 'Features',
    examples: 'Examples',
    integration: 'Quick Start',
    faq: 'FAQ',
    workbench: 'Open Workbench',
    dark: 'Switch to dark theme',
    light: 'Switch to light theme',
    github: 'View GitHub repository',
    language: 'Switch to Chinese',
    headline: ['Print what you see.', 'Break where it makes sense.'],
    sloganEn: 'Print what you see. Break where it makes sense.',
    lede: 'Paginate by content, export stable PDFs and images directly in the browser.',
    tagline: 'Less clipping. More fidelity. Smarter page breaks.',
    try: 'Try Workbench',
    viewCode: 'View Code',
    note: 'MIT Licensed · Runs in Browser · Zero Server Overhead · Vanilla JS / React / Vue',
    caption: 'Content-Aware Breaks · Repeating Table Headers · Page-by-Page Rendering · Sandboxed Snapshots',
    stackTitle: 'Fits Your Stack',
    stackBody: 'Pure JavaScript / TypeScript core with an optional dedicated React Hook, smoothly integrating with Vue 3, Next.js, and vanilla web applications.',
    stackLabel: 'Framework integration examples',
    featureTitle: 'Why Not Just html2pdf.js?',
    featureBody: 'Traditional solutions slice a monolithic screenshot at fixed heights. Web Printer measures real text line geometry to break naturally at safe gaps.',
    rules: [
      {
        title: 'Layout Preserving · Sandboxed Snapshot',
        body: 'Measures and renders inside an off-screen snapshot with zero DOM pollution. Faithfully preserves original CSS layout, Flex/Grid styling, and canvas drawings.',
        specimen: 'Layout Preserving',
      },
      {
        title: 'Content-Aware · Text & Table Protection',
        body: 'Measures rendered text lines via DOM Range to place cuts strictly in safe line gaps. Keeps table rows intact and repeats <thead> across page transitions.',
        specimen: 'Content-Aware',
      },
      {
        title: 'Page-by-Page · No Blank Pages on 50+ Pages',
        body: 'Computes safe pagination mathematically before rendering page-by-page. Completely eliminates canvas dimension limits that crash long documents.',
        specimen: 'Page-by-Page',
      },
      {
        title: 'Declarative Rules · Atomic Marking & Debugging',
        body: 'Add data-print-atomic="true" to keep signatures, charts, or widgets whole on a single page. Built-in visual layer overlays exact green break lines.',
        specimen: 'Inspectable',
      },
    ],
    benchmarkTitle: 'Benchmark: vs html2pdf.js',
    benchmarkBody: 'Median execution times across 3 runs on standardized hardware (Apple M1 Pro / 16GB Unified Memory) with pixel-level PDF content verification.',
    benchmarkHeaders: ['Scenario', 'html2pdf.js (0.14.0)', 'Web Printer', 'Speedup / Result'],
    benchmarkRows: [
      { scene: 'Long Text (2 pages)', legacy: '1,761 ms', wp: '759 ms', gain: '~2.3x faster', pass: true },
      { scene: 'Complex Table (3 pages)', legacy: '3,117 ms', wp: '1,237 ms', gain: '~2.5x faster', pass: true },
      { scene: 'General Document (5 pages)', legacy: '4,382 ms', wp: '2,167 ms', gain: '~2.0x faster', pass: true },
      { scene: 'Medium Document (10 pages)', legacy: '7,798 ms', wp: '4,265 ms', gain: '~1.8x faster', pass: true },
      { scene: 'Long Document (15 pages)', legacy: 'Duplicate marks, verification failed', wp: '6.96 s', gain: 'Content verified', pass: true },
      { scene: 'Long Document (20 pages)', legacy: 'Duplicate marks, verification failed', wp: '9.96 s', gain: 'Content verified', pass: true },
      { scene: 'Ultra-long Doc (50 pages)', legacy: 'All-white output, failed', wp: '34.98 s', gain: 'Content verified', pass: true },
    ],
    benchmarkNote: 'Environment: Apple M1 Pro (8-core CPU, 16GB Unified Memory), macOS, Chromium 141, DPR 1.0, A4 portrait (scale 2). Exported PDFs verified with PDF.js for blank pages and content integrity.',
    benchmarkViewReport: 'View full benchmark report & methodology',
    examplesTitle: 'Built for Complex Web Pages',
    examplesBody: 'Enterprise purchase orders, lengthy forms, mixed layouts, and custom headers/footers validated against real-world test cases.',
    openExample: 'Open Example',
    scenes: [
      { title: 'Long Tables', body: 'A 45-row table with complex columns to test row-level boundary avoidance.', type: 'Table & Billing' },
      { title: 'Long-form Articles', body: 'Continuous typography measured line by line to keep reading flow unbroken.', type: 'Typography' },
      { title: 'Mixed Technical Media', body: 'Formulas, code blocks, SVGs, and images kept whole across page transitions.', type: 'Tech Docs' },
      { title: 'Repeating Headers & Footers', body: 'Consistent branding, security notes, and dynamic page counters across pages.', type: 'Custom Layout' },
    ],
    integrateTitle: 'Add It to Your App in 3 Steps',
    integrateBody: 'Install the NPM package and call a unified export API on any rendered DOM container.',
    steps: [
      ['Install Package', 'TypeScript definitions included; optional React Hooks entry point available via @darialan/web-printer/react.'],
      ['Mark Protected Areas (Optional)', 'Tag signatures, stamps, or widgets with data-print-atomic="true", and splittable containers with splittable.'],
      ['Export PDF & PNG', 'Download a single multi-page PDF or individual lossless PNG pages in a ZIP archive with progress callbacks.'],
    ],
    docs: 'Read Integration Docs',
    codeTabs: 'Framework Examples',
    copy: 'Copy',
    copied: 'Copied',
    copyError: 'Copy manually',
    copyInstall: 'Copy install command',
    copyCommand: 'Copy command',
    copyCode: 'Copy code',
    install: 'npm install command',
    faqTitle: 'Before You Integrate',
    faqBody: 'Architecture, rendering formats, and known technical boundaries.',
    questions: [
      ['How does it differ from html2pdf.js?', 'Traditional tools (like html2pdf.js) capture one monolithic canvas, which frequently hits browser canvas size limits on long pages resulting in blank PDFs, and slices across arbitrary heights clipping text lines in half. Web Printer calculates safe content intervals first and renders page by page.'],
      ['Is text selectable and searchable in the exported PDF?', 'Exported PDF pages currently contain canvas-rasterized high-resolution image slices. Selectable native text layers are not currently included, maximizing visual fidelity for complex CSS layouts.'],
      ['Does it depend on React or a specific UI library?', 'The core package has zero framework dependencies. It interacts directly with the browser DOM and Range API, functioning seamlessly in Vue, React, Angular, and vanilla JS.'],
      ['Is a backend PDF service (e.g. Puppeteer) required?', 'No server required. All geometry calculation, canvas slicing, and PDF/PNG composition execute entirely on the client side, saving cloud infrastructure and bandwidth costs.'],
      ['Which CSS features need verification in production?', 'Rendering depends on html2canvas capabilities. Advanced modern color models like oklch() / color-mix() are unsupported; cross-origin iframes and Shadow DOM should be validated in your environment.'],
      ['Can it be used in commercial projects?', 'Yes. The package is distributed under the permissive MIT license.'],
    ],
    footerLine: 'Print what you see. Break where it makes sense.',
    footerNote: 'MIT Licensed · Web Printer',
  },
};
