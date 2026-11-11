import { registerDebugLayer } from '../adapters/dom/debug-layers';
import { walkPrintTree } from '../adapters/dom/traversal';
import { LayoutOptions, resolvePrintElement } from '../application/print-pipeline';
import { inspectPrintLayout, PrintInspectionResult } from '../application/print-service';
import {
  buildPrintRules,
  buildSplittableSelector,
  classifyPrintNode,
  getPrintRules,
  getSplittableSelector,
} from '../core/rules/print-rules';
import { PrintRule } from '../core/types';

export interface ObservabilityStats {
  atomic: number;
  splittable: number;
  excluded: number;
}

export interface VisualizePageBreaksOptions extends Omit<LayoutOptions, 'element'> {
  element?: HTMLElement | null;
  contentElement?: HTMLElement | null;
}

export interface PageBreakVisualizationResult extends Omit<PrintInspectionResult, 'stats'> {
  stats: ObservabilityStats;
  clear: () => void;
}

export type TogglePageBreaksResult =
  | ({ active: true } & PageBreakVisualizationResult)
  | { active: false };

const layers = new Map<HTMLElement, { host: HTMLElement; dispose: () => void }>();

/** Cleanup and query APIs should not throw: handle element directly if iframe is not ready. */
function resolveQuietly(element: HTMLElement): HTMLElement {
  try {
    return resolvePrintElement(element) || element;
  } catch {
    return element;
  }
}

export function hasPageBreaks(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  const layer = layers.get(resolveQuietly(element));
  return Boolean(layer && layer.host.isConnected);
}

export function clearPageBreaks(owner?: Document | HTMLElement) {
  const resolvedOwner =
    owner && owner.nodeType === 1 ? resolveQuietly(owner as HTMLElement) : owner;
  for (const [root, layer] of Array.from(layers)) {
    if (
      !resolvedOwner ||
      resolvedOwner === root ||
      (resolvedOwner.nodeType === 9 && root.ownerDocument === resolvedOwner)
    ) {
      layer.dispose();
      layers.delete(root);
    }
  }
}

export function visualizePageBreaks(
  pages: number[],
  element: HTMLElement,
  rules?: readonly PrintRule[],
  excludedElements?: readonly Element[],
  /** Keeps visualization consistent with measureDocument; defaults to whole-block protection if omitted. */
  capacity?: number,
  splittableSelector?: string
): ObservabilityStats;
export function visualizePageBreaks(
  options: VisualizePageBreaksOptions | HTMLElement
): Promise<PageBreakVisualizationResult>;
export function visualizePageBreaks(
  pagesOrOptions: number[] | VisualizePageBreaksOptions | HTMLElement,
  element?: HTMLElement,
  rules: readonly PrintRule[] = getPrintRules(),
  excludedElements: readonly Element[] = [],
  capacity?: number,
  splittableSelector: string = getSplittableSelector()
): ObservabilityStats | Promise<PageBreakVisualizationResult> {
  if (Array.isArray(pagesOrOptions)) {
    return renderPageBreaksOverlay(
      pagesOrOptions,
      element!,
      rules,
      excludedElements,
      capacity,
      splittableSelector
    );
  }
  return visualizePageBreaksAsync(pagesOrOptions);
}

async function visualizePageBreaksAsync(
  input: VisualizePageBreaksOptions | HTMLElement
): Promise<PageBreakVisualizationResult> {
  const options: VisualizePageBreaksOptions =
    input && typeof input === 'object' && (input as Node).nodeType === 1
      ? { element: input as HTMLElement }
      : (input as VisualizePageBreaksOptions);
  const target = resolvePrintElement(options.element ?? options.contentElement ?? null);
  if (!target) {
    throw new Error('Valid print container not found');
  }
  const inspection = await inspectPrintLayout({ ...options, element: target });
  const resolvedRules =
    options.rules || (options.ruleConfig ? buildPrintRules(options.ruleConfig) : getPrintRules());
  const resolvedSplittable =
    options.splittableSelector ||
    (options.ruleConfig ? buildSplittableSelector(options.ruleConfig) : getSplittableSelector());
  const stats = renderPageBreaksOverlay(
    inspection.pageBreaks,
    target,
    resolvedRules,
    options.excludedElements || [],
    inspection.capacity,
    resolvedSplittable
  );
  return {
    ...inspection,
    stats,
    clear: () => clearPageBreaks(target),
  };
}

