import { measureDocument } from '../adapters/dom/measurement';
import { createPrintSnapshot, SnapshotNodeTransform } from '../adapters/dom/snapshot';
import { waitForResources } from '../adapters/resources/resource-loader';
import { calculateGeometry, PageGeometry } from '../core/geometry/page-geometry';
import { DEFAULT_SETTINGS, resolvePaper } from '../core/geometry/paper';
import { paginate } from '../core/pagination/paginator';
import { buildSplittableSelector, buildPrintRules, getSplittableSelector, getPrintRules } from '../core/rules/print-rules';
import {
  DeclarativeHeaderFooterConfig,
  MeasurementStats,
  Orientation,
  PageSlice,
  PrintRule,
  PrintRuleConfig,
  PrintSettings,
} from '../core/types';
import { assertNoLegacyIgnore } from '../adapters/dom/visibility';
import { assertSupportedRules } from '../core/rules/print-rules';
import { checkCancelled } from './cancellation';

export type { Orientation } from '../core/types';

export function createDeclarativeElement(
  config: DeclarativeHeaderFooterConfig,
  type: 'header' | 'footer',
  width: number
): HTMLElement {
  const el = document.createElement('div');
  el.className = `print-declarative-${type}`;
  el.style.width = `${width}px`;
  el.style.boxSizing = 'border-box';
  el.style.padding = type === 'header' ? '8px 0 6px 0' : '6px 0 8px 0';
  el.style.textAlign = config.align || 'center';
  el.style.fontSize = type === 'header' ? '12px' : '11px';
  el.style.color = type === 'header' ? '#334155' : '#64748b';
  el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  el.style.lineHeight = '1.4';
  if (config.showDivider) {
    if (type === 'header') {
      el.style.borderBottom = '1px solid #cbd5e1';
    } else {
      el.style.borderTop = '1px solid #cbd5e1';
    }
  }
  el.textContent = config.text || '';
  return el;
}

export interface PaginationPipelineOptions {
  root: HTMLElement;
  capacity: number;
  maxPages: number;
  rules?: readonly PrintRule[];
  ruleConfig?: PrintRuleConfig;
  /** Splittable policy selector independent of rules; inferred from ruleConfig if omitted, otherwise global default. */
  splittableSelector?: string;
}

export interface LayoutOptions {
  /** Adjust only the detached copy, before measuring it. Source DOM stays untouched. */
  transformSnapshotNode?: SnapshotNodeTransform;
  /** Source resources replaced by transformSnapshotNode; decode the replacement in the snapshot instead. */
  resourceExcludedElements?: readonly Element[];
  /** Omit selected source elements from snapshots without mutating the live page. */
  excludedElements?: readonly Element[];
  element: HTMLElement | null;
  header?: HTMLElement | null;
  footer?: HTMLElement | null;
  orientation?: Orientation;
  settings?: Partial<PrintSettings>;
  signal?: AbortSignal;
  maxPages?: number;
  rules?: readonly PrintRule[];
  ruleConfig?: PrintRuleConfig;
  /** Splittable policy selector independent of rules; inferred from ruleConfig if omitted, otherwise global default. */
  splittableSelector?: string;
}

export interface PreparedLayout extends PageGeometry {
  root: HTMLElement;
  header?: HTMLElement;
  footer?: HTMLElement;
  width: number;
  pages: PageSlice[];
  stats?: MeasurementStats;
  timing: {
    measurementMs: number;
    paginationMs: number;
  };
  cleanup: () => void;
}

const activeRoots = new WeakSet<HTMLElement>();

/** DOM measurement adapter → measured intervals → pure core paginator. */
export function planDocument({ root, capacity, maxPages, rules, ruleConfig, splittableSelector }: PaginationPipelineOptions) {
  const started = performance.now();
  const resolvedRules = rules || (ruleConfig ? buildPrintRules(ruleConfig) : getPrintRules());
  const resolvedSplittable = splittableSelector || (ruleConfig ? buildSplittableSelector(ruleConfig) : getSplittableSelector());
  const measurement = measureDocument(root, capacity, resolvedRules, resolvedSplittable);
  const measured = performance.now();
  const pages = paginate(measurement.height, capacity, measurement.ranges, maxPages);
  return {
    pages,
    stats: measurement.stats,
    timing: {
      measurementMs: measured - started,
      paginationMs: performance.now() - measured,
    },
  };
}

/**
 * Safely verify whether a node is a printable DOM element,
 * including elements from an iframe or different window realm.
 */
export function isPrintableElement(node: unknown): node is HTMLElement {
  if (!node || typeof node !== 'object') return false;
  const el = node as any;
  if (el.nodeType !== 1) return false;
  const win = el.ownerDocument?.defaultView;
  const isElement =
    (win && typeof win.HTMLElement === 'function' && el instanceof win.HTMLElement) ||
    (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) ||
    (typeof el.getBoundingClientRect === 'function' && typeof el.cloneNode === 'function');
  if (!isElement) return false;
  return Boolean(el.isConnected ?? el.ownerDocument?.contains?.(el));
}

