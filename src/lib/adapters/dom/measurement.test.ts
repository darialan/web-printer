import { BASE_SPLITTABLE_SELECTOR, buildSplittableSelector, classifyPrintNode, DEFAULT_PRINT_RULES } from '../../core/rules/print-rules';
import { paginate, validatePageBreaks } from '../../core/pagination/paginator';
import { measureDocument } from './measurement';
import { walkPrintTree } from './traversal';

const rect = (top: number, height: number) => ({ top, bottom: top + height, height, width: 300 } as DOMRect);
const setRect = (element: Element, top: number, height: number) => {
  element.getBoundingClientRect = () => rect(top, height);
};

test('classification is independent of Ant Design classes and can be extended', () => {
  // tr 不再是节点分类的一部分：默认允许递归，表格行保护交给独立的 splittable 策略
  const row = document.createElement('tr');
  expect(classifyPrintNode(row)).toEqual({ kind: 'splittable' });
  expect(row.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  const ignored = document.createElement('div');
  ignored.setAttribute('data-print-ignore', 'true');
  expect(classifyPrintNode(ignored)).toEqual({ kind: 'splittable' });

  const quote = document.createElement('blockquote');
  expect(
    classifyPrintNode(quote, [
      { selector: 'blockquote', result: { kind: 'atomic', label: '引用' } },
      ...DEFAULT_PRINT_RULES,
    ])
  ).toMatchObject({ kind: 'atomic', label: '引用' });
});

test('depth-first traversal can stop at an atomic subtree without visiting its descendants', () => {
  const root = document.createElement('div');
  root.innerHTML = '<section><img><span>caption</span></section><p>tail</p>';
  const seen: string[] = [];
  walkPrintTree(root, node => {
    seen.push(node.nodeName);
    return node.nodeName === 'SECTION' ? 'skip' : 'descend';
  });
  expect(seen).toEqual(['SECTION', 'P', '#text']);
});

test('collects rows, images and signature groups once, without remeasuring their internal text', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<p style="line-height:16px">outside</p><table><tbody><tr><td>row</td></tr></tbody></table><img alt="凭证"><section data-print-keep-together="true">signature <span>date</span></section>';
  setRect(root, 100, 900);
  setRect(root.querySelector('tr')!, 200, 70);
  setRect(root.querySelector('img')!, 500, 100);
  setRect(root.querySelector('section')!, 650, 100);
  const select = jest.fn();
  const range = jest.spyOn(document, 'createRange').mockReturnValue({
    selectNodeContents: select,
    getClientRects: () => [rect(120, 16)],
  } as unknown as Range);
  try {
    const result = measureDocument(root, 300);
    expect(result.ranges).toEqual([
      { top: 20, bottom: 36 },
      { top: 100, bottom: 170 },
      { top: 400, bottom: 500 },
      { top: 550, bottom: 650 },
    ]);
    expect(select).toHaveBeenCalledTimes(1);
    // tr（splittable，整体放得下）与 section（显式 atomic）与 img（原生 atomic）均整体保护
    expect(result.stats.atomicElements).toBe(3);
  } finally {
    range.mockRestore();
  }
});

test('a configured splittable block is protected when it fits and descends when oversized', () => {
  const root = document.createElement('div');
  root.innerHTML = '<section class="flow"><p>first</p><p>second</p></section>';
  setRect(root, 0, 400);
  setRect(root.querySelector('section')!, 40, 160);
  const paragraphs = Array.from(root.querySelectorAll('p'));
  setRect(paragraphs[0], 50, 20);
  setRect(paragraphs[1], 120, 20);
  const selector = buildSplittableSelector({ splittable: ['.flow'] });
  const range = jest.spyOn(document, 'createRange').mockImplementation(() => {
    let paragraph: Element | null = null;
    return {
      selectNodeContents: (selected: Node) => { paragraph = (selected as Text).parentElement; },
      getClientRects: () => paragraph === paragraphs[0] ? [rect(50, 20)] : [rect(120, 20)],
    } as unknown as Range;
  });
  try {
    expect(measureDocument(root, 200, DEFAULT_PRINT_RULES, selector).ranges).toEqual([
      { top: 40, bottom: 200 },
    ]);
    expect(measureDocument(root, 100, DEFAULT_PRINT_RULES, selector).ranges).toEqual([
      { top: 50, bottom: 70 },
      { top: 120, bottom: 140 },
    ]);
  } finally {
    range.mockRestore();
  }
});

