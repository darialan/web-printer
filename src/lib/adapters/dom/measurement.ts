import {
  assertAtomicFits,
  classifyPrintNode,
  DEFAULT_PRINT_RULES,
  getSplittableSelector,
  resolveSplittable,
} from '../../core/rules/print-rules';
import { DocumentMeasurement, Interval, PrintRule } from '../../core/types';
import { createTextMeasurer } from './text-range';
import { walkPrintTree } from './traversal';

const TEXT_NODE_TYPE = 3;
const ELEMENT_NODE_TYPE = 1;

export function readRootHeight(root: HTMLElement): number {
  const height = Math.max(root.getBoundingClientRect().height, root.scrollHeight);
  if (height <= 0 || height > 200000) {
    throw new Error('打印区域为空或超过 200,000px 高度限制');
  }
  return height;
}

function readLabel(element: Element): string | null {
  return element.getAttribute('data-print-label') || element.getAttribute('data-pdf-label') || element.getAttribute('alt');
}

/**
 * DOM 测量按四条路径处理：
 * 1. ignore 元素 → 整个子树跳过；
 * 2. atomic 元素 → 测量整体边界，不再下钻，超高直接报错；
 * 3. splittable 元素 → 默认递归分析子节点；命中整块优先保护策略时，放得下则整体保护；
 * 4. 文本节点 → 用 Range.getClientRects() 逐行测量。
 *
 * atomic 子树不需要冗余的文本测量：命中即整体入区间并停止遍历。
 */
export function measureDocument(
  root: HTMLElement,
  capacity: number,
  rules: readonly PrintRule[] = DEFAULT_PRINT_RULES,
  splittableSelector: string = getSplittableSelector()
): Required<DocumentMeasurement> {
  const bounds = root.getBoundingClientRect();
  // Coordinates always belong to this DOM. The print snapshot removes ignored
  // subtrees before measuring; live annotations retain the visible page layout.
  const height = readRootHeight(root);
  const ranges: Interval[] = [];
  const text = createTextMeasurer(bounds.top);
  const stats = { visitedNodes: 0, atomicElements: 0, textNodes: 0, textFragments: 0 };

  const add = (interval: Interval) => {
    const top = Math.max(0, interval.top);
    const bottom = Math.min(height, interval.bottom);
    if (bottom > top) ranges.push({ top, bottom });
  };
  const protectWhole = (rect: { top: number; bottom: number }) => {
    stats.atomicElements++;
    add({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top });
  };

  const rootRule = classifyPrintNode(root, rules);
  if (rootRule?.kind === 'ignore') throw new Error('打印区域已被 ignore 规则排除，请选择其他区域');
  if (rootRule?.kind === 'atomic') {
    assertAtomicFits(rootRule, height, capacity, readLabel(root));
    protectWhole({ top: bounds.top, bottom: bounds.top + height });
    return { height, ranges, stats: { ...stats, visitedNodes: 1 } };
  }
  if (rootRule?.kind === 'splittable') {
    if (root.matches(splittableSelector) && resolveSplittable(height, capacity) === 'protect') {
      protectWhole({ top: bounds.top, bottom: bounds.top + height });
      return { height, ranges, stats: { ...stats, visitedNodes: 1 } };
    }
    // A splittable root that cannot be protected as a whole follows the same
    // recursive path as splittable descendants.
  }

  walkPrintTree(root, node => {
    stats.visitedNodes++;
    if (node.nodeType === TEXT_NODE_TYPE) {
      if (!node.textContent?.trim()) return 'skip';
      const fragments = text(node);
      stats.textNodes++;
      stats.textFragments += fragments.length;
      fragments.forEach(add);
      return 'skip';
    }
    // Comments and other non-element, non-text nodes carry nothing to measure
    // or recurse into; only Element exposes .matches()/.getBoundingClientRect().
    if (node.nodeType !== ELEMENT_NODE_TYPE) return 'skip';
    const element = node as Element;
    const rule = classifyPrintNode(element, rules);
    if (rule?.kind === 'ignore') return 'skip';

    const rect = element.getBoundingClientRect();
    if (rule?.kind === 'atomic') {
      if (rect.width <= 0 || rect.height <= 0) return 'skip';
      assertAtomicFits(rule, rect.height, capacity, readLabel(element));
      protectWhole(rect);
      return 'skip';
    }
    if (rule?.kind === 'splittable') {
      if (
        rect.width > 0 && rect.height > 0 &&
        element.matches(splittableSelector) &&
        resolveSplittable(rect.height, capacity) === 'protect'
      ) {
        protectWhole(rect);
        return 'skip';
      }
      return 'descend';
    }
    return 'skip';
  });
  return { height, ranges, stats };
}
