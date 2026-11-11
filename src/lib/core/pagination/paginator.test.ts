import { paginate, validatePageBreaks, resolvePageRange } from './paginator';

test('long blank blocks cover all content, including the tail', () => {
  expect(paginate(2500, 1000, [])).toEqual([
    { start: 0, end: 1000 },
    { start: 1000, end: 2000 },
    { start: 2000, end: 2500 },
  ]);
});

test('moves a crossing row or signature block to the next page', () => {
  expect(paginate(1800, 1000, [{ top: 900, bottom: 1100 }])).toEqual([
    { start: 0, end: 900 },
    { start: 900, end: 1800 },
  ]);
});

test('mixed inline text rectangles retreat until all overlapping lines are safe', () => {
  expect(paginate(1100, 1000, [{ top: 990, bottom: 1010 }, { top: 980, bottom: 995 }])[0].end).toBe(980);
});

test('exact boundaries do not create a trailing empty page', () => {
  expect(paginate(2000, 1000, [])).toHaveLength(2);
});

test('rejects oversized atomic blocks, invalid geometry, and page overflow', () => {
  expect(() => paginate(2000, 1000, [{ top: 0, bottom: 1001 }])).toThrow('cannot be split');
  expect(() => paginate(100, 0, [])).toThrow('Invalid');
  expect(() => paginate(3000, 1000, [], 2)).toThrow('maximum limit');
  expect(() => paginate(1500, 1000, [{ top: 0, bottom: 900 }, { top: 800, bottom: 1100 }])).toThrow('Overlapping');
});

test('fine slicing covers more than 100 slices without gaps or duplicate content', () => {
  const pages = paginate(1000.5, 1, [], Number.MAX_SAFE_INTEGER);
  expect(pages).toHaveLength(1001);
  expect(pages[pages.length - 1]).toEqual({ start: 1000, end: 1000.5 });
  pages.slice(1).forEach((page, i) => expect(page.start).toBe(pages[i].end));
});

test('validatePageBreaks tolerates subpixel rounding but throws on real intersections', () => {
  const ranges = [{ top: 100, bottom: 150 }];
  expect(() => validatePageBreaks([{ start: 0, end: 100.04 }, { start: 100.04, end: 200 }], ranges)).not.toThrow();
  expect(() => validatePageBreaks([{ start: 0, end: 107 }, { start: 107, end: 200 }], ranges)).toThrow('intersect protected content');
});

test('seeded fractional layouts preserve content coverage and every protected interval', () => {
  let seed = 104729;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let trial = 0; trial < 300; trial++) {
    const capacity = 80 + random() * 800;
    const ranges: { top: number; bottom: number }[] = [];
    let y = 0;
    for (let i = 0; i < 80; i++) {
      y += random() * 10;
      const bottom = y + random() * capacity * 0.7;
      ranges.push({ top: y, bottom });
      // Mixed inline fragments overlapping the same row.
      ranges.push({ top: y + (bottom - y) * 0.25, bottom });
      y = bottom;
    }
    const height = y + random() * 30;
    const input = ranges.map(range => ({ ...range }));
    const pages = paginate(height, capacity, ranges, 1000);
    expect(pages[0].start).toBe(0);
    expect(pages[pages.length - 1].end).toBe(height);
    pages.forEach((page, index) => {
      expect(page.end).toBeGreaterThan(page.start);
      expect(page.end - page.start).toBeLessThanOrEqual(capacity + 1e-8);
      if (index > 0) expect(page.start).toBe(pages[index - 1].end);
    });
    expect(() => validatePageBreaks(pages, ranges, 0)).not.toThrow();
    expect(ranges).toEqual(input);
  }
});

test('large text documents have bounded work and reject invalid limits', () => {
  const ranges = Array.from({ length: 50000 }, (_, i) => ({ top: i * 2, bottom: i * 2 + 1.5 }));
  expect(paginate(100000, 1000, ranges, 1000)).toHaveLength(100);
  expect(() => paginate(10, 5, [], 1.5)).toThrow('Invalid');
  expect(() => paginate(10, NaN, [])).toThrow('Invalid');
  expect(() => paginate(10, 5, [{ top: 1, bottom: Infinity }])).toThrow('Invalid');
  expect(paginate(10, 5, [{ top: -100, bottom: -20 }, { top: 20, bottom: 30 }])).toHaveLength(2);
});

test('touching ranges leave their common boundary legal while nested protections merge', () => {
  expect(paginate(300, 100, [{top:0,bottom:100},{top:100,bottom:200},{top:200,bottom:300}])).toEqual([
    {start:0,end:100},{start:100,end:200},{start:200,end:300},
  ]);
  expect(paginate(240, 100, [{top:80,bottom:140},{top:90,bottom:110}])[0].end).toBe(80);
  expect(() => paginate(300, 100, [{top:0,bottom:90},{top:89,bottom:180}])).toThrow('Overlapping');
});

test('a padding-only final slice takes the last whole line instead of becoming blank', () => {
  const ranges = [{top:20,bottom:40},{top:1000,bottom:1030}];
  const pages = paginate(1056,1046,ranges);
  expect(pages).toEqual([{start:0,end:1000},{start:1000,end:1056}]);
  expect(() => validatePageBreaks(pages,ranges,0)).not.toThrow();
  // An indivisible block at the origin offers no legal earlier break.
  expect(paginate(1056,1046,[{top:0,bottom:1040}])).toEqual([{start:0,end:1046},{start:1046,end:1056}]);
});

test('resolvePageRange resolves default range from first page to last page', () => {
  const range = resolvePageRange(10);
  expect(range).toEqual({
    startPage: 1,
    endPage: 10,
    count: 10,
    startIndex: 0,
    endIndex: 9,
  });
});

test('resolvePageRange resolves custom startPage and endPage', () => {
  const range = resolvePageRange(10, 3, 7);
  expect(range).toEqual({
    startPage: 3,
    endPage: 7,
    count: 5,
    startIndex: 2,
    endIndex: 6,
  });
});

test('resolvePageRange supports single page selection', () => {
  const range = resolvePageRange(10, 5, 5);
  expect(range).toEqual({
    startPage: 5,
    endPage: 5,
    count: 1,
    startIndex: 4,
    endIndex: 4,
  });
});

test('resolvePageRange clamps endPage when exceeding totalCount', () => {
  const range = resolvePageRange(10, 8, 20);
  expect(range).toEqual({
    startPage: 8,
    endPage: 10,
    count: 3,
    startIndex: 7,
    endIndex: 9,
  });
});

test('resolvePageRange supports only startPage or only endPage', () => {
  expect(resolvePageRange(10, 4)).toEqual({
    startPage: 4,
    endPage: 10,
    count: 7,
    startIndex: 3,
    endIndex: 9,
  });
  expect(resolvePageRange(10, undefined, 4)).toEqual({
    startPage: 1,
    endPage: 4,
    count: 4,
    startIndex: 0,
    endIndex: 3,
  });
});

test('resolvePageRange rejects invalid inputs', () => {
  expect(() => resolvePageRange(0)).toThrow('文档总页数无效');
  expect(() => resolvePageRange(10, 0)).toThrow('大于或等于 1');
  expect(() => resolvePageRange(10, -1)).toThrow('大于或等于 1');
  expect(() => resolvePageRange(10, 1, 0)).toThrow('大于或等于 1');
  expect(() => resolvePageRange(10, 11)).toThrow('超出文档总页数');
  expect(() => resolvePageRange(10, 6, 4)).toThrow('不能大于结尾打印页码');
});
