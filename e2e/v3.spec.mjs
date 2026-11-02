import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/e2e/fixtures/engine.html');
  await page.waitForFunction(() => window.fixtureReady);
});

test('removed ignore markers and JavaScript configs fail closed and never leak a root lock', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const root = document.getElementById('fixture'); root.style.width = '760px';
    const errors = [];
    for (const marker of ['data-print-ignore="true"', 'data-print-ignore="false"', 'class="print-ignore"', 'data-pdf-ignore="true"', 'class="pdf-ignore"']) {
      root.innerHTML = `<p ${marker}>private</p>`;
      try { await window.engine.outputPDF({element:root,filename:'private',download:false}); errors.push('LEAK'); }
      catch (e) { errors.push(e.message); }
    }
    root.innerHTML = '<button>Keep current control</button>';
    for (const options of [{ruleConfig:{ignore:[]}}, {rules:[{selector:'*',result:{kind:'ignore'}}]}]) {
      try { await window.engine.prepareLayout({element:root,...options}); errors.push('LEAK'); }
      catch (e) { errors.push(e.message); }
    }
    const layout = await window.engine.prepareLayout({element:root});
    const text = layout.root.textContent; layout.cleanup();
    return {errors,text,snapshots:document.querySelectorAll('[data-print-snapshot]').length};
  });
  expect(results.errors).toHaveLength(7);
  for (const error of results.errors) expect(error).toContain('已移除');
  expect(results.text).toContain('Keep current control');
  expect(results.snapshots).toBe(0);
});

test('snapshot preserves scrolled component geometry and the displaced sticky position', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const root=document.getElementById('fixture');root.style.cssText='width:760px;margin:30px auto;padding:20px;box-sizing:border-box';
    root.innerHTML='<div class="scroll" style="height:180px;overflow:auto;position:relative;border:4px solid #333"><div style="width:1050px;height:650px"><div class="sticky" style="position:sticky;top:10px;height:34px;background:#abc">Sticky current position</div><div class="anchor" style="margin-top:140px;height:60px;background:#bca">Scrolled content</div></div></div><p>Tail stays in flow</p>';
    const scroll=root.querySelector('.scroll');scroll.scrollTop=120;scroll.scrollLeft=50;
    const positions=node=>{
      const origin=node.getBoundingClientRect();
      return ['.scroll','.sticky','.anchor','p'].map(selector=>{const el=node.querySelector(selector),r=el.getBoundingClientRect();return [r.left-origin.left,r.top-origin.top,r.width,r.height];});
    };
    const before=root.outerHTML;const original=positions(root);
    const layout=await window.engine.prepareLayout({element:root});
    const cloned=positions(layout.root), state=[layout.root.querySelector('.scroll').scrollTop,layout.root.querySelector('.scroll').scrollLeft];
    layout.cleanup();
    return {original,cloned,state,sourceState:[scroll.scrollTop,scroll.scrollLeft],unchanged:root.outerHTML===before};
  });
  expect(result.state).toEqual([120,50]);expect(result.sourceState).toEqual([120,50]);expect(result.unchanged).toBe(true);
  result.original.forEach((rect,i)=>rect.forEach((value,j)=>expect(Math.abs(value-result.cloned[i][j])).toBeLessThan(0.6)));
});

test('clipped huge atomic content is measured only in its visible scrollport and CSS visibility remains native', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const root=document.getElementById('fixture');root.style.cssText='width:760px;height:200px;overflow:auto';
    root.innerHTML='<div data-print-atomic="true" style="height:2400px;background:#acf">clipped media</div><div data-print-atomic="true" style="height:6000px;visibility:hidden">invisible</div>';
    root.scrollTop=80;
    const layout=await window.engine.prepareLayout({element:root});
    const measure=window.engine.measureDocument(layout.root,layout.capacity);
    const output={height:measure.height,pages:layout.pages.length,scroll:layout.root.scrollTop,ranges:measure.ranges};layout.cleanup();return output;
  });
  expect(result.height).toBe(200);expect(result.pages).toBe(1);expect(result.scroll).toBe(80);
  expect(result.ranges).toEqual([{top:0,bottom:200}]);
});

