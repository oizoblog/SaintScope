import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const staticRoot = process.env.SAINTSCOPE_STATIC_ROOT === 'dist' ? join(root,'dist') : root;
const reportFile = process.env.SAINTSCOPE_REPORT || 'phase4-offline.json';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const requests = [];
const server = createServer(async (request, response) => {
  requests.push({url:request.url,method:request.method});
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = path.startsWith('/SaintScope/') ? path.slice('/SaintScope'.length) : path;
    const file = resolve(staticRoot, `.${relative === '/' ? '/index.html' : relative}`);
    if (!file.startsWith(staticRoot + sep) && file !== join(staticRoot, 'index.html')) throw Error('outside root');
    const data = await readFile(file);
    response.writeHead(200, {'content-type':mime[extname(file)] || 'application/octet-stream'});
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/SaintScope/`;
const profile = await mkdtemp(join(tmpdir(), 'saintscope-offline-'));
const report = {at:new Date().toISOString(),browser:null,url,staticRoot:process.env.SAINTSCOPE_STATIC_ROOT || '.',steps:[],serverRequests:requests,networkEvents:[]};
let context;
let phase = 'online';
const launch = async () => {
  context = await chromium.launchPersistentContext(profile, {headless:true,executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const safeURL = request => { const url = new URL(request.url()); return `${url.origin}${url.pathname}`; };
  context.on('requestfailed', request => report.networkEvents.push({phase,event:'failed',url:safeURL(request),error:request.failure()?.errorText}));
  context.on('request', request => { if (request.url().startsWith('https://')) report.networkEvents.push({phase,event:'request',url:safeURL(request)}); });
  const page = context.pages()[0] || await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  return page;
};
const imageResponse = await fetch('https://commons.wikimedia.org/wiki/Special:Redirect/file/Stgeorge-dragon.jpg?width=500', {headers:{'user-agent':'Mozilla/5.0 (compatible; SaintScope offline benchmark)'}});
if (!imageResponse.ok) throw Error(`Test image download failed: ${imageResponse.status}`);
const image = Buffer.from(await imageResponse.arrayBuffer());
const select = page => page.locator('#gallery').setInputFiles({name:'george.jpg',mimeType:'image/jpeg',buffer:image});
const identify = async page => {
  await select(page);
  await page.locator('#identify').click();
  await page.waitForFunction(() => {
    const status = document.getElementById('modelStatus').textContent;
    return status.includes('本地分析已完成') || status.includes('模型运行失败');
  }, null, {timeout:180000});
  return {status:await page.locator('#modelStatus').textContent(),metrics:await page.locator('#modelMetrics').textContent(),candidates:await page.locator('#aiResults article h3').allTextContents()};
};
try {
  let page = await launch();
  report.browser = await context.browser()?.version();
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  report.steps.push({name:'first online open',shell:await page.locator('h1').textContent(),controlled:await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),caches:await page.evaluate(() => caches.keys())});
  report.steps.push({name:'first model download',...(await identify(page)),caches:await page.evaluate(() => caches.keys()),modelCacheFiles:await page.evaluate(async () => (await (await caches.open('transformers-cache')).keys()).map(request => request.url))});
  await context.close();
  phase = 'offline-reopen';
  page = await launch();
  await context.setOffline(true);
  try {
    await page.goto(url);
    await page.locator('#search').fill('钥匙');
    report.steps.push({name:'offline reopen and manual search',shell:await page.locator('h1').textContent(),count:await page.locator('#count').textContent(),controlled:await page.evaluate(() => Boolean(navigator.serviceWorker.controller))});
    report.steps.push({name:'offline AI after browser restart',...(await identify(page))});
    const deleted = await page.evaluate(async () => {
      const names = await caches.keys();
      for (const name of names.filter(name => name === 'transformers-cache')) await caches.delete(name);
      return names;
    });
    await page.reload();
    phase = 'offline-cleared-model';
    report.steps.push({name:'model cache deleted',previousCaches:deleted,caches:await page.evaluate(() => caches.keys())});
    report.steps.push({name:'offline AI after model cache deletion',...(await identify(page))});
    await page.evaluate(async () => { for (const name of await caches.keys()) await caches.delete(name); });
    await context.close();
    phase = 'offline-cleared-all';
    page = await launch();
    await context.setOffline(true);
    try {
      await page.goto(url, {timeout:15000});
      report.steps.push({name:'offline after clearing all caches',shell:await page.locator('h1').textContent()});
    } catch (error) {
      report.steps.push({name:'offline after clearing all caches',error:String(error)});
    }
  } catch (error) { report.error = String(error); }
} catch (error) { report.error = String(error); }
finally {
  await context?.close().catch(() => {});
  await new Promise(done => server.close(done));
  const safeRoot = resolve(tmpdir()) + sep;
  if (resolve(profile).startsWith(safeRoot)) await rm(profile, {recursive:true,force:true,maxRetries:3});
  await mkdir(join(root, 'reports'), {recursive:true});
  await writeFile(join(root, 'reports', reportFile), JSON.stringify(report,null,2) + '\n');
  process.stdout.write(JSON.stringify(report,null,2) + '\n');
  const step = name => report.steps.find(item => item.name === name);
  const cachedOfflineRequests = report.networkEvents.filter(item => item.phase === 'offline-reopen' && item.event === 'request');
  if (report.error || !step('first online open')?.controlled || !step('first model download')?.status?.includes('本地分析已完成') || !step('offline reopen and manual search')?.controlled || !step('offline reopen and manual search')?.count?.includes('1 条结果') || !step('offline AI after browser restart')?.status?.includes('本地分析已完成') || !step('offline AI after browser restart')?.metrics?.includes('网络读取：0.0 MiB') || !step('offline AI after model cache deletion')?.status?.includes('模型运行失败') || !step('offline after clearing all caches')?.error || cachedOfflineRequests.length) process.exitCode = 1;
}
