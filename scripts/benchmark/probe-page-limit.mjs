import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function sampleRss(cdp) {
  try {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    const ids = processInfo.map(p => p.id).filter(id => Number.isInteger(id) && id > 0);
    const { stdout } = await exec('ps', ['-o', 'rss=', '-p', ids.join(',')]);
    return stdout.trim().split(/\s+/).reduce((sum, v) => sum + Number(v), 0) * 1024;
  } catch {
    return 0;
  }
}

async function runPhysicalLimitTest(targetPages) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-precise-memory-info', '--disable-extensions', '--no-sandbox'],
  });

  const cdp = await browser.newBrowserCDPSession();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  let peakRss = 0;
  const timer = setInterval(async () => {
    const rss = await sampleRss(cdp);
    if (rss > peakRss) peakRss = rss;
  }, 100);

  try {
    await page.goto('http://127.0.0.1:4175/benchmark/fixture.html');
    await page.waitForFunction(() => window.fixtureReady);

    console.log(`\n>>> [Physical Limit Probe] Testing ${targetPages} pages (NO artificial height/char/page limits)...`);
    const start = Date.now();

    const result = await page.evaluate(async ({ targetPages }) => {
      const b = window.bench;
      const root = b.mountScenario(`long-${targetPages}`);
      await b.current.waitForResources(root);

      try {
        const output = await b.current.outputDocument({
          element: root,
          settings: b.settings,
          filename: `probe-phys-${targetPages}`,
          format: 'pdf',
          download: false,
          maxPages: targetPages + 100,
          maxHeight: Infinity,
          maxCharacters: Infinity,
        });
        return {
          ok: true,
          pages: output.pages,
          bytes: output.blob.size,
          durationMs: output.totalMs,
        };
      } catch (err) {
        return {
          ok: false,
          error: String(err?.message || err),
        };
      }
    }, { targetPages });

    const elapsedMs = Date.now() - start;
    clearInterval(timer);

    return {
      targetPages,
      ...result,
      elapsedMs,
      peakRssMiB: (peakRss / (1024 * 1024)).toFixed(1),
    };
  } finally {
    clearInterval(timer);
    await cdp.detach().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  console.log('================================================================');
  console.log('   Web Printer v3 Pure Physical Stress Limit Probe (No Limits)');
  console.log('================================================================');

  // Let us test 200 pages, 300 pages, and beyond to find the true ceiling!
  const probePages = [200, 300];

  for (const pages of probePages) {
    const res = await runPhysicalLimitTest(pages);
    console.log(`\nResult for ${pages} Pages:`);
    console.log(`  Success: ${res.ok}`);
    if (res.ok) {
      console.log(`  Pages Generated: ${res.pages}`);
      console.log(`  Total Duration: ${(res.durationMs / 1000).toFixed(1)}s (${(res.durationMs / res.pages).toFixed(1)} ms/page)`);
      console.log(`  PDF Blob Size: ${(res.bytes / 1024 / 1024).toFixed(2)} MiB`);
      console.log(`  Chromium Peak RSS: ${res.peakRssMiB} MiB`);
    } else {
      console.log(`  Failed at ${pages} pages! Error: ${res.error}`);
      console.log(`  Elapsed until failure: ${(res.elapsedMs / 1000).toFixed(1)}s`);
      break;
    }
  }
}

main().catch(err => {
  console.error('Probe crashed:', err);
  process.exit(1);
});
