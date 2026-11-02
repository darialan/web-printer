import {defineConfig} from '@playwright/test';
process.env.NO_PROXY=[process.env.NO_PROXY,'localhost','127.0.0.1','::1'].filter(Boolean).join(',');
process.env.no_proxy=process.env.NO_PROXY;
export default defineConfig({
 testDir:'./benchmark',testMatch:'**/*.spec.mjs',workers:1,fullyParallel:false,
 timeout:900000,expect:{timeout:15000},retries:0,
 outputDir:'.benchmark/test-results',reporter:[['list'],['html',{outputFolder:'.benchmark/playwright-report',open:'never'}]],
 use:{browserName:'chromium',viewport:{width:1440,height:1000},deviceScaleFactor:1,launchOptions:{args:['--enable-precise-memory-info']},trace:'retain-on-failure'},
 webServer:{command:'vite --host 127.0.0.1 --port 4175 --strictPort',url:'http://127.0.0.1:4175/benchmark/fixture.html',reuseExistingServer:!process.env.CI},
});
