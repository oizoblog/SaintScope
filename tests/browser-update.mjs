import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, dirname, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sw = await readFile(join(root, 'sw.js'), 'utf8');
const previousCache = 'saintscope-v03-ai7';
const currentCache = 'saintscope-v03-ai8';
const reportPath = process.env.SAINTSCOPE_REPORT || join(root, 'reports', 'phase4-update.json');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
let servingOld = true;
const swResponses = [];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname.startsWith('/SaintScope/') ? pathname.slice('/SaintScope'.length) : pathname;
    const file = resolve(root, `.${relative === '/' ? '/index.html' : relative}`);
    if (!file.startsWith(root + sep) && file !== join(root, 'index.html')) throw Error('outside root');
    let data = await readFile(file);
    if (relative === '/sw.js') {
      swResponses.push(servingOld ? 'ai7' : 'ai8');
      if (servingOld) data = Buffer.from(sw.replace(currentCache, previousCache));
    }
    response.writeHead(200, {'content-type':mime[extname(file)] || 'application/octet-stream','cache-control':'no-store'});
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/SaintScope/`;
const profile = await mkdtemp(join(tmpdir(), 'saintscope-update-'));
const report = {at:new Date().toISOString(),url,swResponses};
let context;
try {
  context = await chromium.launchPersistentContext(profile, {headless:true,executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const page = context.pages()[0] || await context.newPage();
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForTimeout(1000);
  await page.evaluate(async () => (await caches.open('transformers-cache')).put('https://example.test/model',new Response('cached')));
  report.before = await page.evaluate(async () => ({controlled:Boolean(navigator.serviceWorker.controller),caches:await caches.keys()}));
  servingOld = false;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting), null, {timeout:15000});
  await page.locator('#updateNotice').waitFor({state:'visible'});
  report.waiting = await page.evaluate(async () => ({caches:await caches.keys(),noticeVisible:!document.getElementById('updateNotice').hidden}));
  await page.locator('#applyUpdate').click();
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    return keys.includes('saintscope-v03-ai8') && !keys.includes('saintscope-v03-ai7');
  }, null, {timeout:15000});
  await page.waitForTimeout(1000);
  report.after = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {caches:await caches.keys(),noticeHidden:document.getElementById('updateNotice').hidden,controlled:Boolean(navigator.serviceWorker.controller),waiting:registration.waiting?.state ?? null,active:registration.active?.state ?? null};
  });
  await context.setOffline(true);
  await page.reload();
  await page.locator('#search').fill('钥匙');
  report.offline = {shell:await page.locator('h1').textContent(),count:await page.locator('#count').textContent(),controlled:await page.evaluate(() => Boolean(navigator.serviceWorker.controller))};
} catch (error) { report.error = String(error); }
finally {
  await context?.close().catch(() => {});
  await new Promise(done => server.close(done));
  if (resolve(profile).startsWith(resolve(tmpdir()) + sep)) await rm(profile,{recursive:true,force:true,maxRetries:3});
  await mkdir(dirname(reportPath),{recursive:true});
  await writeFile(reportPath,JSON.stringify(report,null,2) + '\n');
  process.stdout.write(JSON.stringify(report,null,2) + '\n');
  if (report.error || !report.before?.controlled || !report.waiting?.noticeVisible || !report.after?.noticeHidden || !report.after?.controlled || !report.after?.caches.includes(currentCache) || report.after?.caches.includes(previousCache) || !report.after?.caches.includes('transformers-cache') || !report.offline?.controlled || report.offline?.count !== '1 条结果') process.exitCode = 1;
}
