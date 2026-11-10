import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MiniPreviewBoundary, MiniPrintPreview } from './mini-print-preview';
import { HtmlPreviewData } from './print-preview-modal';

describe('MiniPrintPreview 组件（库预览视图的 React 封装）', () => {
  const mockData: HtmlPreviewData = {
    paperLabel: 'A4',
    pages: [
      { start: 0, end: 500 },
      { start: 500, end: 1000 },
    ],
    geometry: {
      paperWidthPx: 794,
      paperHeightPx: 1123,
      marginTopPx: 38,
      marginRightPx: 38,
      marginBottomPx: 38,
      marginLeftPx: 38,
      printableWidthPx: 718,
      printableHeightPx: 1047,
      headerHeightPx: 0,
      footerHeightPx: 0,
      sourceWidth: 800,
      scale: 0.897,
      pageNumber: { enabled: true, position: 'bottom-right', format: 'slash' },
    },
    sourceHtml: '<div class="content"><p>测试行数据</p></div>',
    totalMs: 15,
    filename: 'test',
  };
  const zoomLabel = () => screen.getByTitle('点击重置为 100% 适应大小');

  test('正确渲染小窗头部、页数标记与迷你切片纸张', () => {
    const onClose = jest.fn();
    render(<MiniPrintPreview data={mockData} onClose={onClose} />);

    expect(screen.getByText('📄 纸张预览')).toBeInTheDocument();
    expect(screen.getByText('2 页')).toBeInTheDocument();
    expect(screen.getByText(/P\.1 \/ 2 · A4/)).toBeInTheDocument();
    expect(screen.getByText(/P\.2 \/ 2 · A4/)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('关闭预览小窗'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('没有 onClose 时不显示关闭按钮', () => {
    render(<MiniPrintPreview data={mockData} />);
    expect(screen.getByTitle('关闭预览小窗')).not.toBeVisible();
  });

  test('卸载时移除小窗，且不触发 onClose', () => {
    const onClose = jest.fn();
    const { unmount } = render(<MiniPrintPreview data={mockData} onClose={onClose} />);
    expect(screen.getByText('📄 纸张预览')).toBeInTheDocument();
    unmount();
    expect(screen.queryByText('📄 纸张预览')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('支持最小化与展开切换', () => {
    render(<MiniPrintPreview data={mockData} />);

    fireEvent.click(screen.getByTitle('折叠小窗'));
    expect(screen.getByText(/P\.1 \/ 2 · A4/)).not.toBeVisible();

    fireEvent.click(screen.getByTitle('展开小窗'));
    expect(screen.getByText(/P\.1 \/ 2 · A4/)).toBeVisible();
  });

  test('支持一键切换全屏预览与退出全屏 (包含 Escape 快捷键)', () => {
    render(<MiniPrintPreview data={mockData} />);

    fireEvent.click(screen.getByTitle('全屏预览'));
    expect(document.querySelector('.wp-preview-widget--fullscreen')).toBeInTheDocument();
    expect(screen.getByTitle('退出全屏 (Esc)')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.wp-preview-widget--fullscreen')).not.toBeInTheDocument();
    expect(screen.getByTitle('全屏预览')).toBeInTheDocument();
  });

  test('缩放控制：放大、缩小、点击百分比重置，并有上下限', () => {
    render(<MiniPrintPreview data={mockData} />);

    expect(zoomLabel()).toHaveTextContent('100%');
    fireEvent.click(screen.getByTitle('放大预览'));
    expect(zoomLabel()).toHaveTextContent('110%');
    fireEvent.click(screen.getByTitle('缩小预览'));
    fireEvent.click(screen.getByTitle('缩小预览'));
    expect(zoomLabel()).toHaveTextContent('90%');

    fireEvent.click(zoomLabel());
    expect(zoomLabel()).toHaveTextContent('100%');

    for (let i = 0; i < 30; i++) fireEvent.click(screen.getByTitle('缩小预览'));
    expect(zoomLabel()).toHaveTextContent('40%');
    expect(screen.getByTitle('缩小预览')).toBeDisabled();
    for (let i = 0; i < 30; i++) fireEvent.click(screen.getByTitle('放大预览'));
    expect(zoomLabel()).toHaveTextContent('250%');
    expect(screen.getByTitle('放大预览')).toBeDisabled();
  });

  test('缩放会改变纸张尺寸', () => {
    render(<MiniPrintPreview data={mockData} />);
    const sheet = () => document.querySelector<HTMLElement>('.wp-preview-page-sheet')!;
    const before = parseFloat(sheet().style.width);
    fireEvent.click(screen.getByTitle('放大预览'));
    expect(parseFloat(sheet().style.width)).toBeGreaterThan(before);
  });

  test('加载与失败状态，失败时可重试', () => {
    const onRetry = jest.fn();
    const { rerender } = render(<MiniPrintPreview data={null} loading />);
    expect(screen.getByText('计算分页中…')).toBeInTheDocument();

    rerender(<MiniPrintPreview data={null} error="快照失败" onRetry={onRetry} />);
    expect(screen.getByText('纸张预览失败：快照失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试预览' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<MiniPrintPreview data={mockData} onRetry={onRetry} />);
    expect(screen.getByText(/P\.1 \/ 2 · A4/)).toBeInTheDocument();
  });

  test('数据异常只交给错误边界，小窗里显示失败并可重试', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onRetry = jest.fn();
    render(
      <MiniPreviewBoundary onRetry={onRetry} onClose={jest.fn()}>
        <MiniPrintPreview data={{ ...mockData, geometry: undefined as any }} />
      </MiniPreviewBoundary>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('纸张预览失败');
    act(() => { fireEvent.click(screen.getByRole('button', { name: '重试预览' })); });
    expect(onRetry).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
