import { ElementRule, PrintRule, PrintRuleConfig } from '../types';
export type { ElementRule, PrintRule, PrintRuleConfig } from '../types';

export interface ClassifiableNode {
  nodeType: number;
  matches?: (selector: string) => boolean;
}

const ELEMENT_NODE_TYPE = 1;

/**
 * 打印系统三大标准属性协议 (Data Attributes & Classes)
 * 纯原生技术无关的标准协议，业务方自写组件或页面时直接绑定：
 * 1. ignore: 不打印，完全排除在打印纸张外
 * 2. atomic: 最小原子单元，不可分割，超过单页可用高度直接报错
 * 3. splittable: 元素分类，默认递归分析子节点；部分选择器另有整块优先保护策略
 * 文本节点由 DOM 测量层使用 Range 逐行测量。
 */
export const PRINT_ATTRIBUTES = {
  /** 不可分割：最小原子化单元，严禁跨页切断，超过单页可用高度直接报错 */
  ATOMIC: 'data-print-atomic="true"',
  /** 打印忽略：不参与测量、快照与打印渲染 */
  IGNORE: 'data-print-ignore="true"',
  /** 可分割元素分类；命中整块优先保护选择器时尽量整块保留，超高时递归拆分；表格行默认采用此偏好 */
  SPLITTABLE: 'data-print-splittable="true"',

  // 兼容别名
  /** @deprecated 默认即递归分析，保留仅用于兼容旧标记，不再影响分类结果。 */
  FORCE_SPLIT: 'data-print-break="split"',
} as const;

export const PRINT_CLASSES = {
  ATOMIC: 'print-atomic',
  IGNORE: 'print-ignore',
  /** 可分割元素分类；命中整块优先保护选择器时尽量整块保留，超高时递归拆分；表格行默认采用此偏好 */
  SPLITTABLE: 'print-splittable',

  // 兼容别名
  /** @deprecated 默认即递归分析，保留仅用于兼容旧标记，不再影响分类结果。 */
  FORCE_SPLIT: 'print-force-split',
} as const;

/** @deprecated Use PRINT_ATTRIBUTES. Legacy attributes remain accepted. */
export const PDF_PRINT_ATTRIBUTES = {
  ATOMIC: 'data-pdf-atomic="true"',
  SPLITTABLE: 'data-pdf-splittable="true"',
  IGNORE: 'data-pdf-ignore="true"',
} as const;
/** @deprecated Use PRINT_CLASSES. Legacy classes remain accepted. */
export const PDF_PRINT_CLASSES = {
  ATOMIC: 'pdf-atomic', SPLITTABLE: 'pdf-splittable', IGNORE: 'pdf-ignore',
} as const;

/**
 * 核心基础规则（BASE_PRINT_RULES）
 * 定义 ignore（不打印）与 atomic（严格不可分割）规则；未命中的元素由分类函数归为 splittable。
 * 遵循技术无关、纯原生标准原则：只包含 HTML 标准元素与通用打印协议，绝不硬编码任何具体前端组件库类名。
 */
export const BASE_PRINT_RULES: readonly PrintRule[] = [
  // 1. 忽略规则（不打印：标准不可见标签与协议标记）
  {
    selector: 'script, style, template, [hidden], [data-print-debug], [data-print-ignore="true"], .print-ignore, [data-pdf-debug], [data-pdf-ignore="true"], .pdf-ignore',
    result: { kind: 'ignore' },
  },
  // 2. 不可分割规则（显式声明的原子保护块：严禁拆分，超高报错）
  {
    selector:
      '[data-print-atomic="true"], .print-atomic, [data-print-keep-together="true"], .print-keep-together, [data-pdf-atomic="true"], .pdf-atomic, [data-pdf-keep-together="true"], .pdf-keep-together',
    result: { kind: 'atomic', label: '不可分割区域' },
  },
  // Standard code/formula blocks are protected independently of framework or CSS position.
  { selector: 'pre, math', result: { kind: 'atomic', label: '代码或公式' } },
  // 3. 原生不可切图片媒体与标题
  {
    selector: 'img, canvas, svg, input, button, select, textarea',
    result: { kind: 'atomic', label: '图片媒体与表单控件' },
  },
  {
    selector: 'h1, h2, h3, h4, h5, h6',
    result: { kind: 'atomic', label: '标题' },
  },
];

export const DEFAULT_PRINT_RULES: readonly PrintRule[] = BASE_PRINT_RULES;