/** In-flight toggle tasks: concurrent calls reuse same promise to avoid state desync. */
const pendingToggles = new Map<HTMLElement, Promise<TogglePageBreaksResult>>();

/**
 * Toggle page break visualization: if currently visible, clears overlay and returns `{ active: false }`;
 * otherwise measures layout and renders page breaks overlay.
 */
export async function togglePageBreaks(
  input: VisualizePageBreaksOptions | HTMLElement
): Promise<TogglePageBreaksResult> {
  const options: VisualizePageBreaksOptions =
    input && typeof input === 'object' && (input as Node).nodeType === 1
      ? { element: input as HTMLElement }
      : (input as VisualizePageBreaksOptions);
  const target = resolvePrintElement(options.element ?? options.contentElement ?? null);
  if (!target) {
    throw new Error('Valid print container not found');
  }
  const pending = pendingToggles.get(target);
  if (pending) return pending;
  if (hasPageBreaks(target)) {
    clearPageBreaks(target);
    return { active: false };
  }
  const task: Promise<TogglePageBreaksResult> = visualizePageBreaksAsync({ ...options, element: target })
    .then(result => ({ active: true as const, ...result }))
    .finally(() => pendingToggles.delete(target));
  pendingToggles.set(target, task);
  return task;
}

function renderPageBreaksOverlay(
  pages: number[],
  element: HTMLElement,
  rules: readonly PrintRule[] = getPrintRules(),
  excludedElements: readonly Element[] = [],
  capacity?: number,
  splittableSelector: string = getSplittableSelector()
): ObservabilityStats {
  clearPageBreaks(element);

  const stats: ObservabilityStats = {
    atomic: 0,
    splittable: 0,
    excluded: 0,
  };

  const win = element.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);

  const doc = element.ownerDocument;
  const host = doc.createElement('div');
  host.setAttribute('data-print-debug', 'true');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483643;margin:0;padding:0;border:none;';
  const update = () => {
    const box = element.getBoundingClientRect();
    host.style.left = `${box.left}px`;
    host.style.top = `${box.top}px`;
    host.style.width = `${box.width}px`;
    host.style.height = `${box.height}px`;

    // When the print area is inside a scroll container or beneath a sticky toolbar,
    // dynamically clip debug layer to visible viewport to prevent overlays from bleeding over chrome.
    let visTop = -Infinity;
    let visLeft = -Infinity;
    let visRight = Infinity;
    let visBottom = Infinity;
    let curr: HTMLElement | null = element.parentElement;
    while (curr && curr !== doc.body && curr !== doc.documentElement) {
      const style = win?.getComputedStyle ? win.getComputedStyle(curr) : null;
      if (style) {
        const overflowY = style.overflowY || style.overflow;
        const overflowX = style.overflowX || style.overflow;
        const clipsY = /^(auto|scroll|hidden|clip)$/.test(overflowY);
        const clipsX = /^(auto|scroll|hidden|clip)$/.test(overflowX);
        if (clipsY || clipsX) {
          const rect = curr.getBoundingClientRect();
          if (clipsY) {
            visTop = Math.max(visTop, rect.top);
            visBottom = Math.min(visBottom, rect.bottom);
            const stickies = curr.querySelectorAll<HTMLElement>(
              '.ant-tabs-nav, header, nav, [data-print-sticky]'
            );
            for (let i = 0; i < stickies.length; i++) {
              const sticky = stickies[i];
              if (!sticky.contains(element) && win?.getComputedStyle(sticky).position === 'sticky') {
                const sRect = sticky.getBoundingClientRect();
                if (sRect.height > 0 && sRect.top <= rect.top + 8 && sRect.bottom > visTop) {
                  visTop = sRect.bottom;
                }
              }
            }
          }
          if (clipsX) {
            visLeft = Math.max(visLeft, rect.left);
            visRight = Math.min(visRight, rect.right);
          }
        }
      }
      curr = curr.parentElement;
    }

    if (
      Number.isFinite(visTop) ||
      Number.isFinite(visBottom) ||
      Number.isFinite(visLeft) ||
      Number.isFinite(visRight)
    ) {
      const clipTop = Number.isFinite(visTop) ? Math.max(-12, visTop - box.top) : -12;
      const clipRight = Number.isFinite(visRight) ? Math.max(0, box.right - visRight) : 0;
      const clipBottom = Number.isFinite(visBottom) ? Math.max(0, box.bottom - visBottom) : 0;
      const clipLeft = Number.isFinite(visLeft) ? Math.max(0, visLeft - box.left) : 0;
      host.style.clipPath = `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`;
    } else {
      host.style.clipPath = '';
    }
  };
  update();
  // A body print root also excludes the internal layer by ownership, not by a
  // business-provided data attribute. Snapshot cloning consults this WeakSet.
  registerDebugLayer(host);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
  observer?.observe(element);
  win?.addEventListener('resize', update);
  win?.addEventListener('scroll', update, true);
  const dispose = () => {
    observer?.disconnect();
    win?.removeEventListener('resize', update);
    win?.removeEventListener('scroll', update, true);
    host.remove();
  };
  layers.set(element, { host, dispose });
  doc.body.appendChild(host);

  const rootRect = element.getBoundingClientRect();
  const borderTop = 0;
  const borderLeft = 0;

  // Scan nodes within the print area, classifying with matching measureDocument semantics:
  // Explicit caller exclusions
  // 2. atomic (atomic blocks) - including splittable elements protected as a whole block
  // 3. splittable (flow items)
  // Classification must match measureDocument to avoid visual discrepancies.
  walkPrintTree(element, node => {
    if (node.nodeType !== 1) return 'skip';
    const el = node as HTMLElement;
    if (el.hasAttribute('data-print-debug')) return 'skip';

    const excluded = excludedElements.includes(el);
    const rule = classifyPrintNode(el, rules);

    // Explicit caller exclusions; no classification hides business content.
    if (excluded) {
      stats.excluded++;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        host.appendChild(
          createOverlay({
            left: rect.left - rootRect.left - borderLeft,
            top: rect.top - rootRect.top - borderTop,
            width: rect.width,
            height: rect.height,
            borderColor: '#94a3b8',
            borderStyle: 'dashed',
            backgroundColor: 'rgba(148, 163, 184, 0.08)',
            badgeText: 'excluded',
            badgeBg: '#64748b',
            badgePosition: 'left',
          })
        );
      }
      return 'skip';
    }

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return 'skip';

    // 2. atomic (strictly indivisible: headings, media, cards, registered atomic items)
    // splittable elements matching whole-block preference are visually protected as atomic
    const fitsSplittable = el.matches(splittableSelector) && (capacity === undefined || rect.height <= capacity);
    if (rule?.kind === 'atomic' || (rule?.kind === 'splittable' && fitsSplittable)) {
      stats.atomic++;
      host.appendChild(
        createOverlay({
          left: rect.left - rootRect.left - borderLeft,
          top: rect.top - rootRect.top - borderTop,
          width: rect.width,
          height: rect.height,
          borderColor: '#ef4444',
          borderStyle: 'solid',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          badgeText: 'atomic',
          badgeBg: '#ef4444',
          badgePosition: 'right',
        })
      );
      return 'skip';
    }

    // Inline elements (b / code / math) do not form individual bounding boxes
    if (isInlineBox(el, win)) return 'skip';

    // 3. splittable (flow items with actual body text, allowed to be split across pages)
    const splittable = rule?.kind === 'splittable';
    const ownsFlowingText = hasOwnText(el);
    if (splittable && (el.matches(SPLIT_CONTAINER_SELECTOR) || ownsFlowingText)) {
      stats.splittable++;
      host.appendChild(
        createOverlay({
          left: rect.left - rootRect.left - borderLeft,
          top: rect.top - rootRect.top - borderTop,
          width: rect.width,
          height: rect.height,
          borderColor: '#3b82f6',
          borderStyle: 'dashed',
          backgroundColor: 'rgba(59, 130, 246, 0.04)',
          badgeText: 'splittable',
          badgeBg: '#3b82f6',
          badgePosition: 'right',
        })
      );
      // Descend into splittable elements to mark inner atomic children
      return 'descend';
    }

    // Descend into containers with no direct text (e.g. <p><img></p>) so media gets marked atomic
    return 'descend';
  });

  // Render page-break lines and indicator pills (using high-visibility purple)
  pages.slice(1).forEach((breakY, index) => {
    const lineY = breakY - borderTop;
    const lineContainer = element.ownerDocument.createElement('div');
    lineContainer.setAttribute('data-print-debug', 'true');
    lineContainer.style.cssText = `
      position: absolute;
      left: 0;
      top: ${lineY}px;
      width: 100%;
      height: 0;
      border-top: 2px dashed #7c3aed;
      z-index: ${MARKER_LAYER.line};
      pointer-events: none;
      box-sizing: border-box;
    `;

    const pill = element.ownerDocument.createElement('span');
    pill.textContent = `✂️ page-break: ${Math.round(breakY)}px (p.${index + 1} ➔ p.${index + 2})`;
    pill.style.cssText = `
      position: absolute;
      right: 16px;
      top: -11px;
      background: #7c3aed;
      color: #fff;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      line-height: 1;
      padding: 3px 8px;
      border-radius: 10px;
      font-weight: 600;
      letter-spacing: 0.2px;
      box-shadow: 0 1px 4px rgba(124, 58, 237, 0.35);
      white-space: nowrap;
    `;

    lineContainer.appendChild(pill);
    host.appendChild(lineContainer);
  });

  return stats;
}

