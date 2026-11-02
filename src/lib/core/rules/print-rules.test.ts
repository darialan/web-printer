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

test('基础层技术无关且仅使用原生标准协议与标签', () => {
  // 原生 tr 明确属于 splittable；表格行另有整块优先保护策略
  const tr = document.createElement('tr');
  expect(classifyPrintNode(tr)).toEqual({ kind: 'splittable' });
  expect(tr.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  // 原生图片和标题受保护
  const img = document.createElement('img');
  expect(classifyPrintNode(img)).toMatchObject({ kind: 'atomic' });

  // 基础规则绝不硬编码第三方组件库类名；未配置的组件行仍归为 splittable
  const antRow = document.createElement('div');
  antRow.className = 'ant-table-row';
  expect(classifyPrintNode(antRow)).toEqual({ kind: 'splittable' });

  // 基础规则选择器中不应包含任何第三方组件库特定前缀
  BASE_PRINT_RULES.forEach(rule => {
    expect(rule.selector).not.toContain('ant-');
    expect(rule.selector).not.toContain('el-');
  });
});

test('classifies elements as atomic or splittable and recognizes protocol selectors', () => {
  // 1. 不可分割 (Atomic)
  const elAtomicAttr = document.createElement('div');
  elAtomicAttr.setAttribute('data-print-atomic', 'true');
  expect(classifyPrintNode(elAtomicAttr)).toMatchObject({ kind: 'atomic' });

  const elAtomicClass = document.createElement('div');
  elAtomicClass.className = PRINT_CLASSES.ATOMIC;
  expect(classifyPrintNode(elAtomicClass)).toMatchObject({ kind: 'atomic' });

  // 兼容别名：keep-together="true" 等价于 atomic
  const elKeepAttr = document.createElement('div');
  elKeepAttr.setAttribute('data-print-keep-together', 'true');
  expect(classifyPrintNode(elKeepAttr)).toMatchObject({ kind: 'atomic' });

  // 旧 keep-together="split" 标记仍命中整块优先保护策略
  const elSplitAttr = document.createElement('div');
  elSplitAttr.setAttribute('data-print-keep-together', 'split');
  expect(classifyPrintNode(elSplitAttr)).toEqual({ kind: 'splittable' });
  expect(elSplitAttr.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  // splittable 标记同样明确归类为 splittable
  const elSplittableAttr = document.createElement('div');
  elSplittableAttr.setAttribute('data-print-splittable', 'true');
  expect(classifyPrintNode(elSplittableAttr)).toEqual({ kind: 'splittable' });
  expect(elSplittableAttr.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  const elSplittableClass = document.createElement('div');
  elSplittableClass.className = PRINT_CLASSES.SPLITTABLE;
  expect(classifyPrintNode(elSplittableClass)).toEqual({ kind: 'splittable' });
  expect(elSplittableClass.matches(BASE_SPLITTABLE_SELECTOR)).toBe(true);

  // force-split 不再影响分类；未命中其他规则时仍是 splittable
  const elBreakAttr = document.createElement('div');
  elBreakAttr.setAttribute('data-print-break', 'split');
  expect(classifyPrintNode(elBreakAttr)).toEqual({ kind: 'splittable' });

  // 3. 忽略打印 (Ignore)
  const elIgnoreAttr = document.createElement('div');
  elIgnoreAttr.setAttribute('data-print-ignore', 'true');
  expect(classifyPrintNode(elIgnoreAttr)).toEqual({ kind: 'splittable' });

  const elIgnoreClass = document.createElement('div');
  elIgnoreClass.className = 'print-ignore';
  expect(classifyPrintNode(elIgnoreClass)).toEqual({ kind: 'splittable' });
});

test('业务方通过 configurePrint 统一注册组件库类名', () => {
  const antRow = document.createElement('div');
  antRow.className = 'ant-table-row';

  const elRow = document.createElement('div');
  elRow.className = 'el-table__row';

  // 配置前默认允许递归分析
  expect(classifyPrintNode(antRow)).toEqual({ kind: 'splittable' });
  expect(classifyPrintNode(elRow)).toEqual({ kind: 'splittable' });

  // 业务层统一配置组件库选择器
  configurePrint({
    atomic: ['.ant-table-row', '.el-table__row', '.my-sign-stamp'],
  });

  // 配置后自动按对应规则生效
  expect(classifyPrintNode(antRow)).toMatchObject({ kind: 'atomic' });
  expect(classifyPrintNode(elRow)).toMatchObject({ kind: 'atomic' });

  const stamp = document.createElement('div');
  stamp.className = 'my-sign-stamp';
  expect(classifyPrintNode(stamp)).toMatchObject({ kind: 'atomic' });

  // 重置后恢复纯原生
  resetPrintRules();
  expect(classifyPrintNode(antRow)).toEqual({ kind: 'splittable' });
});

test('buildPrintRules 支持独立构造规则列表，不污染全局状态', () => {
  const localRules = buildPrintRules({
    atomic: ['.isolated-widget'],
  });

  const node = document.createElement('div');
  node.className = 'isolated-widget';

  expect(classifyPrintNode(node, localRules)).toMatchObject({ kind: 'atomic' });
  expect(classifyPrintNode(node)).toEqual({ kind: 'splittable' });
});

test('assertAtomicFits 严格报错，resolveSplittable 允许超高降级递归', () => {
  const strict = classifyPrintNode(
    Object.assign(document.createElement('div'), { className: 'group' }),
    buildPrintRules({ atomic: ['.group'] })
  );
  expect(strict).toMatchObject({ kind: 'atomic' });
  expect(() => assertAtomicFits(strict as any, 600, 500)).toThrow('超过');
  // atomic 不再提供降级路径：永远只有"放得下"或"报错"两种结果
  expect(() => assertAtomicFits(strict as any, 400, 500)).not.toThrow();

  // 整块优先保护策略永远不报错，只回答整体保护还是递归
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
  expect(() => configurePrint({ ignore: [] } as any)).toThrow('ignore 已移除');
  expect(() => buildPrintRules({ customRules: [{ selector: '*', result: { kind: 'ignore' } }] } as any)).toThrow('ignore 元素分类已移除');
  const el = document.createElement('div'); el.className = 'existing';
  expect(classifyPrintNode(el)).toMatchObject({ kind: 'atomic' });
});
