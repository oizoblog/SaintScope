import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const staticRoot = process.env.SAINTSCOPE_STATIC_ROOT === 'dist' ? join(root,'dist') : root;
const cases = JSON.parse(await readFile(join(root, 'tests', 'fixtures.json'), 'utf8'));
const chosen = process.env.SAINTSCOPE_CASES ? cases.filter(item => process.env.SAINTSCOPE_CASES.split(',').includes(item.id)) : cases;
const reportFile = process.env.SAINTSCOPE_REPORT || 'phase2-browser.json';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const localStaticBytes = {};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const routePath = pathname.startsWith('/SaintScope/') ? pathname.slice('/SaintScope'.length) : pathname;
    const file = resolve(staticRoot, `.${routePath === '/' ? '/index.html' : routePath}`);
    if (!file.startsWith(staticRoot + sep) && file !== join(staticRoot, 'index.html')) throw Error('outside root');
    const data = await readFile(file);
    localStaticBytes[pathname] = (localStaticBytes[pathname] || 0) + data.length;
    response.writeHead(200, {'content-type':mime[extname(file)] || 'application/octet-stream'});
    response.end(data);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const port = server.address().port;
const report = {measuredAt:new Date().toISOString(),browser:null,cases:[],consentDialogs:[],externalRequests:[],limitations:['Main-thread JS heap excludes Worker and WASM memory; no reliable peak resident memory is available from this harness.']};
let browser;
try {
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  report.browser = await browser.version();
  const page = await browser.newPage();
  const pageErrors = [];
  const nonGetRequests = [];
  page.on('dialog', dialog => { report.consentDialogs.push(dialog.message()); dialog.accept(); });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') nonGetRequests.push({method:request.method(),url:request.url()}); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') report.externalRequests.push({method:request.method(),host:url.hostname,path:url.pathname});
  });
  await page.goto(`http://127.0.0.1:${port}/SaintScope/`, {waitUntil:'load'});
  let sampleBuffer = null;
  for (const item of chosen) {
    const imageURL = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(item.title.slice(5))}?width=500`;
    const imageResponse = await fetch(imageURL, {headers:{'user-agent':'Mozilla/5.0 (compatible; SaintScope local research benchmark)'}});
    if (!imageResponse.ok) throw Error(`Commons image ${imageResponse.status} for ${item.id}`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    sampleBuffer ??= buffer;
    await page.locator('#gallery').setInputFiles({name:`${item.id}.jpg`,mimeType:'image/jpeg',buffer});
    const started = Date.now();
    await page.locator('#identify').click();
    try {
      await page.waitForFunction(() => {
        const value = document.getElementById('modelStatus').textContent;
        return value.includes('本地分析已完成') || value.includes('模型运行失败');
      }, null, {timeout:360000});
      const result = await page.evaluate(async () => ({
        status:document.getElementById('modelStatus').textContent,
        metrics:document.getElementById('modelMetrics').textContent,
        candidates:[...document.querySelectorAll('#aiResults article h3')].map(element => element.textContent),
        jsHeapBytes:performance.memory?.usedJSHeapSize ?? null,
        storage:await navigator.storage?.estimate?.() ?? null,
      }));
      report.cases.push({id:item.id,expected:item.expected,source:item.page,license:item.license,imageBytes:buffer.length,wallMs:Date.now()-started,...result});
    } catch (error) {
      report.cases.push({id:item.id,expected:item.expected,source:item.page,license:item.license,imageBytes:buffer.length,wallMs:Date.now()-started,error:String(error),status:await page.locator('#modelStatus').textContent()});
      await page.locator('#cancelIdentify').click().catch(() => {});
    }
  }
  if (sampleBuffer) {
    await page.locator('#gallery').setInputFiles({name:'cancel-test.jpg',mimeType:'image/jpeg',buffer:sampleBuffer});
    await page.locator('#identify').click();
    await page.locator('#cancelIdentify').click();
    await page.waitForTimeout(1500);
    const cancelledStatus = await page.locator('#modelStatus').textContent();
    const cancelledResults = await page.locator('#aiResults').textContent();
    await page.locator('#identify').click();
    await page.waitForFunction(() => document.getElementById('modelStatus').textContent.includes('本地分析已完成'), null, {timeout:360000});
    report.cancelTest = {cancelledStatus,cancelledResults,retryStatus:await page.locator('#modelStatus').textContent(),retryMetrics:await page.locator('#modelMetrics').textContent()};
    const failureContext = await browser.newContext({serviceWorkers:'block'});
    await failureContext.route('https://huggingface.co/**', route => route.abort());
    const failurePage = await failureContext.newPage();
    failurePage.on('dialog', dialog => dialog.accept());
    await failurePage.goto(`http://127.0.0.1:${port}/SaintScope/`, {waitUntil:'load'});
    await failurePage.locator('#gallery').setInputFiles({name:'failure-test.jpg',mimeType:'image/jpeg',buffer:sampleBuffer});
    await failurePage.locator('#identify').click();
    try {
      await failurePage.waitForFunction(() => document.getElementById('modelStatus').textContent.includes('模型运行失败'), null, {timeout:30000});
      report.failureTest = {status:await failurePage.locator('#modelStatus').textContent(),manualResults:await failurePage.locator('#count').textContent()};
    } catch (error) {
      report.failureTest = {error:String(error),status:await failurePage.locator('#modelStatus').textContent()};
    }
    await failureContext.close();
  }
  report.pageErrors = pageErrors;
  report.nonGetRequests = nonGetRequests;
} catch (error) {
  report.harnessError = String(error);
} finally {
  await browser?.close();
  await new Promise(resolveDone => server.close(resolveDone));
  report.localStaticBytes = localStaticBytes;
  await mkdir(join(root, 'reports'), {recursive:true});
  await writeFile(join(root, 'reports', reportFile), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.harnessError || report.cases.length !== chosen.length || report.cases.some(item => item.error || !item.status?.includes('本地分析已完成')) || report.pageErrors?.length || report.nonGetRequests?.length || !report.cancelTest?.retryStatus?.includes('本地分析已完成') || !report.failureTest?.status?.includes('模型运行失败')) process.exitCode = 1;
}
