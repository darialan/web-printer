/**
 * Web Printer (@darialan/web-printer)
 * Content-aware client-side pagination of rendered HTML, with PDF and PNG output.
 */

// Core types & definitions
export * from './core/types';

// Core domain logic & pure algorithms
export * from './core/geometry';
export * from './core/pagination';
export * from './core/rules';

// Adapters
export * from './adapters/dom';
export * from './adapters/resources';
export * from './adapters/canvas';
export * from './adapters/pdf';

// Application orchestration & pipeline
export * from './application/cancellation';
export * from './application/print-pipeline';
export * from './application/print-service';
export * from './application/preview-data';

// Visual inspector & preview overlays (Vanilla DOM)
export {
  visualizePageBreaks,
  togglePageBreaks,
  clearPageBreaks,
  hasPageBreaks,
} from './overlay/page-break-overlay';
export type {
  ObservabilityStats,
  VisualizePageBreaksOptions,
  PageBreakVisualizationResult,
  TogglePageBreaksResult,
} from './overlay/page-break-overlay';

export {
  previewPrint,
  closePrintPreview,
  createPrintPreviewView,
} from './overlay/print-preview-overlay';
export type {
  PreviewPrintOptions,
  PrintPreviewController,
  PrintPreviewView,
  PrintPreviewViewOptions,
} from './overlay/print-preview-overlay';

// Format-specific output writers and their extension contract.
export * from './output';

export * from './application/print-session';