test('an oversized table row descends into its text and still protects nested images', () => {
  const root = document.createElement('div');
  root.innerHTML = '<table><tbody><tr><td style="line-height:20px">long text<img alt="小图"></td></tr></tbody></table>';
  setRect(root, 0, 500);
  setRect(root.querySelector('tr')!, 0, 500);
  setRect(root.querySelector('img')!, 120, 40);
  const range = jest.spyOn(document, 'createRange').mockReturnValue({
    selectNodeContents: jest.fn(),
    getClientRects: () => [rect(0, 20), rect(80, 20)],
  } as unknown as Range);
  try {
    expect(measureDocument(root, 100).ranges).toEqual([
      { top: 0, bottom: 20 },
      { top: 80, bottom: 100 },
      { top: 120, bottom: 160 },
    ]);
  } finally {
    range.mockRestore();
  }
});

test('an oversized explicit atomic group reports the named region instead of silently cutting it', () => {
  const root = document.createElement('div');
  root.innerHTML = '<section data-print-keep-together="true" data-print-label="审批签名与日期">signature</section>';
  setRect(root, 0, 500);
  setRect(root.firstElementChild!, 100, 220);
  expect(() => measureDocument(root, 100)).toThrow('审批签名与日期');
  expect(() => measureDocument(root, 100)).toThrow('220px');
});

test('a table row that does not fit a page descends instead of throwing, unlike strict atomic', () => {
  const root = document.createElement('div');
  root.innerHTML = '<table><tbody><tr><td>cell</td></tr></tbody></table>';
  setRect(root, 0, 500);
  setRect(root.querySelector('tr')!, 0, 220);
  // splittable 永不报错：超高只会递归，不会像 atomic 一样抛错
  expect(() => measureDocument(root, 100)).not.toThrow();
});

test('live measurements retain their DOM coordinate space for visible controls', () => {
  const root = document.createElement('div');
  root.innerHTML = '<div style="margin-bottom:16px">filters</div><table><tbody><tr><td>row</td></tr></tbody></table>';
  setRect(root, 100, 548);
  setRect(root.firstElementChild!, 100, 32);
  setRect(root.querySelector('tr')!, 248, 55);
  const result = measureDocument(root, 300);
  expect(result.height).toBe(548);
  expect(result.ranges).toEqual([{ top: 148, bottom: 203 }]);
});

test('the selected root itself honors atomic and ignore protocols', () => {
  const root = document.createElement('section');
  root.setAttribute('data-print-atomic', 'true');
  setRect(root, 0, 300);
  expect(measureDocument(root, 500).ranges).toEqual([{ top: 0, bottom: 300 }]);
  expect(() => measureDocument(root, 200)).toThrow('exceeds');
  root.setAttribute('data-print-ignore', 'true');
  expect(() => measureDocument(root, 500)).toThrow('Legacy ignore');
});

test('a nested atomic element inside another atomic element is protected once by the outer boundary', () => {
  const root = document.createElement('div');
  root.innerHTML = '<div data-print-atomic="true"><img alt="inner"></div>';
  setRect(root, 0, 500);
  setRect(root.firstElementChild!, 50, 120);
  setRect(root.querySelector('img')!, 60, 80);
  const result = measureDocument(root, 300);
  // 外层 atomic 命中即停止遍历，内部的 img 永远不会被单独测量或计数
  expect(result.ranges).toEqual([{ top: 50, bottom: 170 }]);
  expect(result.stats.atomicElements).toBe(1);
});

test('a display:none subtree skips nested atomic elements and text entirely', () => {
  const root = document.createElement('div');
  root.innerHTML = '<div style="display:none"><img alt="hidden"><p>hidden text</p></div><p>visible text</p>';
  setRect(root, 0, 300);
  setRect(root.querySelector('img')!, 10, 50);
  const range = jest.spyOn(document, 'createRange').mockReturnValue({
    selectNodeContents: jest.fn(),
    getClientRects: () => [rect(120, 16)],
  } as unknown as Range);
  try {
    const result = measureDocument(root, 300);
    expect(result.ranges).toEqual([{ top: 120, bottom: 136 }]);
    expect(result.stats.atomicElements).toBe(0);
  } finally {
    range.mockRestore();
  }
});

