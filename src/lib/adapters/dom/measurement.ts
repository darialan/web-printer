import {
  assertAtomicFits, assertSupportedRules, classifyPrintNode,
  DEFAULT_PRINT_RULES, getSplittableSelector, resolveSplittable,
} from '../../core/rules/print-rules';
import { DocumentMeasurement, Interval, PrintRule } from '../../core/types';
import { createTextMeasurer } from './text-range';
import { walkPrintTree } from './traversal';
import { assertNoLegacyIgnore, clipsAxis, isDisplaySuppressed, isPaintVisible } from './visibility';

export function readRootHeight(root: HTMLElement): number {
  // Component scrollports export their visible box. Ordinary document scrolling
  // does not clip the article; overflow:visible roots include out-of-flow content.
  const height = clipsAxis(root, 'Y') && !/^(BODY|HTML)$/.test(root.tagName)
    ? root.getBoundingClientRect().height
    : Math.max(root.getBoundingClientRect().height, root.scrollHeight);
  if (!Number.isFinite(height) || height <= 0 || height > 200000) {
    throw new Error('打印区域为空或超过 200,000px 高度限制');
  }
  return height;
}

function readLabel(element: Element): string | null {
  return element.getAttribute('data-print-label') || element.getAttribute('data-pdf-label') || element.getAttribute('alt');
}

interface Clip { top: number; bottom: number; left: number; right: number }

/** Measure only painted content in the existing layout; never expand scrollports. */
export function measureDocument(
  root: HTMLElement,
  capacity: number,
  rules: readonly PrintRule[] = DEFAULT_PRINT_RULES,
  splittableSelector: string = getSplittableSelector()
): Required<DocumentMeasurement> {
  assertSupportedRules(rules);
  assertNoLegacyIgnore(root);
  const bounds = root.getBoundingClientRect();
  const height = readRootHeight(root);
  const ranges: Interval[] = [];
  const text = createTextMeasurer(bounds.top);
  const stats = { visitedNodes: 0, atomicElements: 0, textNodes: 0, textFragments: 0 };
  const clips = new WeakMap<Element, Clip>();
  const unrestricted: Clip = { top: -Infinity, bottom: Infinity, left: -Infinity, right: Infinity };
  // Cache inherited clipping once per element rather than walking ancestors per line.
  const childClip = (element: Element): Clip => {
    const cached = clips.get(element);
    if (cached) return cached;
    const inherited = element === root || !element.parentElement ? unrestricted : childClip(element.parentElement);
    const clip = { ...inherited };
    if (clipsAxis(element, 'X') || clipsAxis(element, 'Y')) {
      const rect = element.getBoundingClientRect();
      const box = element as HTMLElement;
      if (clipsAxis(element, 'Y')) {
        clip.top = Math.max(clip.top, rect.top + (box.clientTop || 0));
        clip.bottom = Math.min(clip.bottom, rect.top + (box.clientTop || 0) + (box.clientHeight || rect.height));
      }
      if (clipsAxis(element, 'X')) {
        clip.left = Math.max(clip.left, rect.left + (box.clientLeft || 0));
        clip.right = Math.min(clip.right, rect.left + (box.clientLeft || 0) + (box.clientWidth || rect.width));
      }
    }
    clips.set(element, clip);
    return clip;
  };
  const visibleRect = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const clip = element === root ? unrestricted : childClip(element.parentElement || root);
    const top = Math.max(rect.top, clip.top);
    const bottom = Math.min(rect.bottom, clip.bottom);
    const left = Math.max(rect.left ?? -Infinity, clip.left);
    const right = Math.min(rect.right ?? Infinity, clip.right);
    return { top, bottom, height: bottom - top, width: Math.min(rect.width, right - left) };
  };
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
  if (isDisplaySuppressed(root)) throw new Error('打印区域不可见');
  if (rootRule?.kind === 'atomic' && isPaintVisible(root)) {
    assertAtomicFits(rootRule, height, capacity, readLabel(root));
    protectWhole({ top: bounds.top, bottom: bounds.top + height });
    return { height, ranges, stats: { ...stats, visitedNodes: 1 } };
  }
  if (isPaintVisible(root) && rootRule?.kind === 'splittable' && root.matches(splittableSelector) && resolveSplittable(height, capacity) === 'protect') {
    protectWhole({ top: bounds.top, bottom: bounds.top + height });
    return { height, ranges, stats: { ...stats, visitedNodes: 1 } };
  }
  walkPrintTree(root, node => {
    stats.visitedNodes++;
    if (node.nodeType === 3) {
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent || !isPaintVisible(parent)) return 'skip';
      const clip = childClip(parent);
      const fragments = text(node, clip);
      stats.textNodes++;
      stats.textFragments += fragments.length;
      fragments.forEach(add);
      return 'skip';
    }
    if (node.nodeType !== 1) return 'skip';
    const element = node as Element;
    if (isDisplaySuppressed(element)) return 'skip';
    // visibility is inherited but descendants can explicitly become visible.
    if (!isPaintVisible(element)) return 'descend';
    const rule = classifyPrintNode(element, rules);
    const rect = visibleRect(element);
    childClip(element);
    if (rule?.kind === 'atomic') {
      if (rect.width <= 0 || rect.height <= 0) return 'skip';
      assertAtomicFits(rule, rect.height, capacity, readLabel(element));
      protectWhole(rect);
      return 'skip';
    }
    if (rule?.kind === 'splittable' && rect.width > 0 && rect.height > 0 &&
        element.matches(splittableSelector) && resolveSplittable(rect.height, capacity) === 'protect') {
      protectWhole(rect);
      return 'skip';
    }
    return 'descend';
  });
  return { height, ranges, stats };
}
