import html2canvas from 'html2canvas';
import { createPageCapture } from './page-capture';

jest.mock('html2canvas', () => jest.fn());

test('each page clones only its snapshot and head resources, excluding source and preview copies', async () => {
  document.head.innerHTML = '<style>p { color: black; }</style>';
  const source = document.createElement('article');
  const preview = document.createElement('aside');
  const host = document.createElement('div');
  host.innerHTML = '<article><p>print content</p><span data-print-debug>marker</span></article>';
  const root = host.firstElementChild as HTMLElement;
  document.body.append(source, preview, host);
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 1000;
  (html2canvas as jest.Mock).mockResolvedValue(canvas);
  const renderer = createPageCapture(800);
  await renderer.capture(root, 0, 1000);
  const { ignoreElements, scale, width, height } = (html2canvas as jest.Mock).mock.calls[0][1];
  expect(ignoreElements(source)).toBe(true);
  expect(ignoreElements(preview)).toBe(true);
  expect(ignoreElements(host)).toBe(false);
  expect(ignoreElements(root)).toBe(false);
  expect(ignoreElements(root.querySelector('p'))).toBe(false);
  expect(ignoreElements(document.head.querySelector('style'))).toBe(false);
  expect(ignoreElements(root.querySelector('[data-print-debug]'))).toBe(false);
  expect(scale * scale * width * height).toBeLessThanOrEqual(8_000_000);
  renderer.dispose();
  expect(canvas.width).toBe(0);
  expect(canvas.height).toBe(0);
  source.remove(); preview.remove(); host.remove();
});

test('disposing while html2canvas is pending also releases the late canvas', async () => {
  let finish: (canvas: HTMLCanvasElement) => void = () => {};
  (html2canvas as jest.Mock).mockReturnValueOnce(new Promise<HTMLCanvasElement>(resolve => { finish=resolve; }));
  const renderer=createPageCapture(800);
  const pending=renderer.capture(document.createElement('article'),0,1000);
  renderer.dispose();
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1000;finish(canvas);
  await expect(pending).rejects.toThrow('取消');expect(canvas.width).toBe(0);expect(canvas.height).toBe(0);
  await expect(renderer.capture(document.createElement('article'),0,1000)).rejects.toThrow('取消');
});

test('invalid geometry and removed legacy markers reject before invoking the renderer', async () => {
  (html2canvas as jest.Mock).mockClear();
  const renderer = createPageCapture(800);
  await expect(renderer.capture(document.createElement('div'), 0, NaN)).rejects.toThrow('无效');
  const root = document.createElement('div'); root.className = 'pdf-ignore';
  await expect(renderer.capture(root, 0, 100)).rejects.toThrow('检测到');
  expect(html2canvas).not.toHaveBeenCalled();
});

test('a rendering failure removes only its own cloned iframe', async () => {
  const own = document.createElement('iframe'), other = document.createElement('iframe');
  document.body.append(own, other);
  (html2canvas as jest.Mock).mockImplementationOnce(async (_root, options) => {
    options.onclone(own.contentDocument);
    throw new Error('unsupported CSS');
  });
  await expect(createPageCapture(800).capture(document.createElement('div'), 0, 100)).rejects.toThrow('unsupported CSS');
  expect(own.isConnected).toBe(false);
  expect(other.isConnected).toBe(true);
  other.remove();
});

test('abort before onclone frees the synchronously owned iframe and releases a late canvas', async () => {
  let finish: (canvas: HTMLCanvasElement) => void = () => {};
  const frame=document.createElement('iframe'); frame.className='html2canvas-container';
  (html2canvas as jest.Mock).mockImplementationOnce(() => {
    document.body.append(frame);
    return new Promise<HTMLCanvasElement>(resolve => { finish=resolve; });
  });
  const controller=new AbortController();
  const pending=createPageCapture(800,controller.signal).capture(document.createElement('div'),0,100);
  controller.abort();
  await expect(pending).rejects.toThrow('取消');
  expect(frame.isConnected).toBe(false);
  const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;finish(canvas);
  await Promise.resolve();
  expect(canvas.width).toBe(0);expect(canvas.height).toBe(0);
});

test('a never-settling renderer times out and releases its pre-onclone frame', async () => {
  jest.useFakeTimers();
  const frame=document.createElement('iframe');frame.className='html2canvas-container';
  (html2canvas as jest.Mock).mockImplementationOnce(() => { document.body.append(frame);return new Promise(()=>{}); });
  const pending=expect(createPageCapture(800).capture(document.createElement('div'),0,100)).rejects.toThrow('30 秒');
  jest.advanceTimersByTime(30000);await pending;
  expect(frame.isConnected).toBe(false);
  jest.useRealTimers();
});
