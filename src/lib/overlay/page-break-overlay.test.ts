import { clearPageBreaks, hasPageBreaks, togglePageBreaks, visualizePageBreaks } from './page-break-overlay';
import * as printService from '../application/print-service';

beforeEach(() => {
  clearPageBreaks();
});

afterEach(() => {
  clearPageBreaks();
});

test('visualizePageBreaks 能够全覆盖标记 atomic 与 splittable 规则', () => {
  const container = document.createElement('div');
  container.innerHTML = `
    <h2 style="width: 200px; height: 30px;">标题文本</h2>
    <table>
      <tbody>
        <tr style="width: 200px; height: 30px;"><td>表格行1</td></tr>
        <tr style="width: 200px; height: 30px;"><td>表格行2</td></tr>
      </tbody>
    </table>
    <p style="width: 200px; height: 40px;">段落说明，可按行自由切分</p>
    
  `;
  document.body.appendChild(container);

  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  Array.from(container.querySelectorAll('*')).forEach((node, i) => {
    (node as HTMLElement).getBoundingClientRect = () => ({
      left: 10,
      top: 10 + i * 40,
      width: 200,
      height: 35,
    } as DOMRect);
  });

  const stats = visualizePageBreaks([0, 150, 300], container);

  expect(stats.atomic).toBe(3);      // 1 个 h2 标题 + 2 个 tr (atomic 不可分割)
  expect(stats.splittable).toBe(1); // p 段落文本流 (splittable 可分割)
  expect(stats.excluded).toBe(0);     // 忽略元素 (ignore 不打印)

  // 页面上存在调试遮罩层
  const debugNodes = document.querySelectorAll('[data-print-debug="true"]');
  expect(debugNodes.length).toBeGreaterThan(0);
  const labels = Array.from(debugNodes).flatMap(node => Array.from(node.querySelectorAll('span')).map(span => span.textContent));
  expect(labels).toEqual(expect.arrayContaining(['atomic', 'splittable']));
  expect(labels.some(label => label?.includes('page-break'))).toBe(true);

  // 清除后完全移除
  clearPageBreaks();
  expect(document.querySelectorAll('[data-print-debug="true"]')).toHaveLength(0);

  container.remove();
});

test('a custom splittable selector overrides the native table-row default and cleanup is scoped', () => {  const first = document.createElement('div');
  const second = document.createElement('div');
  first.innerHTML = '<table><tbody><tr class="can-split"><td>text</td></tr></tbody></table>';
  second.innerHTML = '<h1>other document</h1>';
  document.body.append(first, second);
  for (const root of [first, second]) {
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 100 } as DOMRect);
    root.querySelectorAll('*').forEach(node => { node.getBoundingClientRect = root.getBoundingClientRect; });
  }
  // 空字符串选择器永不匹配，等价于完全关闭 tr 的默认 splittable 保护
  const stats = visualizePageBreaks([0, 50], first, undefined, undefined, undefined, 'never-matches-anything');
  expect(stats.atomic).toBe(0);
  visualizePageBreaks([0], second);
  expect(document.querySelectorAll('body > [data-print-debug]')).toHaveLength(2);
  clearPageBreaks(first);
  expect(first.querySelector('[data-print-debug]')).toBeNull();
  expect(document.querySelectorAll('body > [data-print-debug]')).toHaveLength(1);
  clearPageBreaks(second);
  first.remove(); second.remove();
});

test('媒体包装段落（<p> 里只有一张图）标为 atomic，而不是 splittable', () => {
  const container = document.createElement('div');
  container.innerHTML = `
    <p style="height: 120px;"><img data-print-atomic="true" alt="结果图" style="height: 120px;"></p>
    <p style="height: 40px;">普通段落，可被分页线切断</p>
  `;
  document.body.appendChild(container);
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  Array.from(container.querySelectorAll('*')).forEach(node => {
    (node as HTMLElement).getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 35 } as DOMRect);
  });

  const stats = visualizePageBreaks([0, 200], container);

  // 只保护图片本身；包图片的 p 没有正文，不该被标成可分割正文流
  expect(stats.atomic).toBe(1);
  expect(stats.splittable).toBe(1);

  const badges = Array.from(document.querySelectorAll('[data-print-debug="true"] span'))
    .map(span => span.textContent);
  expect(badges.filter(text => text === 'atomic')).toHaveLength(1);
  expect(badges.filter(text => text === 'splittable')).toHaveLength(1);

  container.remove();
});

test('标记层的 z-index 保持在最顶层（高于任意站点元素）', () => {
  const container = document.createElement('div');
  container.innerHTML = '<p style="height: 40px;">段落</p>';
  document.body.appendChild(container);
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  container.querySelectorAll('*').forEach(node => {
    (node as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 40 } as DOMRect);
  });

  visualizePageBreaks([0, 300], container);

  const debugNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-print-debug="true"]'));
  const layerOf = (node: HTMLElement) => Number(node.style.zIndex || node.querySelector<HTMLElement>('span')?.style.zIndex || 0);
  const top = Math.max(...debugNodes.map(layerOf));
  // 用户明确要求标记在最顶层；max z-index 接近 2^31，所有站点导航都无法盖住标记
  expect(top).toBeGreaterThan(2147483000);

  container.remove();
});

