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

function normalizeSvgElements(doc: Document | null | undefined) {
  if (!doc?.querySelectorAll) return;
  const win = doc.defaultView;
  if (!win) return;
  const svgs = doc.querySelectorAll('svg');
  svgs.forEach(svg => {
    if (svg.parentElement?.closest('svg')) return;
    const parent = svg.parentNode;
    if (!parent) return;

    const cs = win.getComputedStyle(svg);
    const isBlock = cs.display === 'block';
    const ml = parseFloat(cs.marginLeft) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const mt = parseFloat(cs.marginTop) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;

    // html2canvas serializes <svg> into data:image/svg+xml with its computed styles.
    // In an isolated SVG image, any root margin displaces vector graphics out of the
    // image viewport (causing partially cut off or completely blank formulas).
    // Moving external margins to a wrapper element preserves layout while keeping
    // the rasterized SVG coordinates intact at (0, 0).
    if (isBlock || ml > 0 || mr > 0 || mt > 0 || mb > 0) {
      const wrapper = doc.createElement('div');
      if (isBlock && Math.abs(ml - mr) < 2 && ml > 0) {
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = '100%';
        wrapper.style.marginTop = cs.marginTop;
        wrapper.style.marginBottom = cs.marginBottom;
      } else {
        wrapper.style.display = cs.display === 'inline' ? 'inline-block' : cs.display;
        wrapper.style.marginTop = cs.marginTop;
        wrapper.style.marginBottom = cs.marginBottom;
        wrapper.style.marginLeft = cs.marginLeft;
        wrapper.style.marginRight = cs.marginRight;
        wrapper.style.lineHeight = '0';
      }
      parent.insertBefore(wrapper, svg);
      wrapper.appendChild(svg);

      svg.style.setProperty('margin', '0', 'important');
      svg.style.setProperty('margin-top', '0', 'important');
      svg.style.setProperty('margin-bottom', '0', 'important');
      svg.style.setProperty('margin-left', '0', 'important');
      svg.style.setProperty('margin-right', '0', 'important');
      if (isBlock) {
        svg.style.setProperty('display', 'inline-block', 'important');
      }
    }
  });
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
      if (signal?.aborted || disposed) throw new Error('Export was cancelled');
      assertNoLegacyIgnore(element);
      if (![width, y, height].every(Number.isFinite) || width <= 0 || height <= 0 || y < 0) {
        throw new Error('Capture area dimensions are invalid');
      }
      // html2canvas floors scaled dimensions. Reserve a pixel of headroom for
      // full-paper composition, which rounds up instead.
      const scale = Math.min(2, Math.sqrt(MAX_PIXELS / (Math.ceil(width) * Math.ceil(height))), MAX_DIMENSION / width, MAX_DIMENSION / height);
      if (!Number.isFinite(scale) || scale < 0.5) throw new Error('Page pixel dimensions exceed limits, please reduce print area width');
      let frame: Element | null = null;
      let abandoned = false;
      let cancel = () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      const interrupted = new Promise<never>((_, reject) => {
        cancel = () => { abandoned = true; reject(new Error('Export was cancelled')); };
        timer = setTimeout(() => { abandoned = true; reject(new Error('Single-page capture exceeded 30-second timeout, please reduce content or check resources')); }, CAPTURE_TIMEOUT_MS);
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
            if (abandoned || signal?.aborted || disposed) { frame?.remove(); throw new Error('Export was cancelled'); }
            normalizeSvgElements(doc);
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
        if (signal?.aborted || disposed) { release(canvas); throw new Error('Export was cancelled'); }
        if (!canvas.width || !canvas.height) { release(canvas); throw new Error('Captured canvas is empty, please check print area'); }
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
