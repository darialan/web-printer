import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const folder=path.resolve(process.env.BENCHMARK_OUTPUT||'.benchmark/results');
const repeats=Number(process.env.BENCHMARK_REPEATS||3);
const chosen=process.env.BENCHMARK_SCENARIOS?.split(',');
const engines=['baseline','current','html2pdf'];
async function timeLimit(promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Export exceeded '+ms+'ms budget')),ms);})]);}finally{clearTimeout(timer);}}
const savePng=async(name,data)=>fs.writeFile(path.join(folder,name),Buffer.from(data.split(',')[1],'base64'));

async function memorySampler(browser,page){
  const cdp=await browser.newBrowserCDPSession();let peak=0,initial=0,running=false,stopped=false;
  const sample=async()=>{if(running||stopped)return;running=true;try{const {processInfo}=await cdp.send('SystemInfo.getProcessInfo');const ids=processInfo.map(p=>p.id).filter(id=>Number.isInteger(id)&&id>0);const {stdout}=await exec('ps',['-o','rss=','-p',ids.join(',')]);const rss=stdout.trim().split(/\s+/).reduce((sum,v)=>sum+Number(v),0)*1024;if(!initial)initial=rss;peak=Math.max(peak,rss);}catch{}finally{running=false;}};
  await sample();const interval=setInterval(sample,100);
  let result;
  return async()=>{if(result)return result;clearInterval(interval);await sample();stopped=true;await cdp.detach();result={browserRssStartBytes:initial,browserRssSampledPeakBytes:peak,rssSampleIntervalMs:100};return result;};
}

test('three-engine reproducible visual and long-document comparison',async({browser},testInfo)=>{
  await fs.mkdir(folder,{recursive:true});
  const config=JSON.parse(await fs.readFile('.benchmark/baseline.json','utf8'));
  const metadata={date:new Date().toISOString(),browser:browser.version(),viewport:{width:1440,height:1000},deviceScaleFactor:1,
    os:`${process.platform} ${os.release()}`,hardware:`${os.cpus()[0]?.model || 'Apple M1 Pro'} (${os.cpus().length} cores), ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB Unified Memory`,baseline:config,html2pdf:'0.14.0',repeats,paper:'A4 portrait',marginsMm:10,sourceWidth:718,scale:2,
    image:'PNG (lossless); quality ignored by PNG encoders; html2pdf jsPDF compress:true (default PNG image compression SLOW), Web Printer PNG FAST',pageNumbers:false,maxPages:100,
    memory:'100ms sampled sum of RSS for Chromium processes, including shared pages and browser overhead; 25ms sampled JS heap excludes native canvas allocations. Sampled peaks are lower bounds.',
    budgets:{currentTotalMs:180000,currentBrowserRssBytes:2147483648,maxCanvasPixels:8000000,maxCanvasDimension:8192},
    html2pdfPagebreak:{mode:['css','legacy'],avoid:['img','canvas','svg','pre','h1','h2','h3','h4','h5','h6','tr']},
    pdfValidation:'Every output PDF page is rasterized; long fixtures carry 10 sequential RGB markers per target page, each must occur exactly once in order. Blank pages or missing markers fail even if the export promise resolved.',
    visual:'Browser source vs mounted snapshot; exported PDF rasterized with PDF.js and body reassembled with intentional page padding removed. Pixel difference uses max channel delta >32. Geometry threshold 0.6 CSS px; line changes counted separately.'};
  const records=[],visuals=[];
  const probe=await browser.newPage();await probe.goto('http://127.0.0.1:4175/benchmark/fixture.html');await probe.waitForFunction(()=>window.fixtureReady);
  const scenarios=await probe.evaluate(()=>window.bench.scenarios);await probe.close();
  for(let repeat=0;repeat<repeats;repeat++)for(const scenario of scenarios.filter(s=>!chosen||chosen.includes(s.id))){
    const order=engines.slice(repeat%3).concat(engines.slice(0,repeat%3));
    for(const engine of order){
      const context=await browser.newContext({viewport:metadata.viewport,deviceScaleFactor:1});const page=await context.newPage();
      await page.goto('http://127.0.0.1:4175/benchmark/fixture.html');await page.waitForFunction(()=>window.fixtureReady);
      await page.evaluate(async({id,engine})=>{const b=window.bench;b.mountScenario(id);b.selected=engine==='baseline'?await import('/.benchmark/baseline/src/lib/index.ts'):b.current;await b.current.waitForResources(document.getElementById('scene'));},{id:scenario.id,engine});
      const stopMemory=await memorySampler(browser,page);
      let record={scenario:scenario.id,engine,repeat};
      try{
        const outcome=await timeLimit(page.evaluate(async({engine,id})=>{
          const b=window.bench,root=document.getElementById('scene'),before=root.outerHTML;
          let peak=performance.memory?.usedJSHeapSize||0;const jsHeapStartBytes=peak;
          const timer=setInterval(()=>{peak=Math.max(peak,performance.memory?.usedJSHeapSize||0);},25);
          const started=performance.now();let worker,layout;
          try{
            let result;
            if(engine==='html2pdf'){
              worker=b.html2pdf().set({margin:10,image:{type:'png'},html2canvas:{scale:2,logging:false,useCORS:true,backgroundColor:'#fff'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait',compress:true},pagebreak:{mode:['css','legacy'],avoid:['img','canvas','svg','pre','h1','h2','h3','h4','h5','h6','tr']}}).from(root);
              const blob=await worker.outputPdf('blob');const pdf=await worker.get('pdf'),canvas=await worker.get('canvas');
              result={blob,pages:pdf.internal.getNumberOfPages(),bytes:blob.size,fullCanvas:{width:canvas.width,height:canvas.height,pixels:canvas.width*canvas.height},captures:[]};
            }else result=await b.selected.outputDocument({element:root,settings:b.settings,filename:id,format:'pdf',download:false,maxPages:100});
            const totalMs=performance.now()-started;
            peak=Math.max(peak,performance.memory?.usedJSHeapSize||0);
            window.benchOutput=result.blob;
            return {ok:true,pages:result.pages,bytes:result.bytes,totalMs,layoutMs:result.layoutMs,captures:result.captures||[],fullCanvas:result.fullCanvas,
              jsHeapStartBytes,jsHeapSampledPeakBytes:peak,sourceUnchanged:root.outerHTML===before,
              remainingSnapshots:document.querySelectorAll('[data-print-snapshot]').length,remainingCaptureFrames:document.querySelectorAll('.html2canvas-container').length};
          }catch(error){return {ok:false,error:String(error?.message||error),totalMs:performance.now()-started,jsHeapStartBytes,jsHeapSampledPeakBytes:peak,sourceUnchanged:root.outerHTML===before,remainingSnapshots:document.querySelectorAll('[data-print-snapshot]').length,remainingCaptureFrames:document.querySelectorAll('.html2canvas-container').length};}
          finally{clearInterval(timer);if(worker){const canvas=await worker.get('canvas').catch(()=>null);if(canvas){canvas.width=0;canvas.height=0;}const overlay=await worker.get('overlay').catch(()=>null);overlay?.remove();}}
        },{engine,id:scenario.id}),180000);
        record={...record,...outcome,...await stopMemory()};
        // Validate the actual PDF, not just a resolved export promise. This is
        // outside the export timing and memory measurement for every engine.
        if(record.ok){
          const validation=await timeLimit(page.evaluate(async({scenario,pages:expectedPages})=>{
            const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';
            const doc=await pdfjs.getDocument({data:new Uint8Array(await window.benchOutput.arrayBuffer())}).promise;
            const tokens=[],blankPages=[];
            try{
              for(let i=1;i<=doc.numPages;i++){
                const page=await doc.getPage(i),widthPt=page.view[2]-page.view[0],density=718/((widthPt/210)*190),viewport=page.getViewport({scale:density});
                const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
                const ctx=canvas.getContext('2d');await page.render({canvasContext:ctx,viewport}).promise;
                const margin=widthPt/210*10*density;
                const data=ctx.getImageData(Math.ceil(margin),Math.ceil(margin),718,Math.floor(718*277/190)).data;
                let painted=false;for(let p=0;p<data.length;p+=4){if(data[p]<235||data[p+1]<235||data[p+2]<235){painted=true;break;}}
                if(!painted)blankPages.push(i);
                if(scenario.startsWith('long-')){
                  const strip=ctx.getImageData(Math.round(margin+702),Math.ceil(margin),1,Math.floor(718*277/190)).data;
                  let previous=-1,run=0;
                  const finish=()=>{if(previous>=0&&run>=4)tokens.push(previous);};
                  for(let y=0;y<strip.length;y+=4){const r=strip[y],g=strip[y+1],b=strip[y+2];let id=-1;
                    if(Math.abs(b-160)<4){const group=Math.round((g-40)/70),n=Math.round(r-30);if(group>=0&&group<3&&n>=0&&n<200&&Math.abs(g-(40+group*70))<4)id=group*200+n;}
                    if(id!==previous){finish();previous=id;run=1;}else run++;
                  }finish();
                }
                canvas.width=0;canvas.height=0;page.cleanup();
              }
              const count=scenario.startsWith('long-')?Number(scenario.split('-')[1])*10:0;
              const markersComplete=!count||(tokens.length===count&&tokens.every((token,index)=>token===index));
              return {pdfPages:doc.numPages,expectedPages,pageCountMatches:doc.numPages===expectedPages,blankPages,expectedMarkers:count||null,observedMarkers:count?tokens.length:null,markersComplete};
            }finally{await doc.destroy();}
          },{scenario:scenario.id,pages:record.pages}),180000);
          record.pdfValidation=validation;
          if(!validation.pageCountMatches||validation.blankPages.length||!validation.markersComplete){record.exportResolved=true;record.ok=false;record.error=`Actual PDF validation failed: ${validation.blankPages.length} blank pages; ${validation.observedMarkers??'n/a'}/${validation.expectedMarkers??'n/a'} markers; page count matches ${validation.pageCountMatches}`;}
        }
        if(repeat===0&&(record.ok||record.exportResolved)){
          const bytes=await page.evaluate(()=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(window.benchOutput);}));
          await fs.writeFile(path.join(folder,`${scenario.id}-${engine}.pdf`),Buffer.from(bytes,'base64'));
        }
        if(repeat===0&&scenario.visual){
          const visual=await page.evaluate(async({engine,id})=>{
            const b=window.bench,root=document.getElementById('scene');
            const source=b.geometry(root);let cloneStats=null,pages=null;
            if(engine!=='html2pdf'){
              const layout=await b.selected.prepareLayout({element:root,settings:b.settings});
              cloneStats=b.compareGeometry(source,b.geometry(layout.root));pages=layout.pages;
              const measure=b.selected.measureDocument(layout.root,layout.capacity);
              let unsafeBreaks=0;for(const page of pages.slice(1))if(measure.ranges.some(r=>r.top<page.start-0.25&&r.bottom>page.start+0.25))unsafeBreaks++;
              cloneStats.unsafeBreaks=unsafeBreaks;
              window.visualLayout=layout;
            }
            return {scenario:id,engine,geometry:cloneStats,pages,rect:{...root.getBoundingClientRect().toJSON(),scrollX:window.scrollX,scrollY:window.scrollY}};
          },{engine,id:scenario.id});
          const rect=visual.rect;const clip={x:rect.x+rect.scrollX,y:rect.y+rect.scrollY,width:Math.ceil(rect.width),height:Math.ceil(rect.height)};
          const original=await page.screenshot({clip,fullPage:true});const sourceName=`${scenario.id}-${engine}-source.png`;await fs.writeFile(path.join(folder,sourceName),original);visual.source=sourceName;
          if(engine!=='html2pdf'){
            await page.evaluate(()=>{const layout=window.visualLayout,root=document.getElementById('scene'),rect=root.getBoundingClientRect(),host=layout.root.parentElement;host.style.left=`${rect.left+window.scrollX}px`;host.style.top=`${rect.top+window.scrollY}px`;host.style.height=`${rect.height}px`;host.style.zIndex='2147483647';host.style.background='white';});
            const snapshot=await page.screenshot({clip,fullPage:true});const snapshotName=`${scenario.id}-${engine}-snapshot.png`;await fs.writeFile(path.join(folder,snapshotName),snapshot);visual.snapshot=snapshotName;
            const compare=await page.evaluate(async({a,b})=>{
              const decode=async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {c,ctx,data:ctx.getImageData(0,0,c.width,c.height).data};};
              const source=await decode(a),target=await decode(b),out=target.ctx.createImageData(target.c.width,target.c.height);let changed=0,total=source.data.length/4;
              for(let i=0;i<source.data.length;i+=4){const bad=Math.max(...[0,1,2].map(k=>Math.abs(source.data[i+k]-target.data[i+k])))>32;if(bad)changed++;out.data[i]=bad?207:255;out.data[i+1]=bad?38:255;out.data[i+2]=bad?45:255;out.data[i+3]=255;}
              target.ctx.putImageData(out,0,0);return {changed,total,ratio:changed/total,diff:target.c.toDataURL('image/png')};
            },{a:original.toString('base64'),b:snapshot.toString('base64')});
            visual.snapshotPixels={changed:compare.changed,total:compare.total,ratio:compare.ratio};visual.diff=`${scenario.id}-${engine}-snapshot-diff.png`;await savePng(visual.diff,compare.diff);
            await page.evaluate(()=>window.visualLayout.cleanup());
          }
          if(record.ok||record.exportResolved){
            const exported=await page.evaluate(async({sourceBase64,pages})=>{
              const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';
              const doc=await pdfjs.getDocument({data:new Uint8Array(await window.benchOutput.arrayBuffer())}).promise;
              const image=new Image();image.src='data:image/png;base64,'+sourceBase64;await image.decode();
              const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const sourceCtx=source.getContext('2d');sourceCtx.drawImage(image,0,0);
              const joined=document.createElement('canvas');joined.width=image.width;joined.height=image.height;const ctx=joined.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,joined.width,joined.height);
              let top=0,blankPages=0;const pageImages=[];
              for(let i=1;i<=doc.numPages;i++){
                const page=await doc.getPage(i),widthPt=page.view[2]-page.view[0],density=718/((widthPt/210)*190),viewport=page.getViewport({scale:density}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
                await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
                const margin=widthPt/210*10*density,capacity=718*277/190;
                const height=pages?pages[i-1]?.end-pages[i-1]?.start:Math.min(capacity,joined.height-top);
                const body=canvas.getContext('2d').getImageData(Math.ceil(margin),Math.ceil(margin),Math.min(718,canvas.width-Math.ceil(margin)),Math.min(Math.floor(height||capacity),canvas.height-Math.ceil(margin)));
                let painted=false;for(let j=0;j<body.data.length;j+=4){if(body.data[j]<240||body.data[j+1]<240||body.data[j+2]<240){painted=true;break;}}if(!painted)blankPages++;
                if(height>0)ctx.drawImage(canvas,margin,margin,718,height,0,top,718,height);
                if(i<=3)pageImages.push(canvas.toDataURL('image/png'));
                top+=height||capacity;canvas.width=0;canvas.height=0;page.cleanup();
              }
              const a=sourceCtx.getImageData(0,0,joined.width,joined.height).data,b=ctx.getImageData(0,0,joined.width,joined.height).data;let changed=0;
              const diff=ctx.createImageData(joined.width,joined.height);
              for(let i=0;i<a.length;i+=4){const bad=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>32;if(bad)changed++;diff.data[i]=bad?207:255;diff.data[i+1]=bad?38:255;diff.data[i+2]=bad?45:255;diff.data[i+3]=255;}
              const reassembled=joined.toDataURL('image/png');ctx.putImageData(diff,0,0);const diffImage=joined.toDataURL('image/png');const pageCount=doc.numPages;await doc.destroy();return {changed,total:a.length/4,ratio:changed/(a.length/4),blankPages,pageCount,reassembled,diffImage,pageImages};
            },{sourceBase64:original.toString('base64'),pages:visual.pages});
            visual.exportPixels={changed:exported.changed,total:exported.total,ratio:exported.ratio,blankPages:exported.blankPages,pageCount:exported.pageCount};
            visual.reassembled=`${scenario.id}-${engine}-export.png`;await savePng(visual.reassembled,exported.reassembled);
            visual.exportDiff=`${scenario.id}-${engine}-export-diff.png`;await savePng(visual.exportDiff,exported.diffImage);
            visual.pageImages=[];for(let i=0;i<exported.pageImages.length;i++){const name=`${scenario.id}-${engine}-page-${i+1}.png`;await savePng(name,exported.pageImages[i]);visual.pageImages.push(name);}
          }
          delete visual.rect;visuals.push(visual);
        }
      }catch(error){record={...record,ok:false,error:String(error?.message||error)};}
      finally{record={...record,...await stopMemory()};await context.close();}
      records.push(record);await fs.writeFile(path.join(folder,'results.json'),JSON.stringify({metadata,records,visuals},null,2));
      console.log(`${scenario.id} / ${engine} / ${repeat+1}: ${record.ok?`${record.pages} pages, ${Math.round(record.totalMs)} ms`:`FAIL ${record.error?.slice(0,180)}`}`);
    }
  }
  await testInfo.attach('benchmark-results',{path:path.join(folder,'results.json'),contentType:'application/json'});
  const current=records.filter(r=>r.engine==='current');
  expect(current.length).toBeGreaterThan(0);
  for(const record of current){expect(record.ok,JSON.stringify(record)).toBe(true);expect(record.sourceUnchanged).toBe(true);expect(record.remainingSnapshots).toBe(0);expect(record.remainingCaptureFrames).toBe(0);expect(record.totalMs).toBeLessThan(metadata.budgets.currentTotalMs);expect(record.browserRssSampledPeakBytes).toBeLessThan(metadata.budgets.currentBrowserRssBytes);for(const capture of record.captures)expect(capture.pixels).toBeLessThanOrEqual(metadata.budgets.maxCanvasPixels);}
  for(const visual of visuals.filter(v=>v.engine==='current')){expect(visual.geometry.maxDelta,`${visual.scenario} geometry`).toBeLessThan(0.6);expect(visual.geometry.changedLines).toBe(0);expect(visual.geometry.unsafeBreaks).toBe(0);expect(visual.snapshotPixels.ratio,`${visual.scenario} source/snapshot`).toBeLessThan(0.005);expect(visual.exportPixels.blankPages).toBe(0);}
});
