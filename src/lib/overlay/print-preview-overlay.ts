import { registerDebugLayer } from '../adapters/dom/debug-layers';
import { namespacePreviewHtml } from '../adapters/dom/snapshot';
import {
  buildHtmlPreviewData,
  BuildHtmlPreviewOptions,
  HtmlPreviewData,
} from '../application/preview-data';

export type PreviewLocale = 'en' | 'zh';

export const PREVIEW_I18N = {
  zh: {
    ariaLabel: '纸张预览',
    title: '📄 纸张预览',
    zoomOut: '缩小预览',
    zoomIn: '放大预览',
    zoomResetTitle: '点击重置为 100% 适应大小',
    zoomResetAria: '重置缩放',
    collapse: '折叠小窗',
    expand: '展开小窗',
    fullscreen: '全屏预览',
    exitFullscreen: '退出全屏 (Esc)',
    close: '关闭预览小窗',
    loading: '计算分页中…',
    failed: (msg: string) => `纸张预览失败：${msg}`,
    retry: '重试预览',
    pagesCount: (n: number) => `${n} 页`,
    pageIndex: (i: number, n: number) => `第 ${i} / ${n} 页`,
    sliceHeight: (h: number) => ` · 切片高度 ${h}px`,
  },
  en: {
    ariaLabel: 'Paper Preview',
    title: '📄 Paper Preview',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    zoomResetTitle: 'Click to reset zoom to 100%',
    zoomResetAria: 'Reset zoom',
    collapse: 'Collapse preview',
    expand: 'Expand preview',
    fullscreen: 'Fullscreen preview',
    exitFullscreen: 'Exit fullscreen (Esc)',
    close: 'Close preview window',
    loading: 'Calculating page breaks…',
    failed: (msg: string) => `Preview failed: ${msg}`,
    retry: 'Retry preview',
    pagesCount: (n: number) => `${n} page${n === 1 ? '' : 's'}`,
    pageIndex: (i: number, n: number) => `Page ${i} of ${n}`,
    sliceHeight: (h: number) => ` · Slice height ${h}px`,
  },
};

export interface PreviewPrintOptions extends BuildHtmlPreviewOptions {
  /**
   * Preview display mode:
   * - 'floating' (default): bottom-right floating dark window with minimize/fullscreen/zoom/lazy-load
   * - 'fullscreen': opens directly as fullscreen modal
   * - 'inline': mounts into the specified container element
   */
  mode?: 'floating' | 'fullscreen' | 'inline';
  /** Optional container DOM element; defaults to document.body floating window */
  container?: HTMLElement | null;
  /** Initial zoom ratio (default 1, i.e. 100% fit-to-width) */
  zoom?: number;
  /** Locale language for preview chrome: 'en' or 'zh' (auto-detected if omitted) */
  locale?: PreviewLocale;
  /** Callback when preview is closed */
  onClose?: () => void;
}

