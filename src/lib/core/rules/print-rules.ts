import { ElementRule, PrintRule, PrintRuleConfig } from '../types';
export type { ElementRule, PrintRule, PrintRuleConfig } from '../types';

export interface ClassifiableNode {
  nodeType: number;
  matches?: (selector: string) => boolean;
}

const ELEMENT_NODE_TYPE = 1;

/** Atomic protects whole elements; splittable recursively measures children. */
export const PRINT_ATTRIBUTES = {
  /** Atomic: minimal atomic unit, never cut across pages, errors if exceeding single-page height */
  ATOMIC: 'data-print-atomic="true"',
  /** Splittable element classification; prefers keeping whole block intact, recursively splits if oversized */
  SPLITTABLE: 'data-print-splittable="true"',

  // Compatibility alias
  /** @deprecated Default is recursive analysis; retained for backwards compatibility. */
  FORCE_SPLIT: 'data-print-break="split"',
} as const;

export const PRINT_CLASSES = {
  ATOMIC: 'print-atomic',
  /** Splittable element classification; prefers keeping whole block intact, recursively splits if oversized */
  SPLITTABLE: 'print-splittable',

  // Compatibility alias
  /** @deprecated Default is recursive analysis; retained for backwards compatibility. */
  FORCE_SPLIT: 'print-force-split',
} as const;

/** @deprecated Use PRINT_ATTRIBUTES. Legacy attributes remain accepted. */
export const PDF_PRINT_ATTRIBUTES = {
  ATOMIC: 'data-pdf-atomic="true"',
  SPLITTABLE: 'data-pdf-splittable="true"',
} as const;
/** @deprecated Use PRINT_CLASSES. Legacy classes remain accepted. */
export const PDF_PRINT_CLASSES = {
  ATOMIC: 'pdf-atomic', SPLITTABLE: 'pdf-splittable',
} as const;

/** Native atomic rules. Every other element is splittable. */
export const BASE_PRINT_RULES: readonly PrintRule[] = [
  // Atomic rules (explicit atomic protection blocks: no splitting, errors if oversized)
  {
    selector:
      '[data-print-atomic="true"], .print-atomic, [data-print-keep-together="true"], .print-keep-together, [data-pdf-atomic="true"], .pdf-atomic, [data-pdf-keep-together="true"], .pdf-keep-together',
    result: { kind: 'atomic', label: 'Atomic Block' },
  },
  // Standard code/formula blocks are protected independently of framework or CSS position.
  { selector: 'pre, math', result: { kind: 'atomic', label: 'Code or Formula' } },
  // Native media and form controls
  {
    selector: 'img, canvas, svg, input, button, select, textarea',
    result: { kind: 'atomic', label: 'Media and Controls' },
  },
  {
    selector: 'h1, h2, h3, h4, h5, h6',
    result: { kind: 'atomic', label: 'Heading' },
  },
];

export const DEFAULT_PRINT_RULES: readonly PrintRule[] = BASE_PRINT_RULES;

/**
 * Splittable classification permits recursive analysis of child nodes. Elements matching this
 * selector first attempt whole-block measurement: if fitting within page height, protect intact;
 * otherwise descend recursively without throwing. Table rows (tr / [role="row"]) default to this preference.
 */
export const BASE_SPLITTABLE_SELECTOR =
  '[data-print-splittable="true"], .print-splittable, [data-print-keep-together="split"], .print-keep-or-split, [data-pdf-splittable="true"], .pdf-splittable, [data-pdf-keep-together="split"], .pdf-keep-or-split, tr, [role="row"]';

/**
 * Construct active print rules from base rules and custom configuration.
 */
export function buildPrintRules(config?: PrintRuleConfig): PrintRule[] {
  assertSupportedRuleConfig(config);
  if (!config) return [...BASE_PRINT_RULES];

  const customList: PrintRule[] = [];

  // Priority for custom rules
  if (config.customRules?.length) {
    customList.push(...config.customRules);
  }

  // Custom atomic selectors
  const atomicSelectors = [...(config.atomic || [])];
  if (atomicSelectors.length) {
    customList.push({
      selector: atomicSelectors.join(', '),
      result: { kind: 'atomic', label: 'Custom Atomic Element' },
    });
  }

  return [...customList, ...BASE_PRINT_RULES];
}

/**
 * Construct splittable selector from configuration.
 */
export function buildSplittableSelector(config?: PrintRuleConfig): string {
  assertSupportedRuleConfig(config);
  const extraSelectors = config?.splittable || [];
  const extra = extraSelectors.length ? extraSelectors.join(', ') + ', ' : '';
  return extra + BASE_SPLITTABLE_SELECTOR;
}

let activePrintRules: PrintRule[] = buildPrintRules();
let activeSplittableSelector: string = buildSplittableSelector();

/**
 * Configure global print rules (used by consumers to register framework/component selectors).
 */
export function configurePrint(config: PrintRuleConfig): void {
  const rules = buildPrintRules(config);
  const selector = buildSplittableSelector(config);
  activePrintRules = rules;
  activeSplittableSelector = selector;
}

/**
 * Get active global print rules.
 */
export function getPrintRules(): readonly PrintRule[] {
  return activePrintRules;
}

/**
 * Get active global splittable selector.
 */
export function getSplittableSelector(): string {
  return activeSplittableSelector;
}

/**
 * Reset global rules to base defaults.
 */
export function resetPrintRules(): void {
  activePrintRules = buildPrintRules();
  activeSplittableSelector = buildSplittableSelector();
}

/**
 * Classify a DOM node by matching rules; defaults to splittable.
 * Text nodes are handled separately by Range-based line measurement.
 */
export function classifyPrintNode(
  node: ClassifiableNode,
  rules: readonly PrintRule[] = getPrintRules()
): ElementRule | undefined {
  assertSupportedRules(rules);
  if (node.nodeType !== ELEMENT_NODE_TYPE || typeof node.matches !== 'function') {
    return undefined;
  }
  return rules.find(rule => node.matches!(rule.selector))?.result || { kind: 'splittable' };
}

/** Strict atomic protection: throws if exceeding page capacity with no fallback. */
export function assertAtomicFits(
  rule: Extract<ElementRule, { kind: 'atomic' }>,
  height: number,
  capacity: number,
  customLabel?: string | null
): void {
  if (height <= capacity) return;
  const label = customLabel || rule.label;
  throw new Error(
    `Atomic content block "${label}" is ${Math.ceil(height)}px tall, which exceeds available page height ${Math.floor(capacity)}px. Please reduce element size or increase page height.`
  );
}

/**
 * Determine whether a splittable element matching the whole-block preference should stay intact.
 * Protect intact if fitting within capacity; otherwise descend recursively.
 */
export function resolveSplittable(height: number, capacity: number): 'protect' | 'descend' {
  return height <= capacity ? 'protect' : 'descend';
}

/** Fail closed for JavaScript callers upgrading from the removed ignore API. */
export function assertSupportedRuleConfig(config?: PrintRuleConfig): void {
  if (config && Object.prototype.hasOwnProperty.call(config, 'ignore')) {
    throw new Error('Web Printer 3: PrintRuleConfig.ignore has been removed; please remove the legacy option and choose an appropriate print root');
  }
  assertSupportedRules(config?.customRules);
}

export function assertSupportedRules(rules?: readonly PrintRule[]): void {
  if (rules?.some(rule => !['atomic', 'splittable'].includes(rule.result?.kind))) {
    throw new Error('Web Printer 3: "ignore" element classification has been removed; rules only support "atomic" or "splittable", please migrate legacy rules');
  }
}