const SPLIT_CONTAINER_SELECTOR =
  '[data-print-splittable="true"], .print-splittable, [data-print-break="split"], .print-force-split, [data-pdf-splittable="true"], .pdf-splittable, [data-pdf-break="split"], .pdf-force-split';

/**
 * Overlay layer must remain on top:
 * Print root does not create its own stacking context; high z-index ensures visibility.
 * pointer-events: none and data-print-debug ensure it is omitted during capture.
 */
const MARKER_LAYER = {
  box: 2147483641,
  badge: 2147483642,
  line: 2147483643,
} as const;

/** Inline semantic tags: even when blockified in flex/grid, should not become an isolated splittable box */
const INLINE_TAGS = new Set([
  'SPAN', 'B', 'STRONG', 'EM', 'I', 'CODE', 'A', 'SMALL', 'SUP', 'SUB', 'MARK',
  'ABBR', 'CITE', 'Q', 'TIME', 'U', 'S', 'KBD', 'SAMP', 'VAR', 'BR',
]);

/** Recognizes direct text nodes: wrappers like `<p><img></p>` without text are not splittable flow */
function hasOwnText(el: HTMLElement): boolean {
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 3 && child.textContent?.trim()) return true;
  }
  return false;
}

function isInlineBox(el: HTMLElement, win: Window | null): boolean {
  if (INLINE_TAGS.has(el.tagName)) return true;
  if (!win?.getComputedStyle) return false;
  return win.getComputedStyle(el).display.startsWith('inline');
}

