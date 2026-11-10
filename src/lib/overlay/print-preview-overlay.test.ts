import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import * as previewDataModule from '../application/preview-data';
import { HtmlPreviewData } from '../application/preview-data';
import { closePrintPreview, createPrintPreviewView, previewPrint } from './print-preview-overlay';

const mockPreviewData: HtmlPreviewData = {
  paperLabel: 'A4 · 210 × 297 mm',
  pages: [
    { start: 0, end: 400 },
    { start: 400, end: 800 },
    { start: 800, end: 1100 },
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
  sourceHtml: '<div class="preview-doc"><p>测试分页预览内容</p></div>',
  totalMs: 12,
  filename: 'test-doc',
};

describe('previewPrint 原生纸张预览小窗', () => {
  const open = async (options: Parameters<typeof previewPrint>[0]) => (await previewPrint(options))!;

  let targetEl: HTMLDivElement;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    closePrintPreview();
    targetEl = document.createElement('div');
    targetEl.innerHTML = '<p>待打印区域</p>';
    document.body.appendChild(targetEl);
    spy = jest.spyOn(previewDataModule, 'buildHtmlPreviewData').mockResolvedValue(mockPreviewData);
  });

  afterEach(() => {
    closePrintPreview();
    spy.mockRestore();
    targetEl.remove();
  });

  test('默认挂载右下角暗色悬浮预览窗，渲染页数、纸张与页码', async () => {
    const controller = await open({ element: targetEl });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ element: targetEl }));
    expect(controller.data.pages).toHaveLength(3);
    expect(screen.getByText('📄 纸张预览')).toBeInTheDocument();
    expect(screen.getByText('3 页')).toBeInTheDocument();
    expect(screen.getByText(/P\.1 \/ 3 · A4/)).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    controller.close();
    expect(screen.queryByText('📄 纸张预览')).not.toBeInTheDocument();
  });

  test('支持折叠小窗、全屏放大/退出（含 Esc 快捷键）与缩放控制', async () => {
    const controller = await open({ element: targetEl });

    // 1. 缩放控制：默认 100%，点击放大 -> 110%，缩小 -> 100%
    expect(screen.getByTitle('点击重置为 100% 适应大小')).toHaveTextContent('100%');
    fireEvent.click(screen.getByTitle('放大预览'));
    expect(screen.getByTitle('点击重置为 100% 适应大小')).toHaveTextContent('110%');
    fireEvent.click(screen.getByTitle('缩小预览'));
    expect(screen.getByTitle('点击重置为 100% 适应大小')).toHaveTextContent('100%');

    // 编程式缩放与重置
    controller.setZoom(1.3);
    expect(screen.getByTitle('点击重置为 100% 适应大小')).toHaveTextContent('130%');
    fireEvent.click(screen.getByTitle('点击重置为 100% 适应大小'));
    expect(screen.getByTitle('点击重置为 100% 适应大小')).toHaveTextContent('100%');

    // 2. 折叠与展开
    fireEvent.click(screen.getByTitle('折叠小窗'));
    expect(controller.element.querySelector('.wp-preview-body')).toHaveStyle({ display: 'none' });
    fireEvent.click(screen.getByTitle('展开小窗'));
    expect(controller.element.querySelector('.wp-preview-body')).toHaveStyle({ display: 'flex' });

    // 3. 全屏切换与 Escape 退出
    fireEvent.click(screen.getByTitle('全屏预览'));
    expect(controller.element).toHaveClass('wp-preview-widget--fullscreen');
    expect(screen.getByTitle('退出全屏 (Esc)')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(controller.element).not.toHaveClass('wp-preview-widget--fullscreen');
    expect(screen.getByTitle('全屏预览')).toBeInTheDocument();
  });

  test('支持挂载到自定义 container 容器（inline 模式）', async () => {
    const customBox = document.createElement('div');
    document.body.appendChild(customBox);

    const controller = await open({ element: targetEl, container: customBox });
    expect(customBox.contains(controller.element)).toBe(true);
    expect(controller.element).toHaveClass('wp-preview-widget--inline');

    closePrintPreview(customBox);
    expect(customBox.contains(controller.element)).toBe(false);
    customBox.remove();
  });

  test('样式类名带 wp-preview 前缀，不使用通用 mini-* 类名', async () => {
    const controller = await open({ element: targetEl });
    expect(controller.element).toHaveClass('wp-preview-widget');
    expect(document.querySelector('[class*="mini-"]')).toBeNull();
    const css = document.querySelector('style[data-print-preview-style]')?.textContent || '';
    expect(css).not.toMatch(/\.mini-/);
  });

  test('连续打开预览：被取代的一次返回 null 而不是抛错', async () => {
    let resolveFirst!: (data: HtmlPreviewData) => void;
    spy.mockReset();
    spy
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValue(mockPreviewData);

    const first = previewPrint({ element: targetEl });
    const second = await open({ element: targetEl });
    resolveFirst(mockPreviewData);

    await expect(first).resolves.toBeNull();
    expect(second.data.pages).toHaveLength(3);
    expect(document.querySelectorAll('.wp-preview-widget')).toHaveLength(1);
  });

  test('加载中被关闭时返回 null，且不抛未捕获异常', async () => {
    spy.mockReset();
    spy.mockImplementation(({ signal }: any) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('已取消')), { once: true });
    }));

    const pending = previewPrint({ element: targetEl });
    closePrintPreview();
    await expect(pending).resolves.toBeNull();
    expect(document.querySelector('.wp-preview-widget')).toBeNull();
  });

  test('旧实例的 close() 不会影响同一容器上的新实例登记', async () => {
    const old = await open({ element: targetEl });
    const next = await open({ element: targetEl });
    old.close();

    closePrintPreview();
    expect(document.body.contains(next.element)).toBe(false);
  });

  test('真实的加载错误仍会显示在小窗内并向调用方抛出', async () => {
    spy.mockReset();
    spy.mockRejectedValue(new Error('快照失败'));
    await expect(previewPrint({ element: targetEl })).rejects.toThrow('快照失败');
    expect(screen.getByText('纸张预览失败：快照失败')).toBeInTheDocument();
  });

  test('加载失败后点击重试可重新加载', async () => {
    spy.mockReset();
    spy.mockRejectedValueOnce(new Error('快照失败')).mockResolvedValue(mockPreviewData);

    await expect(previewPrint({ element: targetEl })).rejects.toThrow('快照失败');
    fireEvent.click(screen.getByRole('button', { name: '重试预览' }));

    await waitFor(() => expect(screen.getByText(/P\.1 \/ 3 · A4/)).toBeInTheDocument());
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('第 3 页起通过 IntersectionObserver 懒挂载', async () => {
    const callbacks: Array<(entries: any[]) => void> = [];
    const observed: Element[] = [];
    (window as any).IntersectionObserver = class {
      constructor(callback: (entries: any[]) => void) { callbacks.push(callback); }
      observe(element: Element) { observed.push(element); }
      disconnect() {}
    };
    try {
      await open({ element: targetEl });
      const contents = () => document.querySelectorAll('.wp-preview-sheet-content');
      expect(contents()).toHaveLength(2);
      expect(observed).toHaveLength(1);

      act(() => callbacks[0]([{ isIntersecting: false }]));
      expect(contents()).toHaveLength(2);
      act(() => callbacks[0]([{ isIntersecting: true }]));
      expect(contents()).toHaveLength(3);
    } finally {
      delete (window as any).IntersectionObserver;
    }
  });

  test('渲染每页的页眉与页脚', async () => {
    spy.mockResolvedValue({
      ...mockPreviewData,
      headerHtml: '<div>公司页眉</div>',
      footerHtml: '<div>制表人</div>',
      geometry: { ...mockPreviewData.geometry, headerHeightPx: 40, footerHeightPx: 30, bodyTopPx: 80, footerTopPx: 1000 },
    });
    const controller = await open({ element: targetEl });

    expect(screen.getAllByText('公司页眉')).toHaveLength(3);
    expect(screen.getAllByText('制表人')).toHaveLength(3);
    const header = controller.element.querySelector<HTMLElement>('.wp-preview-sheet-header')!;
    expect(parseFloat(header.style.height)).toBeGreaterThan(0);
    const viewport = controller.element.querySelector<HTMLElement>('.wp-preview-sheet-viewport')!;
    expect(parseFloat(viewport.style.top)).toBeGreaterThan(parseFloat(header.style.top));
  });

  test('全屏时焦点移入小窗、Tab 循环，退出后恢复焦点', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    const controller = await open({ element: targetEl });
    opener.focus();

    controller.setFullscreen(true);
    expect(controller.element.contains(document.activeElement)).toBe(true);

    const buttons = Array.from(controller.element.querySelectorAll<HTMLElement>('button:not(:disabled)'));
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    controller.setFullscreen(false);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  test('closePrintPreview 与关闭按钮一样触发 onClose，且每次关闭只触发一次', async () => {
    const onClose = jest.fn();
    await open({ element: targetEl, onClose });
    closePrintPreview();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.wp-preview-widget')).toBeNull();

    const second = await open({ element: targetEl, onClose });
    fireEvent.click(screen.getByTitle('关闭预览小窗'));
    second.close();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('createPrintPreviewView：dispose 静默销毁，不触发 onClose，并通知 onDispose', () => {
    const onClose = jest.fn();
    const onDispose = jest.fn();
    const view = createPrintPreviewView({ onClose, onDispose, closable: false });
    view.showData(mockPreviewData);
    expect(screen.getByText('3 页')).toBeInTheDocument();
    expect(screen.getByTitle('关闭预览小窗')).not.toBeVisible();

    view.dispose();
    view.dispose();
    expect(document.querySelector('.wp-preview-widget')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });
});
