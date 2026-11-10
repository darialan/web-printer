import { registerDebugLayer } from '../adapters/dom/debug-layers';
import { namespacePreviewHtml } from '../adapters/dom/snapshot';
import {
  buildHtmlPreviewData,
  BuildHtmlPreviewOptions,
  HtmlPreviewData,
} from '../application/preview-data';

export interface PreviewPrintOptions extends BuildHtmlPreviewOptions {
  /**
   * 预览展示模式：
   * - 'floating'（默认）：右下角暗色悬浮小窗，支持折叠、全屏切换、缩放控制与滚动懒加载
   * - 'fullscreen'：直接以全屏模态框打开预览
   * - 'inline'：挂载到指定的 container 容器内（传入 container 时默认生效）
   */
  mode?: 'floating' | 'fullscreen' | 'inline';
  /** 可选：将预览渲染到指定 DOM 容器内；不传则默认挂载到 document.body 右下角浮窗 */
  container?: HTMLElement | null;
  /** 初始缩放比例（默认 1，即 100% 适应窗口宽度） */
  zoom?: number;
  /** 关闭预览时的回调 */
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

/** 预览视图的展示选项；不包含数据获取，供 React / Vue 等框架自己驱动数据。 */
export interface PrintPreviewViewOptions {
  mode?: 'floating' | 'fullscreen' | 'inline';
  container?: HTMLElement | null;
  zoom?: number;
  /** 通过关闭按钮或 closePrintPreview() 关闭时触发；dispose() 不触发 */
  onClose?: () => void;
  /** 是否显示关闭按钮，默认显示 */
  closable?: boolean;
  /** 视图被销毁（close 或 dispose）时触发，用于释放调用方的资源 */
  onDispose?: () => void;
  document?: Document;
}

/** 只负责渲染的预览视图：数据由调用方提供。previewPrint 与 playground 共用同一份实现。 */
export interface PrintPreviewView {
  element: HTMLElement;
  showLoading: () => void;
  showError: (message: string, onRetry?: () => void) => void;
  showData: (data: HtmlPreviewData) => void;
  setZoom: (zoom: number | 'fit') => void;
  setFullscreen: (fullscreen: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  /** 关闭并触发 onClose */
  close: () => void;
  /** 静默销毁，不触发 onClose */
  dispose: () => void;
}

interface ActivePreviewInstance {
  host: HTMLElement;
  close: () => void;
}

const activePreviews = new Map<HTMLElement, ActivePreviewInstance>();
let instanceCounter = 0;

/** 关闭并移除页面上的纸张预览小窗，会触发各自的 onClose（不传参数时关闭所有活动的预览窗） */
export function closePrintPreview(container?: HTMLElement) {
  for (const [key, instance] of Array.from(activePreviews)) {
    if (!container || key === container) instance.close();
  }
}

/** 创建一个只负责渲染的纸张预览视图，并挂载到 container（默认 document.body 右下角浮窗）。 */
export function createPrintPreviewView(options: PrintPreviewViewOptions = {}): PrintPreviewView {
  const ownerDoc =
    options.document ||
    options.container?.ownerDocument ||
    (typeof document !== 'undefined' ? document : null);
  if (!ownerDoc || !ownerDoc.body) {
    throw new Error('找不到有效的文档容器');
  }

  ensurePreviewStyles(ownerDoc);

  const mountTarget = options.container || ownerDoc.body;
  const isInline = Boolean(options.container) || options.mode === 'inline';

  // 关闭同一挂载容器上已有的预览实例，避免重复点击产生多个浮窗
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

  // 根包裹层（带 data-print-debug 并在 debug-layers 注册，保证预览窗打开时导出/检查不会把预览窗当成业务内容）
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
  widget.setAttribute('aria-label', '纸张预览');
  widget.setAttribute('aria-busy', 'true');
  host.appendChild(widget);

  // Header
  const header = ownerDoc.createElement('div');
  header.className = 'wp-preview-header';
  widget.appendChild(header);

  const titleWrap = ownerDoc.createElement('div');
  titleWrap.className = 'wp-preview-title-wrap';
  const titleText = ownerDoc.createElement('span');
  titleText.textContent = '📄 纸张预览';
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

  // 缩放控制组
  const zoomGroup = ownerDoc.createElement('div');
  zoomGroup.className = 'wp-preview-zoom-group';

  const zoomOutBtn = createIconButton(ownerDoc, '缩小预览', '－', () => {
    setZoom(Number((zoomMultiplier - 0.1).toFixed(2)));
  });
  const zoomText = ownerDoc.createElement('button');
  zoomText.type = 'button';
  zoomText.className = 'wp-preview-zoom-label';
  zoomText.title = '点击重置为 100% 适应大小';
  zoomText.setAttribute('aria-label', '重置缩放');
  zoomText.textContent = `${Math.round(zoomMultiplier * 100)}%`;
  zoomText.addEventListener('click', () => setZoom('fit'));

  const zoomInBtn = createIconButton(ownerDoc, '放大预览', '＋', () => {
    setZoom(Number((zoomMultiplier + 0.1).toFixed(2)));
  });

  zoomGroup.append(zoomOutBtn, zoomText, zoomInBtn);
  actions.appendChild(zoomGroup);

  // 最小化按钮（仅浮窗模式展示）
  const minimizeBtn = createIconButton(ownerDoc, '折叠小窗', getMinusSvg(), () => {
    if (fullscreen) fullscreen = false;
    setMinimized(!minimized);
  });
  if (isInline) {
    minimizeBtn.style.display = 'none';
  }
  actions.appendChild(minimizeBtn);

  // 全屏按钮
  const fullscreenBtn = createIconButton(
    ownerDoc,
    fullscreen ? '退出全屏 (Esc)' : '全屏预览',
    fullscreen ? getFullscreenExitSvg() : getFullscreenSvg(),
    () => {
      if (minimized) minimized = false;
      setFullscreen(!fullscreen);
    }
  );
  actions.appendChild(fullscreenBtn);

  // 关闭按钮
  const closeBtn = createIconButton(ownerDoc, '关闭预览小窗', getCloseSvg(), () => {
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
    let baseWidth = 232;
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
      widget.style.width = minimized ? '244px' : '348px';
    }

    backdrop.style.display = fullscreen ? 'block' : 'none';
    body.style.display = !minimized || fullscreen ? 'flex' : 'none';
    zoomGroup.style.display = !minimized || fullscreen ? 'inline-flex' : 'none';

    zoomText.textContent = `${Math.round(zoomMultiplier * 100)}%`;
    zoomOutBtn.disabled = zoomMultiplier <= 0.4;
    zoomInBtn.disabled = zoomMultiplier >= 2.5;

    const minLabel = minimized ? '展开小窗' : '折叠小窗';
    minimizeBtn.title = minLabel;
    minimizeBtn.setAttribute('aria-label', minLabel);

    const fsLabel = fullscreen ? '退出全屏 (Esc)' : '全屏预览';
    fullscreenBtn.title = fsLabel;
    fullscreenBtn.setAttribute('aria-label', fsLabel);
    fullscreenBtn.innerHTML = fullscreen ? getFullscreenExitSvg() : getFullscreenSvg();

    sheetControllers.forEach(updateSheet => updateSheet());

    // 全屏是模态对话框：进入时把焦点移入小窗，退出后还给打开前的元素
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
    body.innerHTML = '';
    const loadingBox = ownerDoc!.createElement('div');
    loadingBox.className = 'wp-preview-loading';
    loadingBox.setAttribute('role', 'status');
    const spinner = ownerDoc!.createElement('span');
    spinner.className = 'wp-preview-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const text = ownerDoc!.createElement('span');
    text.style.marginLeft = '8px';
    text.textContent = '计算分页中…';
    loadingBox.append(spinner, text);
    body.appendChild(loadingBox);
  }

  function renderErrorState(message: string, onRetry?: () => void) {
    widget.setAttribute('aria-busy', 'false');
    body.innerHTML = '';
    const alertBox = ownerDoc!.createElement('div');
    alertBox.setAttribute('role', 'alert');
    alertBox.className = 'wp-preview-error';
    const p = ownerDoc!.createElement('p');
    p.textContent = `纸张预览失败：${message}`;
    alertBox.appendChild(p);
    if (onRetry) {
      const retryBtn = ownerDoc!.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'wp-preview-retry-btn';
      retryBtn.textContent = '重试预览';
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
    pageBadge.textContent = `${data.pages.length} 页`;
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
          (fullscreen ? ` · 切片高度 ${Math.round(page.end - page.start)}px` : '');

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

      // 前两页立即渲染，后续页通过 IntersectionObserver 提前 600px 懒挂载预加载
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
      // 全屏是模态对话框：焦点只能在小窗内循环
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

  /** 静默销毁：不触发 onClose。 */
  const dispose = () => {
    if (closed) return;
    closed = true;
    win?.removeEventListener('resize', handleResize);
    win?.removeEventListener('keydown', handleKeyDown);
    clearPageObservers();
    host.remove();
    if (wasFullscreen) restoreFocus?.focus?.();
    // 只清理自己的登记：同一容器上可能已经打开了新的预览实例
    if (activePreviews.get(mountTarget)?.host === host) activePreviews.delete(mountTarget);
    options.onDispose?.();
  };

  /** 关闭预览并触发 onClose（关闭按钮与 closePrintPreview() 走同一条路径）。 */
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
 * 一键生成并展示逐页纸张预览（默认挂载右下角暗色悬浮小窗，支持折叠、全屏、缩放控制与滚动懒加载预渲染）。
 * 纯原生 DOM 实现，自动注入内置样式，无需外部 CSS 或前端框架。
 *
 * 预览被关闭、被新的预览取代或被 signal 中止时返回 `null`（属于正常取消，不抛错）；
 * 真正的加载失败会显示在小窗内并向调用方抛出。
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

  /** 加载被关闭或中止时返回 null：这是正常的取消，不向调用方抛错。 */
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
  if (!doc.head || doc.head.querySelector(`[${PREVIEW_STYLE_ATTR}="true"]`)) return;
  const style = doc.createElement('style');
  style.setAttribute(PREVIEW_STYLE_ATTR, 'true');
  style.textContent = `
.wp-preview-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  z-index: 2147483644;
}
.wp-preview-widget {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 348px;
  background: #0f172a;
  border-radius: 10px;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.12);
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
  height: 38px;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  user-select: none;
  flex-shrink: 0;
}
.wp-preview-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.wp-preview-badge {
  background: #9fcbb3;
  color: #0f172a;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  line-height: 16px;
}
.wp-preview-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.wp-preview-zoom-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 5px;
  padding: 1px 2px;
  margin-right: 2px;
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
  height: 380px;
  background: #334155;
  overflow-y: auto;
  overflow-x: auto;
  padding: 12px 10px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
}
.wp-preview-widget.wp-preview-widget--fullscreen .wp-preview-body {
  height: calc(100% - 38px);
  padding: 28px 20px 60px;
  background: #1e293b;
  gap: 24px;
}
.wp-preview-sheet-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.wp-preview-sheet-label {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #cbd5e1;
  margin-bottom: 6px;
  font-weight: 500;
  align-self: flex-start;
  padding-left: 4px;
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