test('explicit exclusions render separate markers without changing source attributes', () => {
  const root=document.createElement('article');const excluded=document.createElement('aside');excluded.textContent='广告';root.append(excluded);document.body.append(root);
  root.getBoundingClientRect=()=>({left:0,top:0,width:400,height:200} as DOMRect);
  excluded.getBoundingClientRect=()=>({left:0,top:20,width:400,height:40} as DOMRect);
  const attrs=excluded.outerHTML;
  const stats=visualizePageBreaks([],root,undefined,[excluded]);
  expect(stats.excluded).toBeGreaterThan(0);expect(document.querySelector('[data-print-debug]')?.textContent).toBe('excluded');expect(excluded.outerHTML).toBe(attrs);clearPageBreaks(root);root.remove();
});

test('debug visualization does not mutate business DOM or remove business debug attributes', () => {
  const root = document.createElement('article');
  root.innerHTML = '<p data-print-debug="business">content</p>';
  document.body.append(root);
  root.getBoundingClientRect = () => ({ left: 20, top: 30, width: 400, height: 200 } as DOMRect);
  const before = root.outerHTML;
  visualizePageBreaks([0, 100], root);
  expect(root.outerHTML).toBe(before);
  clearPageBreaks(root);
  expect(root.outerHTML).toBe(before);
  root.remove();
});

test('visualizePageBreaks({ element }) 支持一行异步测量并绘制分页线，togglePageBreaks 支持一键开关', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<h2 style="width:200px;height:40px;">标题</h2><p style="width:200px;height:60px;">正文内容</p>';
  document.body.appendChild(container);
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  Array.from(container.querySelectorAll('*')).forEach((node, i) => {
    (node as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: i * 50, width: 200, height: 40 } as DOMRect);
  });

  const spy = jest.spyOn(printService, 'inspectPrintLayout').mockResolvedValue({
    pageBreaks: [0, 240],
    pages: [
      { start: 0, end: 240 },
      { start: 240, end: 480 },
    ],
    totalHeight: 480,
    capacity: 300,
    protectedRanges: [],
    timing: { measurementMs: 2, paginationMs: 1, totalMs: 3 },
  });

  const res = await visualizePageBreaks({ element: container });
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ element: container }));
  expect(res.pages).toHaveLength(2);
  expect(res.stats.atomic).toBe(1);
  expect(res.stats.splittable).toBe(1);
  expect(hasPageBreaks(container)).toBe(true);

  // 调用 togglePageBreaks 时检测到已开启，应自动清除并返回 active: false
  const toggledOff = await togglePageBreaks({ element: container });
  expect(toggledOff.active).toBe(false);
  expect(hasPageBreaks(container)).toBe(false);
  expect(document.querySelectorAll('[data-print-debug="true"]')).toHaveLength(0);

  // 再次调用 togglePageBreaks 应重新绘制并返回 active: true
  const toggledOn = await togglePageBreaks(container);
  expect(toggledOn.active).toBe(true);
  expect(hasPageBreaks(container)).toBe(true);

  if (toggledOn.active) {
    toggledOn.clear();
  }
  expect(hasPageBreaks(container)).toBe(false);

  spy.mockRestore();
  container.remove();
});

test('togglePageBreaks 在测量期间重复调用时复用同一次测量，状态保持一致', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<p style="width:200px;height:40px;">正文</p>';
  document.body.appendChild(container);
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  container.querySelectorAll('*').forEach(node => {
    (node as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 40 } as DOMRect);
  });
  let release!: () => void;
  const spy = jest.spyOn(printService, 'inspectPrintLayout').mockImplementation(
    () => new Promise(resolve => {
      release = () => resolve({
        pageBreaks: [0], pages: [{ start: 0, end: 100 }], totalHeight: 100, capacity: 300,
        protectedRanges: [], timing: { measurementMs: 1, paginationMs: 1, totalMs: 2 },
      });
    })
  );

  const first = togglePageBreaks({ element: container });
  const second = togglePageBreaks({ element: container });
  release();
  const [a, b] = await Promise.all([first, second]);

  expect(spy).toHaveBeenCalledTimes(1);
  expect(a.active).toBe(true);
  expect(b.active).toBe(true);
  expect(hasPageBreaks(container)).toBe(true);
  expect((await togglePageBreaks({ element: container })).active).toBe(false);

  spy.mockRestore();
  container.remove();
});

test('hasPageBreaks / clearPageBreaks 遇到尚未就绪的 iframe 不抛错', () => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('src', 'about:blank');
  document.body.appendChild(iframe);

  expect(() => hasPageBreaks(iframe)).not.toThrow();
  expect(hasPageBreaks(iframe)).toBe(false);
  expect(() => clearPageBreaks(iframe)).not.toThrow();
  iframe.remove();
});