function createOverlay(opts: {
  left: number;
  top: number;
  width: number;
  height: number;
  borderColor: string;
  borderStyle: 'solid' | 'dashed';
  backgroundColor: string;
  badgeText: string;
  badgeBg: string;
  badgePosition?: 'left' | 'right';
}): HTMLElement {
  const box = document.createElement('div');
  box.setAttribute('data-print-debug', 'true');
  box.style.cssText = `
    position: absolute;
    left: ${opts.left}px;
    top: ${opts.top}px;
    width: ${opts.width}px;
    height: ${opts.height}px;
    border: 1.5px ${opts.borderStyle} ${opts.borderColor};
    background: ${opts.backgroundColor};
    box-sizing: border-box;
    z-index: ${MARKER_LAYER.box};
    pointer-events: none;
    border-radius: 2px;
  `;

  const badge = document.createElement('span');
  badge.textContent = opts.badgeText;
  const isRight = opts.badgePosition === 'right';

  // Float on top outer corner (top: -9px) to avoid obscuring first line of text
  const badgeTop = '-9px';
  const badgeSide = isRight ? 'right: 4px;' : 'left: 4px;';

  badge.style.cssText = `
    position: absolute;
    ${badgeSide}
    top: ${badgeTop};
    background: ${opts.badgeBg};
    color: #ffffff;
    font-size: 9px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
    line-height: 1;
    padding: 1.5px 5px;
    border-radius: 3px;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0,0,0,0.18);
    z-index: ${MARKER_LAYER.badge};
    opacity: 0.95;
    letter-spacing: 0.2px;
  `;

  box.appendChild(badge);
  return box;
}