/**
 * splittable 分类允许递归分析子节点；命中此选择器的元素另先尝试整体测量，
 * 能放进单页可用高度就整块保护，放不下则继续递归且不报错。表格行（tr / [role="row"]）默认采用此分页偏好。
 */
export const BASE_SPLITTABLE_SELECTOR =
  '[data-print-splittable="true"], .print-splittable, [data-print-keep-together="split"], .print-keep-or-split, [data-pdf-splittable="true"], .pdf-splittable, [data-pdf-keep-together="split"], .pdf-keep-or-split, tr, [role="row"]';

/**
 * 根据基础规则与配置构造最终生效的规则列表（只产出 ignore / atomic）
 */
export function buildPrintRules(config?: PrintRuleConfig): PrintRule[] {
  if (!config) return [...BASE_PRINT_RULES];

  const customList: PrintRule[] = [];

  // 用户完全自定义的高级规则优先
  if (config.customRules?.length) {
    customList.push(...config.customRules);
  }

  // 自定义忽略（不打印）
  if (config.ignore?.length) {
    customList.push({
      selector: config.ignore.join(', '),
      result: { kind: 'ignore' },
    });
  }

  // 自定义不可分割原子项（atomic）
  const atomicSelectors = [...(config.atomic || [])];
  if (atomicSelectors.length) {
    customList.push({
      selector: atomicSelectors.join(', '),
      result: { kind: 'atomic', label: '自定义原子项' },
    });
  }

  // 兜底追加纯原生基础内置规则
  return [...customList, ...BASE_PRINT_RULES];
}

/**
 * 根据配置构造整块优先保护的选择器；未命中该选择器的 splittable 元素仍递归测量。
 * 使用 splittable 字段注册选择器；forceSplit 已废弃为无操作。
 */
export function buildSplittableSelector(config?: PrintRuleConfig): string {
  const extraSelectors = config?.splittable || [];
  const extra = extraSelectors.length ? extraSelectors.join(', ') + ', ' : '';
  return extra + BASE_SPLITTABLE_SELECTOR;
}

let activePrintRules: PrintRule[] = buildPrintRules();
let activeSplittableSelector: string = buildSplittableSelector();

/**
 * 全局统一配置打印规则（业务层通过此处注册各自技术栈/组件库的选择器）
 */
export function configurePrint(config: PrintRuleConfig): void {
  activePrintRules = buildPrintRules(config);
  activeSplittableSelector = buildSplittableSelector(config);
}

/**
 * 获取当前全局生效的打印规则列表
 */
export function getPrintRules(): readonly PrintRule[] {
  return activePrintRules;
}

/**
 * 获取当前全局生效的 splittable 选择器
 */
export function getSplittableSelector(): string {
  return activeSplittableSelector;
}

/**
 * 重置全局规则为原生基础规则
 */
export function resetPrintRules(): void {
  activePrintRules = buildPrintRules();
  activeSplittableSelector = buildSplittableSelector();
}

/**
 * 对元素节点进行分类匹配，首个匹配的选择器生效；未命中时明确归类为 splittable。
 * 文本节点不属于元素分类，交由 DOM 遍历层使用 Range 逐行测量。
 */
export function classifyPrintNode(
  node: ClassifiableNode,
  rules: readonly PrintRule[] = getPrintRules()
): ElementRule | undefined {
  if (node.nodeType !== ELEMENT_NODE_TYPE || typeof node.matches !== 'function') {
    return undefined;
  }
  return rules.find(rule => node.matches!(rule.selector))?.result || { kind: 'splittable' };
}

/** 严格不可分割：超过单页可用高度即报错，不提供任何降级路径。 */
export function assertAtomicFits(
  rule: Extract<ElementRule, { kind: 'atomic' }>,
  height: number,
  capacity: number,
  customLabel?: string | null
): void {
  if (height <= capacity) return;
  const label = customLabel || rule.label;
  throw new Error(
    `不可拆分区域「${label}」高 ${Math.ceil(height)}px，超过正文可用高度 ${Math.floor(capacity)}px，请缩小该区域或增大页面高度`
  );
}

/**
 * 判断命中整块优先保护选择器的 splittable 元素是否应整体保护。
 * 整体能放进单页可用高度时保护；超高时递归分析子节点，不报错。
 * 选择器匹配由调用方（DOM 适配层）负责，这里只回答"给定高度是否该整块保护"。
 */
export function resolveSplittable(height: number, capacity: number): 'protect' | 'descend' {
  return height <= capacity ? 'protect' : 'descend';
}
