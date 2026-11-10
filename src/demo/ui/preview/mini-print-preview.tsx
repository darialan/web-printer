import React, { useEffect, useRef, useState } from 'react';
import { createPrintPreviewView, PrintPreviewView } from '../../../lib';
import { HtmlPreviewData } from './print-preview-modal';

export interface MiniPrintPreviewProps {
  data: HtmlPreviewData | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
}

/**
 * 纸张预览小窗。UI 与交互（折叠、全屏、缩放、懒加载、焦点管理）全部来自库里的
 * `createPrintPreviewView`，这里只负责把 React 状态同步给它，不再维护第二套预览实现。
 */
export function MiniPrintPreview({ data, loading = false, error, onRetry, onClose }: MiniPrintPreviewProps) {
  const viewRef = useRef<PrintPreviewView | null>(null);
  const [fault, setFault] = useState<Error | null>(null);
  const callbacks = useRef({ onRetry, onClose });
  callbacks.current = { onRetry, onClose };
  const visible = Boolean(data || loading || error);
  const closable = Boolean(onClose);
  const retryable = Boolean(onRetry);

  useEffect(() => {
    if (!visible) return;
    const view = createPrintPreviewView({ closable, onClose: () => callbacks.current.onClose?.() });
    viewRef.current = view;
    return () => {
      view.dispose();
      if (viewRef.current === view) viewRef.current = null;
    };
  }, [visible, closable]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      if (error) view.showError(error, retryable ? () => callbacks.current.onRetry?.() : undefined);
      else if (loading) view.showLoading();
      else if (data) view.showData(data);
    } catch (reason) {
      // 渲染异常交给错误边界，只影响小窗，不影响源页面标注
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
}, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || String(error) };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <MiniPrintPreview data={null} error={this.state.error}
      onRetry={this.props.onRetry} onClose={this.props.onClose} />;
  }
}
