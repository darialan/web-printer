export const settings = {
  paper: 'a4' as const, widthMm: 210, heightMm: 297, orientation: 'portrait' as const,
  marginTopMm: 10, marginRightMm: 10, marginBottomMm: 10, marginLeftMm: 10,
  pageNumber: { enabled: false },
};
export const scenarios = [
  { id: 'text', name: '长文本与混合字体', focus: '逐行保护、字号、换行', visual: true },
  { id: 'table', name: '复杂与嵌套表格', focus: '行完整、列宽、长单元格', visual: true },
  { id: 'layout', name: 'Flex / Grid 布局', focus: '列宽、尺寸、相对坐标', visual: true },
  { id: 'media', name: '图文、Canvas 与 SVG', focus: '当前绘制、表单、原子保护', visual: true },
  { id: 'scroll', name: '滚动、裁剪与定位', focus: 'scrollTop / sticky / fixed', visual: true },
  { id: 'audit-truncate', name: '审计报告文字截断 (#692)', focus: '跨页边界文本行截断保护 (Issue #692)', visual: true },
  { id: 'credit-report', name: '信用报告卡片空白 (#512)', focus: '多级容器平滑拆分与避免大面积空白 (Issue #512)', visual: true },
  { id: 'heavy-dom', name: '复杂后台局部导出性能 (#853)', focus: '无关外部 DOM 节点的隔离克隆与耗时 (Issue #853)', visual: false },
  ...[5, 20, 50].map(pages => ({ id: `long-${pages}`, name: `${pages} 页长文档`, focus: '逐页耗时、内存、资源释放', targetPages: pages, visual: false })),
];
const line = 'Content-aware pagination keeps each rendered line intact. 原始宽度和文字换行应保持不变。';
const paragraph = (i: number) => `<p data-check="p-${i}">${i + 1}. ${line} <b>Bold emphasis</b>, <span style="font-family:Georgia;font-size:19px">mixed serif type</span>. ${line}</p>`;

