import {
  assertAtomicFits,
  BASE_SPLITTABLE_SELECTOR,
  BASE_PRINT_RULES,
  buildSplittableSelector,
  buildPrintRules,
  classifyPrintNode,
  configurePrint,
  PRINT_CLASSES,
  resetPrintRules,
  resolveSplittable,
} from './print-rules';

afterEach(() => {
  resetPrintRules();
});

test('base layer is tech-agnostic and uses standard protocols and tags only', () => {
  // Native tr belongs to splittable; table rows have whole-block protection strategy
  const tr = document.createElement('tr');
  expect(classifyPrintNode(tr)).toEqual({ kind: 'splittable' });
  expect(tr.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  // Native images and headings are protected
  const img = document.createElement('img');
  expect(classifyPrintNode(img)).toMatchObject({ kind: 'atomic' });

  // Base rules never hardcode third-party component class names; unconfigured component rows remain splittable
  const antRow = document.createElement('div');
  antRow.className = 'ant-table-row';
  expect(classifyPrintNode(antRow)).toEqual({ kind: 'splittable' });

  // Base rules do not contain component library prefixes
  BASE_PRINT_RULES.forEach(rule => {
    expect(rule.selector).not.toContain('ant-');
    expect(rule.selector).not.toContain('el-');
  });
});

test('classifies elements as atomic or splittable and recognizes protocol selectors', () => {
  // 1. Atomic
  const elAtomicAttr = document.createElement('div');
  elAtomicAttr.setAttribute('data-print-atomic', 'true');
  expect(classifyPrintNode(elAtomicAttr)).toMatchObject({ kind: 'atomic' });

  const elAtomicClass = document.createElement('div');
  elAtomicClass.className = PRINT_CLASSES.ATOMIC;
  expect(classifyPrintNode(elAtomicClass)).toMatchObject({ kind: 'atomic' });

  // Compatibility alias: keep-together="true" is equivalent to atomic
  const elKeepAttr = document.createElement('div');
  elKeepAttr.setAttribute('data-print-keep-together', 'true');
  expect(classifyPrintNode(elKeepAttr)).toMatchObject({ kind: 'atomic' });

  // Legacy keep-together="split" matches whole-block protection strategy
  const elSplitAttr = document.createElement('div');
  elSplitAttr.setAttribute('data-print-keep-together', 'split');
  expect(classifyPrintNode(elSplitAttr)).toEqual({ kind: 'splittable' });
  expect(elSplitAttr.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  // splittable attribute is classified as splittable
  const elSplittableAttr = document.createElement('div');
  elSplittableAttr.setAttribute('data-print-splittable', 'true');
  expect(classifyPrintNode(elSplittableAttr)).toEqual({ kind: 'splittable' });
  expect(elSplittableAttr.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  const elSplittableClass = document.createElement('div');
  elSplittableClass.className = PRINT_CLASSES.SPLITTABLE;
  expect(classifyPrintNode(elSplittableClass)).toEqual({ kind: 'splittable' });
  expect(elSplittableClass.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  // force-split no longer affects classification; remains splittable
  const elBreakAttr = document.createElement('div');
  elBreakAttr.setAttribute('data-print-break', 'split');
  expect(classifyPrintNode(elBreakAttr)).toEqual({ kind: 'splittable' });

  // 3. Ignore
  const elIgnoreAttr = document.createElement('div');
  elIgnoreAttr.setAttribute('data-print-ignore', 'true');
  expect(classifyPrintNode(elIgnoreAttr)).toEqual({ kind: 'splittable' });

  const elIgnoreClass = document.createElement('div');
  elIgnoreClass.className = 'print-ignore';
  expect(classifyPrintNode(elIgnoreClass)).toEqual({ kind: 'splittable' });
});

test('consumers register component library classes via configurePrint', () => {
  const antRow = document.createElement('div');
  antRow.className = 'ant-table-row';

  const elRow = document.createElement('div');
  elRow.className = 'el-table__row';

  // Before configuration, allows recursive analysis
  expect(classifyPrintNode(antRow)).toEqual({ kind: 'splittable' });
  expect(classifyPrintNode(elRow)).toEqual({ kind: 'splittable' });

  // Register custom component selectors
  configurePrint({
    atomic: ['.ant-table-row', '.el-table__row', '.my-sign-stamp'],
  });

  // After configuration, rules take effect
  expect(classifyPrintNode(antRow)).toMatchObject({ kind: 'atomic' });
  expect(classifyPrintNode(elRow)).toMatchObject({ kind: 'atomic' });

  const stamp = document.createElement('div');
  stamp.className = 'my-sign-stamp';
  expect(classifyPrintNode(stamp)).toMatchObject({ kind: 'atomic' });

  // Restores base defaults after reset
  resetPrintRules();
  expect(classifyPrintNode(antRow)).toEqual({ kind: 'splittable' });
});

test('buildPrintRules supports creating independent rule lists without polluting global state', () => {
  const localRules = buildPrintRules({
    atomic: ['.isolated-widget'],
  });

  const node = document.createElement('div');
  node.className = 'isolated-widget';

  expect(classifyPrintNode(node, localRules)).toMatchObject({ kind: 'atomic' });
  expect(classifyPrintNode(node)).toEqual({ kind: 'splittable' });
});

test('assertAtomicFits throws on overflow, resolveSplittable allows recursive descent', () => {
  const strict = classifyPrintNode(
    Object.assign(document.createElement('div'), { className: 'group' }),
    buildPrintRules({ atomic: ['.group'] })
  );
  expect(strict).toMatchObject({ kind: 'atomic' });
  expect(() => assertAtomicFits(strict as any, 600, 500)).toThrow('exceeds');
  // atomic does not offer fallback: only fits or throws
  expect(() => assertAtomicFits(strict as any, 400, 500)).not.toThrow();

  // whole-block protection never throws, only decides whole or recursive
  expect(resolveSplittable(600, 500)).toBe('descend');
  expect(resolveSplittable(400, 500)).toBe('protect');
});

test('splittable config adds an element to the whole-block protection strategy', () => {
  const node = document.createElement('div');
  node.className = 'group';
  expect(classifyPrintNode(node, buildPrintRules({ splittable: ['.group'] }))).toEqual({ kind: 'splittable' });
  // The config adds whole-block protection while classification stays splittable.
  expect(node.matches(buildSplittableSelector({ splittable: ['.group'] }))).toBe(true);
  expect(node.matches(buildSplittableSelector())).toBe(false);
});

test('new and legacy HTML protocols produce identical classifications and splittable matches', () => {
  const pairs = [
    ['data-print-atomic="true"', 'data-pdf-atomic="true"'],
    ['data-print-ignore="true"', 'data-pdf-ignore="true"'],
    ['class="print-atomic"', 'class="pdf-atomic"'],
    ['class="print-ignore"', 'class="pdf-ignore"'],
    ['data-print-keep-together="true"', 'data-pdf-keep-together="true"'],
  ];
  for (const [current, legacy] of pairs) {
    const host = document.createElement('div'); host.innerHTML = `<div ${current}>same</div><div ${legacy}>same</div>`;
    expect(classifyPrintNode(host.children[0])).toEqual(classifyPrintNode(host.children[1]));
  }

  // 旧 keep-together="split" 标记仍映射到 splittable 选择器，并保持新旧 HTML 协议等价。
  const legacySplittablePairs = [
    ['data-print-keep-together="split"', 'data-pdf-keep-together="split"'],
    ['class="print-keep-or-split"', 'class="pdf-keep-or-split"'],
  ];
  for (const [current, legacy] of legacySplittablePairs) {
    const host = document.createElement('div'); host.innerHTML = `<div ${current}>same</div><div ${legacy}>same</div>`;
    expect(classifyPrintNode(host.children[0])).toEqual({ kind: 'splittable' });
    expect(classifyPrintNode(host.children[1])).toEqual({ kind: 'splittable' });
    expect(host.children[0].matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);
    expect(host.children[1].matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);
  }
});

test('preset semantics classify flow elements as splittable, protect media and code/formula blocks, and leave text nodes unclassified', () => {
  for (const tag of ['article', 'p', 'table', 'tbody', 'tr']) {
    expect(classifyPrintNode(document.createElement(tag))).toEqual({ kind: 'splittable' });
  }
  for (const tag of ['img', 'svg', 'pre', 'math']) {
    expect(classifyPrintNode(document.createElement(tag))).toMatchObject({ kind: 'atomic' });
  }
  // 文本节点的测量交给 DOM 遍历层的 Range 逻辑，不再由 classifyPrintNode 分类
  const text = document.createTextNode('A complete text line');
  expect(classifyPrintNode(text)).toBeUndefined();
});

test('removed ignore config and JavaScript custom rules fail closed without replacing global configuration', () => {
  configurePrint({ atomic: ['.existing'] });
  expect(() => configurePrint({ ignore: [] } as any)).toThrow('ignore has been removed');
  expect(() => buildPrintRules({ customRules: [{ selector: '*', result: { kind: 'ignore' } }] } as any)).toThrow('ignore" element classification has been removed');
  const el = document.createElement('div'); el.className = 'existing';
  expect(classifyPrintNode(el)).toMatchObject({ kind: 'atomic' });
});
