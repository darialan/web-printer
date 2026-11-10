import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentExportOptions, ExportOptions, inspectPrintLayout, outputDocument, PreviewPaginationOptions, PrintInspectionResult } from '../application/print-service';
import { clearPageBreaks, togglePageBreaks, visualizePageBreaks, VisualizePageBreaksOptions } from '../overlay/page-break-overlay';
import { closePrintPreview, previewPrint, PreviewPrintOptions } from '../overlay/print-preview-overlay';

export interface UseWebPrinterProgress { completed: number; total: number; percent: number }
export interface UseWebPrinterState {
  isExporting: boolean;
  isInspecting: boolean;
  progress: UseWebPrinterProgress;
  error: Error | null;
  inspection: PrintInspectionResult | null;
}
export type ExportDocumentParams = Omit<DocumentExportOptions, 'signal' | 'onProgress'>;
export interface ExportPdfParams extends Omit<ExportOptions, 'signal' | 'onProgress'> { showOverlay?: boolean }
export interface InspectLayoutParams extends PreviewPaginationOptions { showOverlay?: boolean }

/** React adapter for all output formats. The core package does not load React. */
export function useWebPrinter() {
  const [state, setState] = useState<UseWebPrinterState>({ isExporting: false, isInspecting: false,
    progress: { completed: 0, total: 0, percent: 0 }, error: null, inspection: null });
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); active.current = null; }; }, []);
  const cancel = useCallback(() => {
    active.current?.abort(); active.current = null;
    if (mounted.current) setState(prev => ({ ...prev, isExporting: false, isInspecting: false }));
  }, []);
  const exportDocument = useCallback(async (params: ExportDocumentParams) => {
    cancel();
    const controller = new AbortController(); active.current = controller;
    const current = () => mounted.current && active.current === controller;
    setState(prev => ({ ...prev, isExporting: true, error: null, progress: { completed: 0, total: 0, percent: 0 } }));
    try {
      return await outputDocument({ ...params, signal: controller.signal, onProgress: (completed, total) => {
        if (current()) setState(prev => ({ ...prev, progress: { completed, total, percent: total > 0 ? Math.round(completed / total * 100) : 0 } }));
      } });
    } catch (reason) {
      if (current() && !controller.signal.aborted) setState(prev => ({ ...prev, error: reason instanceof Error ? reason : new Error(String(reason)) }));
      throw reason;
    } finally {
      if (current()) { active.current = null; setState(prev => ({ ...prev, isExporting: false })); }
    }
  }, [cancel]);
  const exportPDF = useCallback((params: ExportPdfParams) => {
    const options = { ...params }; delete options.showOverlay;
    return exportDocument({ ...options, format: 'pdf' });
  }, [exportDocument]);
  const inspectLayout = useCallback(async ({ showOverlay, ...params }: InspectLayoutParams) => {
    cancel();
    const controller = new AbortController(); active.current = controller;
    const current = () => mounted.current && active.current === controller;
    setState(prev => ({ ...prev, isInspecting: true, error: null }));
    try {
      const result = await inspectPrintLayout({ ...params, signal: controller.signal });
      if (current()) {
        const target = params.element ?? params.contentElement;
        if (showOverlay && target) {
          visualizePageBreaks(result.pageBreaks, target, undefined, undefined, result.capacity);
        }
        setState(prev => ({ ...prev, inspection: result }));
      }
      return result;
    } catch (reason) {
      if (current() && !controller.signal.aborted) setState(prev => ({ ...prev, error: reason instanceof Error ? reason : new Error(String(reason)) }));
      throw reason;
    } finally {
      if (current()) { active.current = null; setState(prev => ({ ...prev, isInspecting: false })); }
    }
  }, [cancel]);
  const clearVisualOverlay = useCallback(() => { clearPageBreaks(); setState(prev => ({ ...prev, inspection: null })); }, []);
  const openPreview = useCallback((params: PreviewPrintOptions | HTMLElement) => previewPrint(params), []);
  const closePreview = useCallback((container?: HTMLElement) => closePrintPreview(container), []);
  const toggleVisualOverlay = useCallback((params: VisualizePageBreaksOptions | HTMLElement) => togglePageBreaks(params), []);
  return {
    ...state,
    isPrinting: state.isExporting,
    exportDocument,
    exportPDF,
    inspectLayout,
    clearVisualOverlay,
    toggleVisualOverlay,
    openPreview,
    closePreview,
    cancel,
  };
}