export function mountScenario(id: string, width = 718): HTMLElement | null {
  const root = document.getElementById('scene');
  if (!root) return null;
  root.style.cssText = `width:${width}px;padding:16px;box-sizing:border-box;background:white;color:#202124;font:16px/24px Arial,sans-serif;margin:0;`;

  // Heavy DOM host injection and cleanup for #853
  const existingHeavy = document.getElementById('heavy-dom-portal-host');
  if (id === 'heavy-dom') {
    if (!existingHeavy) {
      const host = document.createElement('div');
      host.id = 'heavy-dom-portal-host';
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;opacity:0.01;pointer-events:none;';
      const style = document.createElement('style');
      style.id = 'heavy-dom-styles';
      style.textContent = `
        .erp-heavy-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
        .erp-card-item { padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        .erp-badge { display: inline-block; padding: 2px 6px; font-size: 11px; }
        .erp-tree-node { padding-left: 20px; border-left: 2px solid #ddd; }
        .erp-table td { border: 1px solid #eee; padding: 6px; }
      `;
      document.head.appendChild(style);

      let html = '<div class="erp-tree">';
      for (let i = 0; i < 200; i++) {
        html += `<div class="erp-tree-node" data-level="${i % 5}"><span class="erp-badge">Node ${i}</span><button type="button">Action</button></div>`;
      }
      html += '</div><div class="erp-table"><table style="width:100%"><tbody>';
      for (let r = 0; r < 300; r++) {
        html += `<tr>${Array.from({ length: 8 }, (_, c) => `<td><span class="erp-cell">Data ${r}-${c}</span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#3b82f6"/></svg></td>`).join('')}</tr>`;
      }
      html += '</tbody></table></div>';
      host.innerHTML = html;
      document.body.appendChild(host);
    }
  } else {
    existingHeavy?.remove();
    document.getElementById('heavy-dom-styles')?.remove();
  }

  if (id === 'text') {
    root.innerHTML = `<h2 data-check="title">Rendered lines / 保持内容顺序</h2>${Array.from({ length: 13 }, (_, i) => paragraph(i)).join('')}<blockquote data-check="quote">A quote keeps its original indentation and line height. ${line}</blockquote><ul>${[0, 1, 2].map(i => `<li>${line} ${i + 1}</li>`).join('')}</ul>`;
  } else if (id === 'audit-truncate') {
    // Issue #692: Audit report text line truncated at page boundary (A4 single page capacity is ~1046.7px)
    // 16px padding + 1008px preamble puts opinion box top at Y=1024px.
    // Opinion box border=2px, padding=8px puts text line top at Y=1034px, bottom at Y=1070px.
    // Cut point is 1046.7px, which cuts right across the middle of the text line.
    root.innerHTML = `
      <div id="audit-preamble" data-check="preamble" style="height:1008px;background:#f8fafc;border:1px solid #cbd5e1;padding:16px;box-sizing:border-box;margin:0;">
        <h2 data-check="title" style="margin:0 0 12px;font-size:22px;">专项合规审计报告</h2>
        <div data-check="meta" style="padding:10px 12px;background:#f1f5f9;border-left:4px solid #475569;margin-bottom:14px;">
          <p style="margin:0 0 4px;font-size:13px;">被审计单位：天穹数智科技有限公司 · 审计基准日：2026年10月31日</p>
          <p style="margin:0;font-size:13px;">审计类型：内部控制有效性专项评价 · 报告编号：AUD-2026-0881</p>
        </div>
        <p style="margin:0 0 10px;color:#475569;font-size:14px;">一、工作底稿核查记录</p>
        ${Array.from({ length: 17 }, (_, i) => `<p style="margin:0 0 7px;font-size:13px;line-height:20px;color:#64748b;">${i + 1}. 凭证核验项编号 VK-2026-${1000 + i}：核查会计科目借贷平衡、原始凭证及审批链条完整。抽验记录真实无涂改。</p>`).join('')}
      </div>
      <div id="audit-opinion-box" data-check="critical-audit-conclusion" data-print-atomic="true" style="margin:0;padding:8px 12px;border:2px solid #ef4444;background:#fef2f2;border-radius:4px;box-sizing:border-box;">
        <p id="audit-opinion-line" data-check="line-target" style="margin:0;font-family:Arial,sans-serif;font-size:20px;line-height:36px;font-weight:bold;color:#991b1b;">
          【审计意见与专项结论】经穿透复核，被审计单位在当期资产重组中未见重大实质违规，关键内控环节执行有效。
        </p>
      </div>
      <div style="height:400px;margin-top:16px;background:#f1f5f9;padding:16px;box-sizing:border-box;">
        <h4 style="margin:0 0 10px;font-size:15px;color:#374151;">二、会计师事务所独立审计签章 (Signatures & Stamp)</h4>
        <p style="font-size:14px;line-height:22px;color:#4b5563;">主审注册会计师（签字）：李德华、张振宇</p>
        <p style="font-size:14px;line-height:22px;color:#4b5563;">中天华智会计师事务所（特殊普通合伙） · 2026年11月02日</p>
      </div>
    `;
  } else if (id === 'credit-report') {
    // Issue #512: Nested cards in Credit Report where naive avoid-all leaves massive blank gaps
    const cardStyle = 'border:1px solid #d1d5db;border-radius:8px;padding:14px;margin-bottom:14px;background:#f9fafb;box-sizing:border-box;';
    root.innerHTML = `
      <h2 data-check="title" style="margin:0 0 12px;font-size:22px;">企业信用合规评估报告</h2>
      <section class="credit-card" data-check="card-basic" style="${cardStyle}height:380px;">
        <h3 style="margin:0 0 10px;font-size:16px;color:#111827;">一、企业工商登记与主体资质</h3>
        <p style="font-size:14px;color:#4b5563;margin:0 0 8px;">统一社会信用代码：91110108MA00XXXX7Y · 法定代表人：王建华</p>
        <p style="font-size:14px;color:#4b5563;margin:0 0 8px;">注册资本：5,000 万元人民币 · 实缴资本：5,000 万元人民币</p>
        <p style="font-size:14px;color:#4b5563;margin:0 0 8px;">所属行业：软件和信息技术服务业 · 登记机关：海淀区市场监督管理局</p>
        <div style="background:#e5e7eb;padding:10px;border-radius:4px;font-size:13px;color:#374151;margin-top:14px;">
          【合规说明】该主体在基准日前三年内未受重大行政处罚，工商登记状态正常，经营地址核查一致。
        </div>
      </section>

      <section class="credit-card" data-check="card-finance" style="${cardStyle}">
        <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">二、近三年财务状况穿透与核心资产评估</h3>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">本节数据源自被评估企业经审计的年度财务会计报表及税务申报资料，对关键财务指标进行结构化列示与穿透分析。</p>
        <div style="display:grid;gap:10px;">
          ${Array.from({ length: 6 }, (_, i) => `
            <div data-print-atomic="true" style="padding:10px;background:white;border:1px solid #e5e7eb;border-radius:6px;">
              <strong style="color:#1f2937;font-size:14px;">指标项 ${i + 1}：${['营业收入与复合增长率', 'EBITDA 息税折旧摊销前利润', '资产负债率与短期偿债能力', '经营性现金流净额波动', '无形资产与研发资本化占比', '应收账款周转天数与坏账计提'][i]}</strong>
              <div style="margin-top:6px;font-size:13px;color:#4b5563;line-height:20px;">
                2024~2026 年度经审计财务数据经穿透复核，各项资产计量公允，风险敞口在合理受控区间内。
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="credit-card" data-check="card-conclusion" style="${cardStyle}height:320px;margin-top:14px;">
        <h3 style="margin:0 0 10px;font-size:16px;color:#111827;">三、综合授信评级意见</h3>
        <p style="font-size:14px;line-height:24px;color:#374151;">经综合风险计量模型评估，该主体综合信用等级为 AA+，授信额度为 4,200 万元整。</p>
      </section>
    `;
  } else if (id === 'heavy-dom') {
    // Issue #853: Local container export within a heavy SPA host DOM tree
    root.innerHTML = `
      <h2 data-check="title">月度经营结算与对账报告</h2>
      <div style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;color:#475569;">结算周期：2026年10月度 · 业务范围：华北及华东区域供应链业务线 · 制表时间：2026-11-02</p>
      </div>
      ${Array.from({ length: 25 }, (_, i) => `<p data-check="item-${i}">${i + 1}. 财务会计记账凭证摘要：核销应收账款与供应商结算，明细状态已对账。${line}</p>`).join('')}
    `;
  } else if (id === 'table') {
    root.innerHTML = `<h2 data-check="title">Complex table</h2><table data-check="table" style="width:100%;border-collapse:collapse;table-layout:fixed"><colgroup><col style="width:16%"><col style="width:34%"><col style="width:50%"></colgroup><tbody>${Array.from({ length: 18 }, (_, i) => `<tr data-check="row-${i}"><td style="border:1px solid #aaa;padding:8px">Row ${i + 1}</td><td style="border:1px solid #aaa;padding:8px">${line}</td><td style="border:1px solid #aaa;padding:8px">${i === 3 ? '<table style="width:100%;border-collapse:collapse"><tr><td>nested A</td><td>nested B</td></tr><tr><td colspan="2">nested long content</td></tr></table>' : line.repeat(i === 10 ? 14 : 1)}</td></tr>`).join('')}</tbody></table>`;
  } else if (id === 'layout') {
    root.innerHTML = `<h2 data-check="title">Flex and Grid geometry</h2><div class="grid" data-check="grid" style="display:grid;grid-template-columns:210px 1fr;gap:16px"><aside data-check="aside" style="background:#e3edf0;padding:16px">${line}</aside><section data-check="main">${paragraph(1)}${paragraph(2)}</section></div><div data-check="flex" style="display:flex;gap:18px;align-items:flex-start"><div data-check="fixed-col" style="width:230px;flex-shrink:0;background:#edf1ed;padding:12px;box-sizing:border-box">${line}</div><div data-check="fluid-col" style="flex:1">${line.repeat(4)}</div></div>${Array.from({ length: 6 }, (_, i) => paragraph(i)).join('')}`;
  } else if (id === 'media') {
    root.innerHTML = `<h2 data-check="title">Current media and form state</h2><img data-check="image" alt="local test graphic" style="display:block;width:380px;height:140px" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="380" height="140"><rect width="380" height="140" fill="#1d6e79"/><circle cx="90" cy="70" r="40" fill="#f5cf65"/><path d="M170 90h150" stroke="white" stroke-width="12"/></svg>')}"><p>${line}</p><canvas data-check="canvas" width="500" height="120" style="display:block"></canvas><svg data-check="svg" width="300" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="100" fill="#dce9ee"/><text x="20" y="60" font-family="Arial" font-size="24" fill="#203a42">SVG current content</text></svg><p><input data-check="input" value="initial"><textarea data-check="textarea">initial note</textarea></p><pre data-check="code" style="font:14px/22px monospace;background:#edf1f3;padding:16px">const page = { start: 0, end: capacity };\n// Preserve this code block as one atomic region.</pre>${Array.from({ length: 6 }, (_, i) => paragraph(i)).join('')}`;
  } else if (id === 'scroll') {
    root.innerHTML = `<h2 data-check="title">Preserve current scroll state</h2><div data-check="scroll" class="scroll" style="height:220px;overflow:auto;border:3px solid #4a6870;position:relative"><div style="height:850px;width:1000px"><header data-check="sticky" style="position:sticky;top:8px;height:40px;line-height:40px;background:#bdd9df">Sticky at the current offset</header>${Array.from({ length: 9 }, (_, i) => `<p data-check="scroll-line-${i}" style="height:70px;margin:0;background:${i % 2 ? '#eff4f5' : 'white'}">Scroll row ${i + 1}: ${line}</p>`).join('')}</div></div><aside data-check="fixed" style="position:fixed;left:500px;top:380px;width:190px;height:45px;background:#dce9ee;z-index:2">Fixed current location</aside><div data-check="absolute" style="position:relative;height:130px"><span style="position:absolute;left:30px;top:40px">Absolute current location</span></div>${Array.from({ length: 7 }, (_, i) => paragraph(i)).join('')}`;
  } else {
    const count = Number(id.split('-')[1]);
    const capacity = width * 277 / 190;
    root.style.padding = '0';
    // Empty space is not the stress load: 10 real measured text rows per target page.
    const rowHeight = (capacity * count - 1) / (count * 10);
    root.innerHTML = Array.from({ length: count * 10 }, (_, i) => `<p data-check="long-${i}" style="position:relative;margin:0;height:${rowHeight}px;box-sizing:border-box;border-bottom:1px solid #cbd6d9;padding:12px;font:16px/24px Arial"><span aria-hidden="true" style="position:absolute;right:12px;top:14px;width:8px;height:16px;background:rgb(${30 + i % 200},${40 + Math.floor(i / 200) * 70},160)"></span>Record ${i + 1} / ${count * 10}<br>${line}<br>End marker ${i + 1}.</p>`).join('');
  }

  const scroll = root.querySelector('.scroll') as HTMLElement | null;
  if (scroll) { scroll.scrollTop = 160; scroll.scrollLeft = 60; }
  const canvas = root.querySelector('canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#174f60';
      ctx.fillRect(0, 0, 500, 120);
      ctx.fillStyle = '#e9bf54';
      ctx.fillRect(30, 25, 180, 65);
      ctx.fillStyle = 'white';
      ctx.font = '24px Arial';
      ctx.fillText('Live canvas', 240, 74);
    }
  }
  const input = root.querySelector('input');
  if (input) input.value = 'Current edited value';
  const textarea = root.querySelector('textarea');
  if (textarea) textarea.value = 'Current edited note';
  return root;
}