/** If an iframe element is passed, automatically resolve its inner document body or main report content */
export function resolvePrintElement(target: unknown): HTMLElement | null {
  if (!isPrintableElement(target)) return null;
  if (target.tagName?.toLowerCase() === 'iframe') {
    const iframe = target as HTMLIFrameElement;
    let doc: Document | null | undefined;
    try {
      doc = iframe.contentDocument || iframe.contentWindow?.document;
    } catch {
      throw new Error('Cannot access cross-origin iframe. Please integrate print tooling directly inside the embedded system or use its export API.');
    }
    if (!doc?.body || doc.readyState === 'loading' || (doc.URL === 'about:blank' && Boolean(iframe.getAttribute('src')))) {
      throw new Error('iframe content is not ready yet. Please wait for loading to complete and try again.');
    }
    const content = (doc.getElementById('iframe-report-content') as HTMLElement) || doc.body;
    if (!isPrintableElement(content) || (!content.childElementCount && !content.textContent?.trim())) {
      throw new Error('No printable business content found inside the iframe.');
    }
    return content;
  }
  return target;
}

/** Pipeline orchestration: snapshot & resource readiness → page geometry → pagination planning. */
export async function prepareLayout(options: LayoutOptions): Promise<PreparedLayout> {
  const { header, footer, signal, orientation = 'portrait' } = options;
  const maxPages = options.maxPages ?? 100;

  const printElement = resolvePrintElement(options.element);
  if (!printElement) {
    throw new Error('Valid print container not found');
  }
  if (!['portrait', 'landscape'].includes(orientation)) {
    throw new Error('Paper orientation must be either portrait or landscape');
  }
  const paper = resolvePaper({ ...DEFAULT_SETTINGS, orientation, ...(options.settings || {}) });
  if (activeRoots.has(printElement)) {
    throw new Error('This region is currently being exported. Please do not submit concurrently.');
  }
  let width = printElement.getBoundingClientRect().width;
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('Print container width is zero. Please ensure content is visible.');
  }
  checkCancelled(signal);
  const rules = options.rules || (options.ruleConfig ? buildPrintRules(options.ruleConfig) : getPrintRules());
  const splittableSelector = options.splittableSelector
    || (options.ruleConfig ? buildSplittableSelector(options.ruleConfig) : getSplittableSelector());
  assertSupportedRules(rules);
  assertNoLegacyIgnore(printElement);
  if (header) assertNoLegacyIgnore(header);
  if (footer) assertNoLegacyIgnore(footer);
  activeRoots.add(printElement);
  let cleaned = false;
  let snapshot: ReturnType<typeof createPrintSnapshot> | undefined;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    snapshot?.dispose();
    activeRoots.delete(printElement);
  };
  try {
    // Readiness must precede style freezing: otherwise an image still loading
    // can have its temporary 0px height frozen permanently into the snapshot.
    await waitForResources(printElement, signal, rules, [...(options.excludedElements || []), ...(options.resourceExcludedElements || [])]);
    for (const extra of [header, footer]) {
      if (extra && isPrintableElement(extra)) await waitForResources(extra, signal, rules);
    }
    width = printElement.getBoundingClientRect().width;
    if (!Number.isFinite(width) || width <= 0) throw new Error('Print container width is zero. Please ensure content is visible.');
    snapshot = createPrintSnapshot(width, rules, options.excludedElements, options.transformSnapshotNode);
    const root = snapshot.clone(printElement);

    let headerClone: HTMLElement | undefined;
    if (header && isPrintableElement(header)) {
      headerClone = snapshot.clone(header);
    } else if (options.settings?.header?.enabled && options.settings.header.text) {
      const declHeader = createDeclarativeElement(options.settings.header, 'header', width);
      headerClone = snapshot.clone(declHeader);
    }

    let footerClone: HTMLElement | undefined;
    if (footer && isPrintableElement(footer)) {
      footerClone = snapshot.clone(footer);
    } else if (options.settings?.footer?.enabled && options.settings.footer.text) {
      const declFooter = createDeclarativeElement(options.settings.footer, 'footer', width);
      footerClone = snapshot.clone(declFooter);
    }

    snapshot.mount();
    await snapshot.ready(signal);

    checkCancelled(signal);
    const pageNumber = options.settings?.pageNumber ?? true;
    const geometry = calculateGeometry(
      paper,
      width,
      headerClone?.getBoundingClientRect().height,
      footerClone?.getBoundingClientRect().height,
      pageNumber
    );
    const { pages, stats, timing } = planDocument({
      root,
      capacity: geometry.capacity,
      maxPages,
      rules,
      splittableSelector,
    });
    return {
      ...geometry,
      root,
      header: headerClone,
      footer: footerClone,
      width,
      pages,
      stats,
      timing,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
