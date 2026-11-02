/** Layout visibility, independent of pagination classification. */
export function elementStyle(element: Element): CSSStyleDeclaration | undefined {
  return element.ownerDocument.defaultView?.getComputedStyle(element);
}

export function isDisplaySuppressed(element: Element): boolean {
  const css = elementStyle(element);
  return css?.display === 'none' || /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(element.tagName);
}

export function isPaintVisible(element: Element): boolean {
  const visibility = elementStyle(element)?.visibility;
  return visibility !== 'hidden' && visibility !== 'collapse';
}

export function clipsAxis(element: Element, axis: 'X' | 'Y'): boolean {
  const css = elementStyle(element);
  const value = css?.getPropertyValue(`overflow-${axis.toLowerCase()}`) || css?.overflow;
  return /^(hidden|clip|auto|scroll|overlay)$/.test(value || '');
}

/** Legacy markers never silently become printable during a major upgrade. */
export function assertNoLegacyIgnore(root: Element): void {
  const selector = '[data-print-ignore], .print-ignore, [data-pdf-ignore], .pdf-ignore';
  if (root.matches(selector) || root.querySelector(selector)) {
    throw new Error('Web Printer 3: 检测到已移除的 ignore 标记（data-print-ignore / .print-ignore / data-pdf-ignore / .pdf-ignore）；请迁移并选择合适的打印根节点');
  }
}