export function geometry(root: HTMLElement) {
  const origin = root.getBoundingClientRect();
  const elements = [root, ...Array.from(root.querySelectorAll('[data-check]'))];
  return elements.map(el => {
    const r = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines: [number, number, number, number][] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const currentText = walker.currentNode.textContent || '';
      if (!currentText.trim()) continue;
      range.selectNodeContents(walker.currentNode);
      for (const line of Array.from(range.getClientRects())) {
        if (line.width && line.height) {
          lines.push([line.left - origin.left, line.top - origin.top, line.width, line.height]);
        }
      }
    }
    return { key: (el as HTMLElement).dataset.check || 'root', rect: [r.left - origin.left, r.top - origin.top, r.width, r.height], lines };
  });
}

export function compareGeometry(source: any[], snapshot: any[]) {
  let maxDelta = 0, changedLines = 0;
  for (let i = 0; i < source.length; i++) {
    if (!snapshot[i] || source[i].key !== snapshot[i].key) return { maxDelta: Infinity, changedLines: Infinity };
    const a = source[i], b = snapshot[i];
    for (let j = 0; j < a.rect.length; j++) {
      maxDelta = Math.max(maxDelta, Math.abs(a.rect[j] - b.rect[j]));
    }
    if (a.lines.length !== b.lines.length) {
      changedLines++;
    } else {
      for (let j = 0; j < a.lines.length; j++) {
        const lineA = a.lines[j];
        const lineB = b.lines[j];
        for (let k = 0; k < lineA.length; k++) {
          const delta = Math.abs(lineA[k] - lineB[k]);
          maxDelta = Math.max(maxDelta, delta);
          if (delta > 0.6) changedLines++;
        }
      }
    }
  }
  return { maxDelta, changedLines };
}