test('ancestor-dependent flex/grid constraints, table columns and text wrapping survive detachment', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const host=document.createElement('div');host.id='context';document.body.append(host);
    const sheet=document.createElement('style');sheet.textContent='#context .report {width:760px;padding:20px;box-sizing:border-box;font:17px/25px Arial} #context .narrow {width:310px;height:75px;overflow:auto} #context .flex {display:flex;gap:14px} #context .flex > div {width:210px;flex-shrink:0} #context .grid {display:grid;grid-template-columns:200px 1fr;gap:12px} #context td {padding:10px;width:160px}';document.head.append(sheet);
    host.innerHTML='<article class="report"><div class="narrow">Long content wraps in the constrained width. '.repeat(1)+'More text to fill the constrained region with multiple lines and preserve clipped height.</div><div class="flex"><div>First fixed column</div><div>Second fixed column</div></div><div class="grid"><p>Left column</p><p>Right column with mixed <b>bold emphasis</b> and text wrapping.</p></div><table><tbody><tr><td>Column one</td><td>Column two</td></tr></tbody></table></article>';
    const root=host.querySelector('article');
    const measure=node=>{const origin=node.getBoundingClientRect();return [node,...node.querySelectorAll('*')].map(el=>{const r=el.getBoundingClientRect();return [r.left-origin.left,r.top-origin.top,r.width,r.height];});};
    const source=measure(root),before=root.outerHTML;
    const layout=await window.engine.prepareLayout({element:root});const snapshot=measure(layout.root);layout.cleanup();
    return {source,snapshot,unchanged:root.outerHTML===before};
  });
  expect(result.unchanged).toBe(true);expect(result.snapshot.length).toBe(result.source.length);
  result.source.forEach((rect,i)=>rect.forEach((value,j)=>expect(Math.abs(value-result.snapshot[i][j]),`element ${i}, coordinate ${j}`).toBeLessThan(0.6)));
});

test('current multi-select values survive snapshot cloning', async({page})=>{
  expect(await page.evaluate(async()=>{const root=document.getElementById('fixture');root.style.width='760px';root.innerHTML='<select multiple><option>A</option><option>B</option><option>C</option></select>';
    const select=root.firstElementChild;select.options[0].selected=true;select.options[2].selected=true;
    const layout=await window.engine.prepareLayout({element:root});const selected=Array.from(layout.root.querySelector('select').selectedOptions).map(option=>option.textContent);layout.cleanup();return selected;})).toEqual(['A','C']);
});

test('idempotent cleanup cannot unlock a newer layout and maxPages errors release resources',async({page})=>{
  const result=await page.evaluate(async()=>{const root=document.getElementById('fixture');root.style.cssText='width:760px;height:2400px';root.textContent='long';const first=await window.engine.prepareLayout({element:root});first.cleanup();
    const second=await window.engine.prepareLayout({element:root});first.cleanup();let concurrent='',limit='';try{await window.engine.prepareLayout({element:root});}catch(e){concurrent=e.message;}second.cleanup();
    try{await window.engine.prepareLayout({element:root,maxPages:1});}catch(e){limit=e.message;}
    const third=await window.engine.prepareLayout({element:root});third.cleanup();return {concurrent,limit,snapshots:document.querySelectorAll('[data-print-snapshot]').length};});
  expect(result.concurrent).toContain('正在导出');expect(result.limit).toContain('页限制');expect(result.snapshots).toBe(0);
});

test('CSS renderer failures remove their owned iframe and permit a subsequent export',async({page})=>{
  const result=await page.evaluate(async()=>{const root=document.getElementById('fixture');root.style.cssText='width:760px;height:100px;background:oklch(60% 0.15 120)';root.textContent='unsupported color';let error='';
    try{await window.engine.outputPDF({element:root,filename:'unsupported',download:false});}catch(e){error=e.message;}
    const leaked=document.querySelectorAll('.html2canvas-container,[data-print-snapshot]').length;
    root.style.background='rgb(40,90,120)';const output=await window.engine.outputPDF({element:root,filename:'retry',download:false});
    return {error,leaked,bytes:output.bytes,remaining:document.querySelectorAll('.html2canvas-container,[data-print-snapshot]').length};});
  expect(result.error).toMatch(/unsupported color|oklch/i);expect(result.leaked).toBe(0);expect(result.remaining).toBe(0);expect(result.bytes).toBeGreaterThan(1000);
});

