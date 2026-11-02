import html2canvas from 'html2canvas';
import { assertNoLegacyIgnore } from '../dom/visibility';
import { isDebugLayer } from '../dom/debug-layers';

const MAX_PIXELS = 8_000_000;
const MAX_DIMENSION = 8192;
const CAPTURE_TIMEOUT_MS = 30000;
export interface CaptureTiming {
  y: number;
  height: number;
  pixels: number;
  /** Includes DOM cloning and resource readiness up to html2canvas's onclone hook. */
  cloneAndResourcesMs: number;
  /** Parsing, layout and rasterization after that hook. */
  renderMs: number;
  totalMs: number;
}

/** Owns bounded page canvases and each render's cloned iframe. */
export function createPageCapture(width: number, signal?: AbortSignal) {
  const canvases = new Set<HTMLCanvasElement>();
  const timings: CaptureTiming[] = [];
  const cancellers = new Set<() => void>();
  let disposed = false;
  const release = (canvas: HTMLCanvasElement) => {
    canvas.width = 0;
    canvas.height = 0;
    canvases.delete(canvas);
  };
  return {
    timings,
    async capture(element: HTMLElement, y: number, height: number) {
      if (signal?.aborted || disposed) throw new Error('导出已取消');
      assertNoLegacyIgnore(element);
      if (![width, y, height].every(Number.isFinite) || width <= 0 || height <= 0 || y < 0) {
        throw new Error('截图区域尺寸无效');
      }
      // html2canvas floors scaled dimensions. Reserve a pixel of headroom for
      // full-paper composition, which rounds up instead.
      const scale = Math.min(2, Math.sqrt(MAX_PIXELS / (Math.ceil(width) * Math.ceil(height))), MAX_DIMENSION / width, MAX_DIMENSION / height);
      if (!Number.isFinite(scale) || scale < 0.5) throw new Error('页面像素超限，请缩小打印区域宽度');
      let frame: Element | null = null;
      let abandoned = false;
      let cancel = () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      const interrupted = new Promise<never>((_, reject) => {
        cancel = () => { abandoned = true; reject(new Error('导出已取消')); };
        timer = setTimeout(() => { abandoned = true; reject(new Error('单页截图超过 30 秒限制，请减少内容或检查资源')); }, CAPTURE_TIMEOUT_MS);
      });
      cancellers.add(cancel);
      signal?.addEventListener('abort', cancel, { once: true });
      const started = performance.now();
      let cloned = started;
      try {
        const doc = element.ownerDocument;
        const existingFrames = new Set(Array.from(doc.querySelectorAll('iframe.html2canvas-container')));
        const rendering = html2canvas(element, {
          x: 0, y, width, height, scale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          onclone: doc => {
            // html2canvas 1.4.1 removes its iframe only on success. Retain our
            // own frame reference so a CSS parse/render failure also frees it.
            frame = doc.defaultView?.frameElement || null;
            cloned = performance.now();
            if (abandoned || signal?.aborted || disposed) { frame?.remove(); throw new Error('导出已取消'); }
          },
          ignoreElements: node => {
            if (isDebugLayer(node)) return true;
            if (node.tagName === 'HEAD' || node.closest('head')) return false;
            return node !== element && !node.contains(element) && !element.contains(node);
          },
        });
        // In html2canvas 1.4.1 the iframe is appended synchronously, before its
        // first await. Capture that reference before yielding, so failures or
        // cancellation before onclone also clean our own frame. Concurrent calls
        // cannot interleave in this synchronous section.
        frame = Array.from(doc.querySelectorAll('iframe.html2canvas-container')).find(node => !existingFrames.has(node)) || frame;
        rendering.then(canvas => { if (abandoned || disposed || signal?.aborted) release(canvas); }, () => {});
        const canvas = await Promise.race([rendering, interrupted]);
        canvases.add(canvas);
        if (signal?.aborted || disposed) { release(canvas); throw new Error('导出已取消'); }
        if (!canvas.width || !canvas.height) { release(canvas); throw new Error('截图为空，请检查打印区域'); }
        const ended = performance.now();
        timings.push({ y, height, pixels: canvas.width * canvas.height,
          cloneAndResourcesMs: cloned - started, renderMs: ended - cloned, totalMs: ended - started });
        return canvas;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        cancellers.delete(cancel);
        (frame as Element | null)?.remove();
      }
    },
    release,
    dispose: () => { disposed = true; cancellers.forEach(cancel => cancel()); canvases.forEach(release); },
  };
}
