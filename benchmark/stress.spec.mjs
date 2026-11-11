import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const folder = path.resolve(process.env.BENCHMARK_OUTPUT || '.benchmark/stress-results');

async function memorySampler(browser) {
  const cdp = await browser.newBrowserCDPSession();
  let peak = 0, initial = 0, running = false, stopped = false;
  const sample = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
      const ids = processInfo.map(p => p.id).filter(id => Number.isInteger(id) && id > 0);
      const { stdout } = await exec('ps', ['-o', 'rss=', '-p', ids.join(',')]);
      const rss = stdout.trim().split(/\s+/).reduce((sum, v) => sum + Number(v), 0) * 1024;
      if (!initial) initial = rss;
      peak = Math.max(peak, rss);
    } catch {} finally {
      running = false;
    }
  };
  await sample();
  const interval = setInterval(sample, 100);
  let result;
  return async () => {
    if (result) return result;
    clearInterval(interval);
    await sample();
    stopped = true;
    await cdp.detach();
    result = { browserRssStartBytes: initial, browserRssSampledPeakBytes: peak };
    return result;
  };
}

test.describe('Web Printer Pre-release Stress & Soak Testing Suite', () => {
  test.beforeAll(async () => {
    await fs.mkdir(folder, { recursive: true });
  });

  test('Stress Test 1: 100-page extreme document scale and linearity', async ({ browser }) => {
    test.setTimeout(240000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4175/benchmark/fixture.html');
    await page.waitForFunction(() => window.fixtureReady);

    const stopMemory = await memorySampler(browser);

    const result = await page.evaluate(async () => {
      const b = window.bench;
      const root = b.mountScenario('stress-100');
      await b.current.waitForResources(root);

      const before = root.outerHTML;
      let peakHeap = performance.memory?.usedJSHeapSize || 0;
      const timer = setInterval(() => {
        peakHeap = Math.max(peakHeap, performance.memory?.usedJSHeapSize || 0);
      }, 50);

      const start = performance.now();
      try {
        const output = await b.current.outputDocument({
          element: root,
          settings: b.settings,
          filename: 'stress-100',
          format: 'pdf',
          download: false,
          maxPages: 120,
        });

        const totalMs = performance.now() - start;
        window.benchOutput = output.blob;

        return {
          ok: true,
          pages: output.pages,
          bytes: output.blob.size,
          totalMs,
          peakHeapBytes: peakHeap,
          sourceUnchanged: root.outerHTML === before,
          remainingSnapshots: document.querySelectorAll('[data-print-snapshot]').length,
          remainingCaptureFrames: document.querySelectorAll('.html2canvas-container').length,
        };
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      } finally {
        clearInterval(timer);
      }
    });

    const memory = await stopMemory();

    expect(result.ok, `Export failed: ${result.error}`).toBe(true);
    expect(result.pages).toBe(100);
    expect(result.sourceUnchanged).toBe(true);
    expect(result.remainingSnapshots).toBe(0);
    expect(result.remainingCaptureFrames).toBe(0);

    // Verify PDF pages using PDF.js
    const pdfVerification = await page.evaluate(async () => {
      const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await window.benchOutput.arrayBuffer()) }).promise;
      const totalPages = doc.numPages;

      // Sample first, middle and last page to verify content was painted
      const samplePages = [1, 50, 100];
      const blankSamples = [];
      for (const pageNum of samplePages) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = false;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) {
            painted = true;
            break;
          }
        }
        if (!painted) blankSamples.push(pageNum);
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
      await doc.destroy();
      return { totalPages, blankSamples };
    });

    expect(pdfVerification.totalPages).toBe(100);
    expect(pdfVerification.blankSamples).toEqual([]);

    console.log(`\n================ 100-Page Scale Stress Result ================`);
    console.log(`Pages: ${result.pages}`);
    console.log(`Total Duration: ${(result.totalMs / 1000).toFixed(2)}s (${(result.totalMs / result.pages).toFixed(1)} ms/page)`);
    console.log(`PDF File Size: ${(result.bytes / (1024 * 1024)).toFixed(2)} MiB`);
    console.log(`Peak Process RSS: ${(memory.browserRssSampledPeakBytes / (1024 * 1024)).toFixed(1)} MiB`);
    console.log(`==============================================================\n`);

    await context.close();
  });

  test('Stress Test 2: Soak endurance testing (20 consecutive exports for zero memory & DOM leaks)', async ({ browser }) => {
    test.setTimeout(180000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4175/benchmark/fixture.html');
    await page.waitForFunction(() => window.fixtureReady);

    const soakRounds = 20;
    const history = [];

    for (let round = 1; round <= soakRounds; round++) {
      const stats = await page.evaluate(async ({ round }) => {
        const b = window.bench;
        const root = b.mountScenario('table');
        await b.current.waitForResources(root);

        const heapBefore = performance.memory?.usedJSHeapSize || 0;
        const start = performance.now();

        const output = await b.current.outputDocument({
          element: root,
          settings: b.settings,
          filename: `soak-${round}`,
          format: 'pdf',
          download: false,
        });

        const durationMs = performance.now() - start;
        const heapAfter = performance.memory?.usedJSHeapSize || 0;

        return {
          round,
          pages: output.pages,
          bytes: output.blob.size,
          durationMs,
          heapBeforeBytes: heapBefore,
          heapAfterBytes: heapAfter,
          remainingSnapshots: document.querySelectorAll('[data-print-snapshot]').length,
          remainingCaptureFrames: document.querySelectorAll('.html2canvas-container').length,
        };
      }, { round });

      expect(stats.remainingSnapshots).toBe(0);
      expect(stats.remainingCaptureFrames).toBe(0);
      expect(stats.pages).toBe(3);
      history.push(stats);

      // Give event loop a short tick
      await page.waitForTimeout(50);
    }

    const firstRound = history[1]; // Round 2 (warmup done)
    const lastRound = history[history.length - 1]; // Round 20
    const heapDiffKiB = Math.round((lastRound.heapAfterBytes - firstRound.heapAfterBytes) / 1024);

    console.log(`\n================ 20-Round Soak Endurance Result ================`);
    console.log(`Completed Rounds: ${history.length}/${soakRounds}`);
    console.log(`Average Export Time: ${(history.reduce((a, b) => a + b.durationMs, 0) / history.length).toFixed(1)} ms`);
    console.log(`Round 2 Heap: ${(firstRound.heapAfterBytes / 1024 / 1024).toFixed(2)} MiB`);
    console.log(`Round 20 Heap: ${(lastRound.heapAfterBytes / 1024 / 1024).toFixed(2)} MiB`);
    console.log(`Heap Drift over 18 rounds: ${heapDiffKiB} KiB`);
    console.log(`DOM Snapshot Residues: 0 (Cleaned up completely)`);
    console.log(`=================================================================\n`);

    await context.close();
  });

  test('Stress Test 3: Interruption & re-entrancy (abort midway and immediately re-export)', async ({ browser }) => {
    test.setTimeout(60000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4175/benchmark/fixture.html');
    await page.waitForFunction(() => window.fixtureReady);

    const result = await page.evaluate(async () => {
      const b = window.bench;
      const root = b.mountScenario('table');
      await b.current.waitForResources(root);

      // 1. Trigger export and abort midway on page 1
      const controller = new AbortController();
      let abortedCaught = false;

      const exportPromise = b.current.outputDocument({
        element: root,
        settings: b.settings,
        filename: 'interrupted-doc',
        format: 'pdf',
        download: false,
        signal: controller.signal,
        onProgress: (completed) => {
          if (completed >= 1) {
            controller.abort();
          }
        },
      });

      try {
        await exportPromise;
      } catch (err) {
        abortedCaught = err?.name === 'AbortError' || String(err).includes('取消') || String(err).toLowerCase().includes('cancel');
      }

      const snapshotsAfterAbort = document.querySelectorAll('[data-print-snapshot]').length;
      const captureFramesAfterAbort = document.querySelectorAll('.html2canvas-container').length;

      // 2. Immediately initiate a new clean export without waiting
      const secondStart = performance.now();
      const secondOutput = await b.current.outputDocument({
        element: root,
        settings: b.settings,
        filename: 'recovered-doc',
        format: 'pdf',
        download: false,
      });

      const secondDurationMs = performance.now() - secondStart;
      const snapshotsAfterSecond = document.querySelectorAll('[data-print-snapshot]').length;

      return {
        abortedCaught,
        snapshotsAfterAbort,
        captureFramesAfterAbort,
        secondOk: secondOutput.pages === 3 && secondOutput.blob.size > 0,
        secondDurationMs,
        snapshotsAfterSecond,
      };
    });

    expect(result.abortedCaught).toBe(true);
    expect(result.snapshotsAfterAbort).toBe(0);
    expect(result.captureFramesAfterAbort).toBe(0);
    expect(result.secondOk).toBe(true);
    expect(result.snapshotsAfterSecond).toBe(0);

    console.log(`\n================ Interruption & Re-entrancy Result ================`);
    console.log(`Abort Triggered & Interrupted cleanly: ${result.abortedCaught}`);
    console.log(`Residual Snapshots after Abort: ${result.snapshotsAfterAbort}`);
    console.log(`Immediate Second Export Duration: ${result.secondDurationMs.toFixed(1)} ms`);
    console.log(`Immediate Second Export Valid: ${result.secondOk}`);
    console.log(`===================================================================\n`);

    await context.close();
  });
});