export interface PrintPreviewController {
  data: HtmlPreviewData;
  element: HTMLElement;
  setZoom: (zoom: number | 'fit') => void;
  setFullscreen: (fullscreen: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  close: () => void;
}

/** Preview view options (without data fetching, driven by React / Vue / Vanilla). */
export interface PrintPreviewViewOptions {
  mode?: 'floating' | 'fullscreen' | 'inline';
  container?: HTMLElement | null;
  zoom?: number;
  /** Locale language for preview chrome: 'en' or 'zh' (auto-detected if omitted) */
  locale?: PreviewLocale;
  /** Triggered when closed via button or closePrintPreview(); not triggered by dispose() */
  onClose?: () => void;
  /** Whether to show close button, defaults to true */
  closable?: boolean;
  /** Triggered when view is disposed */
  onDispose?: () => void;
  document?: Document;
}

/** Render-only preview view: data is provided by the caller. Shared between previewPrint and playground. */
export interface PrintPreviewView {
  element: HTMLElement;
  showLoading: () => void;
  showError: (message: string, onRetry?: () => void) => void;
  showData: (data: HtmlPreviewData) => void;
  setZoom: (zoom: number | 'fit') => void;
  setFullscreen: (fullscreen: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  /** Close preview and trigger onClose callback. */
  close: () => void;
  /** Silently dispose preview without triggering onClose. */
  dispose: () => void;
}

interface ActivePreviewInstance {
  host: HTMLElement;
  close: () => void;
}

const activePreviews = new Map<HTMLElement, ActivePreviewInstance>();
let instanceCounter = 0;

/** Close and remove paper preview widget(s) on page, triggering their onClose (closes all active previews when container is omitted). */
export function closePrintPreview(container?: HTMLElement) {
  for (const [key, instance] of Array.from(activePreviews)) {
    if (!container || key === container) instance.close();
  }
}

/** Creates a rendering-only print preview view mounted to container (defaults to document.body floating window). */
export function createPrintPreviewView(options: PrintPreviewViewOptions = {}): PrintPreviewView {
  const ownerDoc =
    options.document ||
    options.container?.ownerDocument ||
    (typeof document !== 'undefined' ? document : null);
  if (!ownerDoc || !ownerDoc.body) {
    throw new Error('Valid document container not found');
  }

  const activeLocale: PreviewLocale =
    options.locale || (ownerDoc.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'zh');
  const t = PREVIEW_I18N[activeLocale];

  ensurePreviewStyles(ownerDoc);

  const mountTarget = options.container || ownerDoc.body;
  const isInline = Boolean(options.container) || options.mode === 'inline';

  // Close existing preview instance on same container
  closePrintPreview(mountTarget);

  const instanceId = ++instanceCounter;
  const win = ownerDoc.defaultView || (typeof window !== 'undefined' ? window : null);

  let minimized = false;
  let fullscreen = options.mode === 'fullscreen';
  let wasFullscreen = false;
  let restoreFocus: HTMLElement | null = null;
  let zoomMultiplier = clampZoom(options.zoom ?? 1);
  let viewportWidth = win ? win.innerWidth : 1024;
  let currentData: HtmlPreviewData | null = null;
  let closed = false;
  const observers: Array<{ disconnect: () => void }> = [];
  const sheetControllers: Array<() => void> = [];

  // Root wrapper
  const host = ownerDoc.createElement('div');
  host.setAttribute('data-print-debug', 'true');
  host.setAttribute('data-print-preview-root', 'true');
  registerDebugLayer(host);

  const backdrop = ownerDoc.createElement('div');
  backdrop.className = 'wp-preview-backdrop';
  backdrop.setAttribute('data-print-debug', 'true');
  backdrop.style.display = fullscreen ? 'block' : 'none';
  backdrop.addEventListener('click', () => {
    setFullscreen(false);
  });
  host.appendChild(backdrop);

  const widget = ownerDoc.createElement('div');
  widget.setAttribute('data-print-debug', 'true');
  widget.setAttribute('aria-label', t.ariaLabel);
  widget.setAttribute('aria-busy', 'true');
  host.appendChild(widget);

  // Header
  const header = ownerDoc.createElement('div');
  header.className = 'wp-preview-header';
  widget.appendChild(header);

  const titleWrap = ownerDoc.createElement('div');
  titleWrap.className = 'wp-preview-title-wrap';
  const titleText = ownerDoc.createElement('span');
  titleText.className = 'wp-preview-title-text';
  titleText.style.display = 'none';
  titleText.textContent = t.title;
  titleWrap.appendChild(titleText);

  const pageBadge = ownerDoc.createElement('span');
  pageBadge.className = 'wp-preview-badge';
  pageBadge.style.display = 'none';
  titleWrap.appendChild(pageBadge);
  header.appendChild(titleWrap);

  const actions = ownerDoc.createElement('div');
  actions.className = 'wp-preview-header-actions';
  actions.addEventListener('click', e => e.stopPropagation());
  header.appendChild(actions);

  // Zoom controls
  const zoomGroup = ownerDoc.createElement('div');
  zoomGroup.className = 'wp-preview-zoom-group';
  zoomGroup.style.display = 'none';

  const zoomOutBtn = createIconButton(ownerDoc, t.zoomOut, '－', () => {
    setZoom(Number((zoomMultiplier - 0.1).toFixed(2)));
  });
  const zoomText = ownerDoc.createElement('button');
  zoomText.type = 'button';
  zoomText.className = 'wp-preview-zoom-label';
  zoomText.title = t.zoomResetTitle;
  zoomText.setAttribute('aria-label', t.zoomResetAria);
  zoomText.textContent = `${Math.round(zoomMultiplier * 100)}%`;
  zoomText.addEventListener('click', () => setZoom('fit'));

  const zoomInBtn = createIconButton(ownerDoc, t.zoomIn, '＋', () => {
    setZoom(Number((zoomMultiplier + 0.1).toFixed(2)));
  });

  zoomGroup.append(zoomOutBtn, zoomText, zoomInBtn);
  actions.appendChild(zoomGroup);

  // Minimize button
  const minimizeBtn = createIconButton(ownerDoc, t.collapse, getMinusSvg(), () => {
    if (fullscreen) fullscreen = false;
    setMinimized(!minimized);
  });
  if (isInline) {
    minimizeBtn.style.display = 'none';
  }
  actions.appendChild(minimizeBtn);

  // Fullscreen button
  const fullscreenBtn = createIconButton(
    ownerDoc,
    fullscreen ? t.exitFullscreen : t.fullscreen,
    fullscreen ? getFullscreenExitSvg() : getFullscreenSvg(),
    () => {
      if (minimized) minimized = false;
      setFullscreen(!fullscreen);
    }
  );
  actions.appendChild(fullscreenBtn);

  // Close button
  const closeBtn = createIconButton(ownerDoc, t.close, getCloseSvg(), () => {
    close();
  });
  actions.appendChild(closeBtn);
  if (options.closable === false) closeBtn.style.display = 'none';

  // Body
  const body = ownerDoc.createElement('div');
  body.className = 'wp-preview-body';
  widget.appendChild(body);

  function getEffectiveZoom(): number {
    const paperWidthPx = currentData?.geometry.paperWidthPx || 794;
    let baseWidth = 210;
    if (fullscreen) {
      baseWidth = Math.min(
        860,
        Math.max(200, viewportWidth - 96),
        viewportWidth < 700 ? viewportWidth - 80 : viewportWidth * 0.65
      );
    } else if (isInline) {
      const containerWidth = mountTarget.clientWidth || 680;
      baseWidth = Math.min(794, Math.max(220, containerWidth - 48));
    }
    return (baseWidth / paperWidthPx) * zoomMultiplier;
  }

  function syncWidgetChrome() {
    widget.setAttribute('role', fullscreen ? 'dialog' : 'region');
    if (fullscreen) {
      widget.setAttribute('aria-modal', 'true');
    } else {
      widget.removeAttribute('aria-modal');
    }
    const classes = ['wp-preview-widget'];
    if (fullscreen) classes.push('wp-preview-widget--fullscreen');
    if (isInline && !fullscreen) classes.push('wp-preview-widget--inline');
    widget.className = classes.join(' ');

    if (fullscreen) {
      widget.style.width = 'auto';
    } else if (isInline) {
      widget.style.width = '100%';
    } else {
      widget.style.width = minimized ? '180px' : '260px';
    }

    backdrop.style.display = fullscreen ? 'block' : 'none';
    body.style.display = !minimized || fullscreen ? 'flex' : 'none';
    zoomGroup.style.display = 'none';

    zoomText.textContent = `${Math.round(zoomMultiplier * 100)}%`;
    zoomOutBtn.disabled = zoomMultiplier <= 0.4;
    zoomInBtn.disabled = zoomMultiplier >= 2.5;

    const minLabel = minimized ? t.expand : t.collapse;
    minimizeBtn.title = minLabel;
    minimizeBtn.setAttribute('aria-label', minLabel);

    const fsLabel = fullscreen ? t.exitFullscreen : t.fullscreen;
    fullscreenBtn.title = fsLabel;
    fullscreenBtn.setAttribute('aria-label', fsLabel);
    fullscreenBtn.innerHTML = fullscreen ? getFullscreenExitSvg() : getFullscreenSvg();

    sheetControllers.forEach(updateSheet => updateSheet());

    // Fullscreen is a modal dialog: move focus inside on entry, restore on exit
    if (fullscreen && !wasFullscreen) {
      restoreFocus = ownerDoc!.activeElement as HTMLElement | null;
      widget.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    } else if (!fullscreen && wasFullscreen) {
      restoreFocus?.focus?.();
      restoreFocus = null;
    }
    wasFullscreen = fullscreen;
  }

  function setZoom(next: number | 'fit') {
    zoomMultiplier = next === 'fit' ? 1 : clampZoom(next);
    syncWidgetChrome();
  }

  function setFullscreen(next: boolean) {
    if (next && minimized) minimized = false;
    fullscreen = next;
    syncWidgetChrome();
  }

  function setMinimized(next: boolean) {
    if (next && fullscreen) fullscreen = false;
    minimized = next;
    syncWidgetChrome();
  }

  function renderLoadingState() {
    widget.setAttribute('aria-busy', 'true');
    pageBadge.textContent = '...';
    pageBadge.style.display = 'inline-block';
    body.innerHTML = '';
    const loadingBox = ownerDoc!.createElement('div');
    loadingBox.className = 'wp-preview-loading';
    loadingBox.setAttribute('role', 'status');
    const spinner = ownerDoc!.createElement('span');
    spinner.className = 'wp-preview-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const text = ownerDoc!.createElement('span');
    text.style.marginLeft = '8px';
    text.textContent = t.loading;
    loadingBox.append(spinner, text);
    body.appendChild(loadingBox);
  }

  function renderErrorState(message: string, onRetry?: () => void) {
    widget.setAttribute('aria-busy', 'false');
    pageBadge.textContent = '!';
    pageBadge.style.display = 'inline-block';
    body.innerHTML = '';
    const alertBox = ownerDoc!.createElement('div');
    alertBox.setAttribute('role', 'alert');
    alertBox.className = 'wp-preview-error';
    const p = ownerDoc!.createElement('p');
    p.textContent = t.failed(message);
    alertBox.appendChild(p);
    if (onRetry) {
      const retryBtn = ownerDoc!.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'wp-preview-retry-btn';
      retryBtn.textContent = t.retry;
      retryBtn.addEventListener('click', onRetry);
      alertBox.appendChild(retryBtn);
    }
    body.appendChild(alertBox);
  }

  function clearPageObservers() {
    while (observers.length) {
      observers.pop()?.disconnect();
    }
    sheetControllers.length = 0;
  }

  function renderPages(data: HtmlPreviewData) {
    clearPageObservers();
    currentData = data;
    widget.setAttribute('aria-busy', 'false');
    pageBadge.textContent = t.pagesCount(data.pages.length);
    pageBadge.style.display = 'inline-block';
    body.innerHTML = '';

    const {
      paperWidthPx,
      paperHeightPx,
      marginTopPx,
      marginRightPx,
      marginBottomPx,
      marginLeftPx,
      printableWidthPx,
      headerHeightPx,
      footerHeightPx,
      sourceWidth,
      scale,
      pageNumber,
      bodyTopPx = marginTopPx + headerHeightPx,
      footerTopPx = paperHeightPx - marginBottomPx - footerHeightPx,
      pageNumberYPx = paperHeightPx - marginBottomPx / 2,
    } = data.geometry;

    data.pages.forEach((page, index) => {
      const sheetContainer = ownerDoc!.createElement('div');
      sheetContainer.className = 'wp-preview-sheet-container';

      const label = ownerDoc!.createElement('div');
      label.className = 'wp-preview-sheet-label';
      sheetContainer.appendChild(label);

      const sheet = ownerDoc!.createElement('div');
      sheet.className = 'wp-preview-page-sheet';
      sheetContainer.appendChild(sheet);

      let headerOuter: HTMLDivElement | null = null;
      let headerInner: HTMLDivElement | null = null;
      if (data.headerHtml) {
        headerOuter = ownerDoc!.createElement('div');
        headerOuter.className = 'wp-preview-sheet-header';
        headerOuter.style.position = 'absolute';
        headerInner = ownerDoc!.createElement('div');
        headerInner.style.width = `${sourceWidth}px`;
        headerInner.style.transformOrigin = 'top left';
        headerOuter.appendChild(headerInner);
        sheet.appendChild(headerOuter);
      }

      const viewport = ownerDoc!.createElement('div');
      viewport.className = 'wp-preview-sheet-viewport';
      viewport.style.position = 'absolute';
      sheet.appendChild(viewport);

      const contentBox = ownerDoc!.createElement('div');
      contentBox.className = 'wp-preview-sheet-content';
      contentBox.setAttribute('inert', '');
      contentBox.style.width = `${sourceWidth}px`;
      contentBox.style.transformOrigin = 'top left';

      const placeholder = ownerDoc!.createElement('div');
      placeholder.className = 'wp-preview-sheet-placeholder';
      viewport.appendChild(placeholder);

      let footerOuter: HTMLDivElement | null = null;
      let footerInner: HTMLDivElement | null = null;
      if (data.footerHtml) {
        footerOuter = ownerDoc!.createElement('div');
        footerOuter.className = 'wp-preview-sheet-footer';
        footerOuter.style.position = 'absolute';
        footerInner = ownerDoc!.createElement('div');
        footerInner.style.width = `${sourceWidth}px`;
        footerInner.style.transformOrigin = 'top left';
        footerOuter.appendChild(footerInner);
        sheet.appendChild(footerOuter);
      }

      let pageNumEl: HTMLDivElement | null = null;
      if (pageNumber?.enabled !== false) {
        pageNumEl = ownerDoc!.createElement('div');
        pageNumEl.className = 'wp-preview-sheet-page-num';
        pageNumEl.textContent =
          pageNumber?.format === 'chinese'
            ? `第 ${index + 1} 页 / 共 ${data.pages.length} 页`
            : pageNumber?.format === 'hyphen'
            ? `- ${index + 1} -`
            : `${index + 1} / ${data.pages.length}`;
        sheet.appendChild(pageNumEl);
      }

      let mounted = false;
      const mountPageHtml = () => {
        if (mounted) return;
        mounted = true;
        const nsPrefix = `preview-${instanceId}-p${index}`;
        if (headerInner && data.headerHtml) {
          headerInner.innerHTML = namespacePreviewHtml(data.headerHtml, `${nsPrefix}-header`);
        }
        contentBox.innerHTML = namespacePreviewHtml(data.sourceHtml, `${nsPrefix}-body`);
        if (placeholder.parentNode === viewport) {
          viewport.replaceChild(contentBox, placeholder);
        }
        if (footerInner && data.footerHtml) {
          footerInner.innerHTML = namespacePreviewHtml(data.footerHtml, `${nsPrefix}-footer`);
        }
      };

      const updateSheetLayout = () => {
        const currentZoom = getEffectiveZoom();
        const sliceHeightPx = (page.end - page.start) * scale;
        label.textContent =
          `P.${index + 1} / ${data.pages.length} · ${data.paperLabel}` +
          (fullscreen ? t.sliceHeight(Math.round(page.end - page.start)) : '');

        sheet.style.width = `${paperWidthPx * currentZoom}px`;
        sheet.style.height = `${paperHeightPx * currentZoom}px`;
        sheet.style.padding = `${marginTopPx * currentZoom}px ${marginRightPx * currentZoom}px ${marginBottomPx * currentZoom}px ${marginLeftPx * currentZoom}px`;

        if (headerOuter && headerInner) {
          headerOuter.style.top = `${marginTopPx * currentZoom}px`;
          headerOuter.style.height = `${headerHeightPx * currentZoom}px`;
          headerOuter.style.width = `${printableWidthPx * currentZoom}px`;
          headerInner.style.transform = `scale(${scale * currentZoom})`;
        }

        viewport.style.width = `${printableWidthPx * currentZoom}px`;
        viewport.style.top = `${bodyTopPx * currentZoom}px`;
        viewport.style.height = `${sliceHeightPx * currentZoom}px`;
        viewport.style.maxHeight = `${sliceHeightPx * currentZoom}px`;
        contentBox.style.transform = `scale(${scale * currentZoom}) translateY(-${page.start}px)`;

        if (footerOuter && footerInner) {
          footerOuter.style.top = `${footerTopPx * currentZoom}px`;
          footerOuter.style.height = `${footerHeightPx * currentZoom}px`;
          footerOuter.style.width = `${printableWidthPx * currentZoom}px`;
          footerInner.style.transform = `scale(${scale * currentZoom})`;
        }

        if (pageNumEl) {
          if (pageNumber?.position === 'bottom-center' || pageNumber?.position === 'top-center') {
            pageNumEl.style.left = '50%';
            pageNumEl.style.right = '';
            pageNumEl.style.transform = 'translateX(-50%)';
          } else {
            pageNumEl.style.left = '';
            pageNumEl.style.transform = '';
            pageNumEl.style.right = `${marginRightPx * currentZoom}px`;
          }
          pageNumEl.style.top = `${(pageNumberYPx - 12) * currentZoom}px`;
          pageNumEl.style.fontSize = `${12 * currentZoom}px`;
        }
      };

      sheetControllers.push(updateSheetLayout);
      updateSheetLayout();

      // Render first 2 pages immediately; subsequent pages are lazily mounted 600px ahead via IntersectionObserver.
      if (index < 2 || typeof IntersectionObserver === 'undefined') {
        mountPageHtml();
      } else {
        const io = new IntersectionObserver(
          entries => {
            if (entries.some(entry => entry.isIntersecting)) {
              mountPageHtml();
              io.disconnect();
            }
          },
          { root: body, rootMargin: '600px 0px' }
        );
        io.observe(sheetContainer);
        observers.push(io);
      }

      body.appendChild(sheetContainer);
    });
  }

  const handleResize = () => {
    if (!win) return;
    viewportWidth = win.innerWidth;
    if (fullscreen || isInline) {
      syncWidgetChrome();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!fullscreen) return;
    if (e.key === 'Escape') {
      setFullscreen(false);
      return;
    }
    if (e.key === 'Tab') {
      // Fullscreen modal dialog: trap focus within widget controls.
      const controls = Array.from(
        widget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = ownerDoc!.activeElement;
      const inside = Boolean(active && widget.contains(active));
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  win?.addEventListener('resize', handleResize);
  win?.addEventListener('keydown', handleKeyDown);

  /** Silently dispose: does not trigger onClose. */
  const dispose = () => {
    if (closed) return;
    closed = true;
    win?.removeEventListener('resize', handleResize);
    win?.removeEventListener('keydown', handleKeyDown);
    clearPageObservers();
    host.remove();
    if (wasFullscreen) restoreFocus?.focus?.();
    // Clean up own registration only: a new preview instance might already be mounted on the same container.
    if (activePreviews.get(mountTarget)?.host === host) activePreviews.delete(mountTarget);
    options.onDispose?.();
  };

  /** Close preview and trigger onClose callback (close button and closePrintPreview share this path). */
  const close = () => {
    if (closed) return;
    dispose();
    options.onClose?.();
  };

  activePreviews.set(mountTarget, { host, close });
  mountTarget.appendChild(host);
  syncWidgetChrome();
  renderLoadingState();

  return {
    element: widget,
    showLoading: () => {
      if (!closed) renderLoadingState();
    },
    showError: (message, onRetry) => {
      if (!closed) renderErrorState(message, onRetry);
    },
    showData: data => {
      if (closed) return;
      renderPages(data);
      syncWidgetChrome();
    },
    setZoom,
    setFullscreen,
    setMinimized,
    close,
    dispose,
  };
}

/**
 * One-click generation and display of page-by-page virtual paper preview (mounted as a bottom-right floating widget by default;
 * supports minimize, fullscreen, zoom controls, and scroll lazy loading).
 * Pure native DOM implementation with auto-injected styles; requires no external CSS or UI framework.
 *
 * Returns `null` if the preview is closed, replaced, or aborted via signal (normal cancellation, does not throw);
 * real loading failures are presented in the preview widget and re-thrown to caller.
 */
export async function previewPrint(
  input: PreviewPrintOptions | HTMLElement
): Promise<PrintPreviewController | null> {
  const options: PreviewPrintOptions =
    input && typeof input === 'object' && (input as Node).nodeType === 1
      ? { element: input as HTMLElement }
      : (input as PreviewPrintOptions);

  const sourceEl = options.element ?? options.contentElement ?? null;
  const ownerDoc =
    sourceEl?.ownerDocument ||
    options.container?.ownerDocument ||
    (typeof document !== 'undefined' ? document : undefined);

  const abortController = new AbortController();
  const forwardAbort = () => view.dispose();
  const view = createPrintPreviewView({
    mode: options.mode,
    container: options.container,
    zoom: options.zoom,
    locale: options.locale,
    onClose: options.onClose,
    document: ownerDoc,
    onDispose: () => {
      abortController.abort();
      options.signal?.removeEventListener('abort', forwardAbort);
    },
  });
  options.signal?.addEventListener('abort', forwardAbort, { once: true });
  if (options.signal?.aborted) view.dispose();

  const isCancelled = () => abortController.signal.aborted;

  /** Returns null when loading is closed or aborted: treated as normal cancellation without throwing. */
  const loadData = async (): Promise<HtmlPreviewData | null> => {
    view.showLoading();
    try {
      const data = await buildHtmlPreviewData({ ...options, signal: abortController.signal });
      if (isCancelled()) return null;
      view.showData(data);
      return data;
    } catch (error) {
      if (isCancelled()) return null;
      view.showError(error instanceof Error ? error.message : String(error), () => {
        void loadData().catch(() => {});
      });
      throw error;
    }
  };

  const data = await loadData();
  if (!data) return null;

  return {
    data,
    element: view.element,
    setZoom: view.setZoom,
    setFullscreen: view.setFullscreen,
    setMinimized: view.setMinimized,
    close: view.close,
  };
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(2.5, Math.max(0.4, Number(value.toFixed(2))));
}

function createIconButton(
  doc: Document,
  label: string,
  contentHtmlOrText: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'wp-preview-icon-btn';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  if (contentHtmlOrText.startsWith('<svg')) {
    btn.innerHTML = contentHtmlOrText;
  } else {
    btn.textContent = contentHtmlOrText;
  }
  btn.addEventListener('click', onClick);
  return btn;
}

function getMinusSvg(): string {
  return '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8h10" stroke-linecap="round"/></svg>';
}

function getFullscreenSvg(): string {
  return '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function getFullscreenExitSvg(): string {
  return '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function getCloseSvg(): string {
  return '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke-linecap="round"/></svg>';
}

const PREVIEW_STYLE_ATTR = 'data-print-preview-style';

function ensurePreviewStyles(doc: Document) {
  if (!doc.head) return;
  let style = doc.head.querySelector<HTMLStyleElement>(`[${PREVIEW_STYLE_ATTR}="true"]`);
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute(PREVIEW_STYLE_ATTR, 'true');
    doc.head.appendChild(style);
  }
  style.textContent = `
.wp-preview-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  z-index: 2147483644;
}
.wp-preview-widget {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 260px;
  background: #0f172a;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12);
  z-index: 2147483645;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.wp-preview-widget.wp-preview-widget--inline {
  position: relative;
  right: auto;
  bottom: auto;
  width: 100%;
  z-index: 1;
}
.wp-preview-widget.wp-preview-widget--fullscreen {
  position: fixed;
  top: 20px;
  left: 20px;
  right: 20px;
  bottom: 20px;
  width: auto !important;
  height: auto !important;
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.18);
  z-index: 2147483645;
}
.wp-preview-header {
  height: 34px;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  user-select: none;
  flex-shrink: 0;
}
.wp-preview-title-wrap {
  display: flex;
  align-items: center;
  gap: 0;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.wp-preview-title-text {
  display: none !important;
}
.wp-preview-badge {
  background: #9fcbb3;
  color: #0f172a;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  line-height: 16px;
  letter-spacing: 0.02em;
}
.wp-preview-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.wp-preview-zoom-group {
  display: none !important;
}
.wp-preview-zoom-label {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 0 3px;
  min-width: 38px;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  line-height: 20px;
}
.wp-preview-zoom-label:hover {
  color: #ffffff;
}
.wp-preview-icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}
.wp-preview-icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.wp-preview-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.wp-preview-icon-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
.wp-preview-body {
  height: 320px;
  background: #1e293b;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 6px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.wp-preview-widget.wp-preview-widget--fullscreen .wp-preview-body {
  height: calc(100% - 34px);
  padding: 24px 16px 48px;
  background: #1e293b;
  gap: 20px;
}
.wp-preview-sheet-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.wp-preview-sheet-label {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #94a3b8;
  margin-bottom: 2px;
  font-weight: 500;
  align-self: flex-start;
  padding-left: 2px;
}
.wp-preview-page-sheet {
  background: #ffffff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  border-radius: 2px;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}
.wp-preview-sheet-header,
.wp-preview-sheet-footer {
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  border: 0;
  margin-top: 0;
}
.wp-preview-sheet-viewport {
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  box-sizing: content-box;
}
.wp-preview-sheet-content {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5714285714285714;
  color: rgba(0, 0, 0, 0.88);
}
.wp-preview-sheet-content > * {
  width: 100% !important;
  max-width: none !important;
  box-sizing: border-box !important;
}
.wp-preview-sheet-page-num {
  position: absolute;
  color: #787878;
  font-family: sans-serif;
  font-weight: 400;
  user-select: none;
  line-height: 1;
}
.wp-preview-loading {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 12px;
}
.wp-preview-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(148, 163, 184, 0.35);
  border-top-color: #9fcbb3;
  border-radius: 50%;
  display: inline-block;
  animation: wp-preview-spin 0.75s linear infinite;
}
@keyframes wp-preview-spin {
  to { transform: rotate(360deg); }
}
.wp-preview-sheet-placeholder {
  width: 100%;
  height: 100%;
  background: #f2f2f2;
}
.wp-preview-error {
  color: #f8fafc;
  padding: 12px;
  font-size: 12px;
}
.wp-preview-retry-btn {
  margin-top: 8px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
}
.wp-preview-retry-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
`;
  doc.head.appendChild(style);
}
