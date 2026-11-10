import { serializePrintSnapshot } from '../adapters/dom/snapshot';
import { calculateGeometry } from '../core/geometry/page-geometry';
import { DEFAULT_SETTINGS, PX_PER_MM, resolvePaper } from '../core/geometry/paper';
import { PageNumberConfig, PageSlice, PrintSettings } from '../core/types';
import { LayoutOptions, prepareLayout } from './print-pipeline';

export interface HtmlPaperGeometry {
  paperWidthPx: number;
  paperHeightPx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  printableWidthPx: number;
  printableHeightPx: number;
  headerHeightPx: number;
  footerHeightPx: number;
  sourceWidth: number;
  scale: number;
  bodyTopPx?: number;
  footerTopPx?: number;
  pageNumberYPx?: number;
  pageNumber?: PageNumberConfig;
}

export interface HtmlPreviewData {
  paperLabel: string;
  pages: PageSlice[];
  geometry: HtmlPaperGeometry;
  sourceHtml: string;
  headerHtml?: string;
  footerHtml?: string;
  totalMs: number;
  filename: string;
}

export interface BuildHtmlPreviewOptions extends Omit<LayoutOptions, 'element'> {
  element?: HTMLElement | null;
  contentElement?: HTMLElement | null;
  filename?: string;
}

/**
 * 极速计算虚拟纸张规范（基于物理标准与 96 DPI CSS 像素精确转换）
 */
export function calculateHtmlPaperGeometry(
  settings: Partial<PrintSettings> | undefined,
  sourceElement: HTMLElement,
  headerElement?: HTMLElement | null,
  footerElement?: HTMLElement | null
): HtmlPaperGeometry {
  const resolvedSettings: PrintSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    pageNumber: settings?.pageNumber ?? DEFAULT_SETTINGS.pageNumber,
  };
  const paper = resolvePaper(resolvedSettings);

  const paperWidthPx = paper.widthMm * PX_PER_MM;
  const paperHeightPx = paper.heightMm * PX_PER_MM;
  const marginTopPx = resolvedSettings.marginTopMm * PX_PER_MM;
  const marginRightPx = resolvedSettings.marginRightMm * PX_PER_MM;
  const marginBottomPx = resolvedSettings.marginBottomMm * PX_PER_MM;
  const marginLeftPx = resolvedSettings.marginLeftMm * PX_PER_MM;

  const printableWidthPx = Math.max(10, paperWidthPx - marginLeftPx - marginRightPx);
  const printableHeightPx = Math.max(10, paperHeightPx - marginTopPx - marginBottomPx);

  const sourceWidth = sourceElement.getBoundingClientRect().width;
  const scale = printableWidthPx / sourceWidth;

  const layout = calculateGeometry(
    paper,
    sourceWidth,
    headerElement?.getBoundingClientRect().height,
    footerElement?.getBoundingClientRect().height,
    resolvedSettings.pageNumber ?? true
  );
  const headerHeightPx = (layout.headerHeight * 4) / 3;
  const footerHeightPx = (layout.footerHeight * 4) / 3;

  return {
    paperWidthPx,
    paperHeightPx,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
    printableWidthPx,
    printableHeightPx,
    headerHeightPx,
    footerHeightPx,
    sourceWidth,
    scale,
    bodyTopPx: (layout.bodyTop * 4) / 3,
    footerTopPx: (layout.footerY * 4) / 3,
    pageNumberYPx: (layout.pageNumberY * 4) / 3,
    pageNumber: resolvedSettings.pageNumber,
  };
}

/** Preview and export use the same frozen DOM, resource readiness, planner and paper geometry. */
export async function buildHtmlPreviewData(
  input: BuildHtmlPreviewOptions | HTMLElement
): Promise<HtmlPreviewData> {
  const options: BuildHtmlPreviewOptions =
    input && typeof input === 'object' && (input as Node).nodeType === 1
      ? { element: input as HTMLElement }
      : (input as BuildHtmlPreviewOptions);
  const {
    element,
    contentElement,
    settings,
    filename = 'document',
    orientation,
    ...rest
  } = options;
  const target = element ?? contentElement ?? null;
  const resolvedSettings: PrintSettings = {
    ...DEFAULT_SETTINGS,
    ...(orientation ? { orientation } : {}),
    ...(settings || {}),
    pageNumber: settings?.pageNumber ?? DEFAULT_SETTINGS.pageNumber,
  };
  const started = performance.now();
  const layout = await prepareLayout({
    ...rest,
    element: target,
    orientation: resolvedSettings.orientation,
    settings: resolvedSettings,
  });
  try {
    const geometry = calculateHtmlPaperGeometry(
      resolvedSettings,
      layout.root,
      layout.header,
      layout.footer
    );
    const paper = resolvePaper(resolvedSettings);
    const factor = resolvedSettings.unit === 'px' ? PX_PER_MM : 1;
    const paperLabel = `${resolvedSettings.paper === 'custom' ? '自定义' : resolvedSettings.paper.toUpperCase()} · ${Number((paper.widthMm * factor).toFixed(1))} × ${Number((paper.heightMm * factor).toFixed(1))} ${resolvedSettings.unit || 'mm'}`;
    return {
      paperLabel,
      pages: layout.pages,
      geometry,
      sourceHtml: serializePrintSnapshot(layout.root),
      headerHtml: layout.header ? serializePrintSnapshot(layout.header) : undefined,
      footerHtml: layout.footer ? serializePrintSnapshot(layout.footer) : undefined,
      totalMs: performance.now() - started,
      filename,
    };
  } finally {
    layout.cleanup();
  }
}
