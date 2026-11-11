import React, { useEffect, useRef, useState } from 'react';
import { createPrintPreviewView, PrintPreviewView } from '../../../lib';
import { HtmlPreviewData } from './print-preview-modal';
import type { Locale } from '../locale';

export interface MiniPrintPreviewProps {
  data: HtmlPreviewData | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
  locale?: Locale;
}

/**
 * Virtual paper preview floating window. UI and interactions (collapse, fullscreen,
 * zoom, lazy loading, focus management) are provided by library's `createPrintPreviewView`.
 */
export function MiniPrintPreview({ data, loading = false, error, onRetry, onClose, locale }: MiniPrintPreviewProps) {
  const viewRef = useRef<PrintPreviewView | null>(null);
  const [fault, setFault] = useState<Error | null>(null);
  const callbacks = useRef({ onRetry, onClose });
  callbacks.current = { onRetry, onClose };
  const visible = Boolean(data || loading || error);
  const closable = Boolean(onClose);
  const retryable = Boolean(onRetry);

  useEffect(() => {
    if (!visible) return;
    const view = createPrintPreviewView({ closable, onClose: () => callbacks.current.onClose?.(), locale });
    viewRef.current = view;
    return () => {
      view.dispose();
      if (viewRef.current === view) viewRef.current = null;
    };
  }, [visible, closable, locale]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      if (error) view.showError(error, retryable ? () => callbacks.current.onRetry?.() : undefined);
      else if (loading) view.showLoading();
      else if (data) view.showData(data);
    } catch (reason) {
      // Delegate rendering errors to error boundary without affecting source page annotations
      setFault(reason instanceof Error ? reason : new Error(String(reason)));
    }
  }, [data, loading, error, retryable, visible, closable]);

  if (fault) throw fault;
  return null;
}

/** Preview rendering errors must not unmount the source annotations. */
export class MiniPreviewBoundary extends React.Component<{
  children: React.ReactNode;
  onRetry: () => void;
  onClose: () => void;
  locale?: Locale;
}, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || String(error) };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <MiniPrintPreview data={null} error={this.state.error}
      onRetry={this.props.onRetry} onClose={this.props.onClose} locale={this.props.locale} />;
  }
}