test('debug visualization leaves business DOM unchanged and whole-body clones omit only owned layers',async({page})=>{
  const result=await page.evaluate(async()=>{const root=document.getElementById('fixture');root.style.cssText='width:760px;height:240px';root.innerHTML='<p data-print-debug="business">Keep business node</p><button>Action</button>';const before=root.outerHTML;
    window.engine.visualizePageBreaks([0,120],root);const after=root.outerHTML;const owned=Array.from(document.body.children).filter(el=>el.hasAttribute('data-print-debug')).length;
    const clone=window.engine.cloneWithResolvedStyles(document.body);const business=clone.querySelector('[data-print-debug="business"]')?.textContent;const debug=clone.querySelector('[aria-hidden="true"][data-print-debug]');window.engine.clearPageBreaks(root);
    return {unchanged:before===after&&root.outerHTML===before,owned,business,debug:Boolean(debug)};});
  expect(result).toEqual({unchanged:true,owned:1,business:'Keep business node',debug:false});
});

test('real PNG ZIP and PDF downloads contain all planned pages', async({page},testInfo)=>{
  await page.evaluate(()=>{const root=document.getElementById('fixture');root.style.cssText='width:760px;margin:0';root.innerHTML=['#b23a32','#23824b','#275991'].map((color,i)=>`<section data-print-atomic="true" style="height:800px;background:${color};font:32px Arial;color:white">Unique page ${i+1}</section>`).join('');});
  const zipEvent=page.waitForEvent('download');
  const stats=await page.evaluate(async()=>{const root=document.getElementById('fixture');return window.engine.outputDocument({element:root,filename:'verified',format:'png'}).then(({pages,bytes,captures})=>({pages,bytes,captures}));});
  const zip=await zipEvent;const zipPath=testInfo.outputPath(zip.suggestedFilename());await zip.saveAs(zipPath);const buffer=await fs.readFile(zipPath);
  const entries=[];let offset=0;
  while(buffer.readUInt32LE(offset)===0x04034b50){const size=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28);const start=offset+30+nameLength+extra;entries.push({name:buffer.subarray(offset+30,offset+30+nameLength).toString(),png:buffer.subarray(start,start+size).toString('base64')});offset=start+size;}
  expect(stats.pages).toBe(3);expect(entries.map(e=>e.name)).toEqual(['page-001.png','page-002.png','page-003.png']);
  const colors=await page.evaluate(async entries=>{const found=[];for(const entry of entries){const img=new Image();img.src='data:image/png;base64,'+entry.png;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);found.push(Array.from(ctx.getImageData(Math.round(img.width/2),Math.round(img.height/4),1,1).data));}return found;},entries);
  expect(colors).toEqual([[178,58,50,255],[35,130,75,255],[39,89,145,255]]);
  expect(stats.captures).toHaveLength(3);expect(Math.max(...stats.captures.map(x=>x.pixels))).toBeLessThanOrEqual(8_000_000);
  const pdfEvent=page.waitForEvent('download');await page.evaluate(()=>window.engine.outputPDF({element:document.getElementById('fixture'),filename:'verified'}).then(()=>null));
  const pdf=await pdfEvent;const pdfPath=testInfo.outputPath(pdf.suggestedFilename());await pdf.saveAs(pdfPath);const bytes=await fs.readFile(pdfPath);expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  const pages=await page.evaluate(async data=>{const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';const doc=await pdfjs.getDocument({data:new Uint8Array(data)}).promise;const pages=doc.numPages;await doc.destroy();return pages;},Array.from(bytes));expect(pages).toBe(3);
});