test('long text that auto-wraps into multiple visual lines produces one protected interval per line', () => {
  const root = document.createElement('div');
  root.style.lineHeight = '24px';
  root.textContent = 'a long paragraph that wraps across three visual lines in the browser';
  setRect(root, 0, 200);
  const range = jest.spyOn(document, 'createRange').mockReturnValue({
    selectNodeContents: jest.fn(),
    getClientRects: () => [rect(0, 20), rect(24, 20), rect(48, 20)],
  } as unknown as Range);
  try {
    const result = measureDocument(root, 100);
    // leading = max(0, 24-20)/2 = 2，逐行按行高补齐空隙后再各自入区间
    expect(result.ranges).toEqual([
      { top: 0, bottom: 22 },
      { top: 22, bottom: 46 },
      { top: 46, bottom: 70 },
    ]);
    expect(result.stats.textNodes).toBe(1);
    expect(result.stats.textFragments).toBe(3);
  } finally {
    range.mockRestore();
  }
});

test('mixed text, image, table row and a CSS-hidden block resolve independently in one pass', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<p>intro text</p>' +
    '<div style="display:none"><img alt="hidden"></div>' +
    '<img alt="visible">' +
    '<table><tbody><tr><td>cell text</td></tr></tbody></table>';
  setRect(root, 0, 600);
  setRect(root.querySelector('img[alt="visible"]')!, 200, 80);
  setRect(root.querySelector('tr')!, 320, 40);
  const select = jest.fn();
  const range = jest.spyOn(document, 'createRange').mockReturnValue({
    selectNodeContents: select,
    getClientRects: () => [rect(0, 18)],
  } as unknown as Range);
  try {
    const result = measureDocument(root, 300);
    expect(result.ranges).toEqual([
      { top: 0, bottom: 18 },
      { top: 200, bottom: 280 },
      { top: 320, bottom: 360 },
    ]);
    expect(result.stats.atomicElements).toBe(2);
    // 忽略块内的图片、表格单元格内的文本都不应触发任何测量
    expect(select).toHaveBeenCalledTimes(1);
  } finally {
    range.mockRestore();
  }
});

test('two protected elements with overlapping rects are reported independently; merging is the paginator’s job', () => {
  const root = document.createElement('div');
  root.innerHTML = '<img alt="a"><img alt="b">';
  setRect(root, 0, 300);
  const [a, b] = Array.from(root.querySelectorAll('img'));
  setRect(a, 50, 100);
  setRect(b, 120, 100);
  const result = measureDocument(root, 300);
  expect(result.ranges).toEqual([
    { top: 50, bottom: 150 },
    { top: 120, bottom: 220 },
  ]);
});

test('end-to-end: measured ranges feed the real paginator without gaps, overlaps or illegal breaks', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<p>line one</p><img alt="figure"><table><tbody><tr><td>row text</td></tr></tbody></table><p>line two</p>';
  setRect(root, 0, 1000);
  setRect(root.querySelector('img')!, 150, 120);
  setRect(root.querySelector('tr')!, 400, 90);
  let call = 0;
  const positions = [[rect(0, 20)], [rect(650, 20)]];
  const range = jest.spyOn(document, 'createRange').mockReturnValue({
    selectNodeContents: jest.fn(),
    getClientRects: () => positions[call++],
  } as unknown as Range);
  try {
    const measurement = measureDocument(root, 220);
    const pages = paginate(measurement.height, 220, measurement.ranges);
    expect(() => validatePageBreaks(pages, measurement.ranges)).not.toThrow();
    expect(pages[0].start).toBe(0);
    expect(pages[pages.length - 1].end).toBe(measurement.height);
    pages.forEach((page, i) => {
      expect(page.end).toBeGreaterThan(page.start);
      if (i > 0) expect(page.start).toBe(pages[i - 1].end);
    });
  } finally {
    range.mockRestore();
  }
});
