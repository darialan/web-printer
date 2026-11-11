import { assertNoLegacyIgnore, isDisplaySuppressed, isPaintVisible } from './visibility';
import { Interval } from '../../core/types';
import { walkPrintTree } from './traversal';

const TEXT_NODE_TYPE = 3;

export function createTextMeasurer(rootTop: number, collapse: (y: number) => number = y => y) {
  const lineHeights = new WeakMap<Element, number>();
  const range = document.createRange();
  return (node: Node, clip?: { top: number; bottom: number; left: number; right: number }): Interval[] => {

    const parent = node.parentElement;
    if (parent && !lineHeights.has(parent)) {
      const win = parent.ownerDocument?.defaultView || window;
      const lh = win.getComputedStyle ? win.getComputedStyle(parent).lineHeight : window.getComputedStyle(parent).lineHeight;
      lineHeights.set(parent, parseFloat(lh));
    }
    const lineHeight = parent ? lineHeights.get(parent)! : NaN;
    range.selectNodeContents(node);
    const rects = range.getClientRects ? Array.from(range.getClientRects()) : [];
    return rects
      .filter(rect => rect.width > 0 && rect.height > 0 && (!clip || (rect.bottom > clip.top && rect.top < clip.bottom && (rect.right ?? Infinity) > clip.left && (rect.left ?? -Infinity) < clip.right)))
      .map(rect => {
        // Existing leading approximation is retained here, isolated from element
        // rules. It is not a complete CSS line-box reconstruction for mixed fonts.
        const leading = Number.isFinite(lineHeight) ? Math.max(0, lineHeight - rect.height) / 2 : 0;
        return { top: collapse(Math.max(rect.top - leading, clip?.top ?? -Infinity) - rootTop), bottom: collapse(Math.min(rect.bottom + leading, clip?.bottom ?? Infinity) - rootTop) };
      });
  };
}

/** Re-measure visible source text for preview/snapshot consistency checks. */
export function measureTextLines(root: HTMLElement): Interval[] {
  assertNoLegacyIgnore(root);
  const measure = createTextMeasurer(root.getBoundingClientRect().top);
  const lines: Interval[] = [];
  walkPrintTree(root, node => {
    if (node.nodeType === TEXT_NODE_TYPE) {
      if (node.textContent?.trim() && (!node.parentElement || isPaintVisible(node.parentElement))) lines.push(...measure(node));
      return 'skip';
    }
    if (node.nodeType === 1 && isDisplaySuppressed(node as Element)) return 'skip';
    return 'descend';
  });
  return lines;
}
