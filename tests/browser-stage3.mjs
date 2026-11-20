import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const routePath = pathname.startsWith('/SaintScope/') ? pathname.slice('/SaintScope'.length) : pathname;
    const file = resolve(root, `.${routePath === '/' ? '/index.html' : routePath}`);
    if (!file.startsWith(root + '\\') && file !== join(root, 'index.html')) throw Error('outside root');
    const data = await readFile(file);
    response.writeHead(200, {'content-type':mime[extname(file)] || 'application/octet-stream'});
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
const report = {at:new Date().toISOString(),checks:[],requests:[],pageErrors:[]};
let browser;
try {
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const context = await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(() => localStorage.setItem('saintscope-history', JSON.stringify(['Saint Pierre'])));
  await context.route('**/ai-worker.bundle.js', route => route.fulfill({contentType:'text/javascript',body:`self.onmessage = event => {
    const name = event.data.file.name;
    if (name.startsWith('fail')) { self.postMessage({type:'error',message:'test failure'}); return; }
    setTimeout(() => self.postMessage({type:'result',candidates:[
      {id:'peter',score:0.4,cueZh:'钥匙'},
      {id:'paul',score:0.3,cueZh:'剑'},
      {id:'denis',score:0.2,cueZh:'头颅'}
    ],metrics:{inferenceMs:12,networkBytes:0}}), name.startsWith('slow') ? 600 : 15);
  };` }));
  const page = await context.newPage();
  page.on('request', request => report.requests.push({method:request.method(),url:request.url()}));
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`http://127.0.0.1:${server.address().port}/SaintScope/`);
  const image = Buffer.from([0xff,0xd8,0xff,0xd9]);
  const select = name => page.locator('#gallery').setInputFiles({name,mimeType:'image/jpeg',buffer:image});
  const check = (name, condition) => { report.checks.push({name,pass:Boolean(condition)}); if (!condition) throw Error(`Failed: ${name}`); };

  await select('first.jpg');
  await page.locator('#identify').click();
  await page.waitForFunction(() => document.getElementById('modelStatus').textContent.includes('本地分析已完成'));
  let records = await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')));
  check('candidate defaults to unconfirmed', records.length === 1 && records[0].status === 'unconfirmed' && records[0].confirmedId === null);
  check('no photo stored', !JSON.stringify(records).includes('first.jpg') && !JSON.stringify(records).includes('data:image'));
  await page.locator('#aiResults article').nth(1).getByRole('button', {name:'确认是这位圣人'}).click();
  records = await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')));
  check('candidate correction', records[0].confirmedId === 'paul' && records[0].corrected === true);
  await page.locator('#aiResults article').nth(1).getByRole('button', {name:'查看圣人资料'}).click();
  check('profile opens', await page.locator('#saintProfile h3').textContent() === '圣保罗');
  await page.locator('#aiActions').getByRole('button', {name:'都不是'}).click();
  records = await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')));
  check('none of these', records[0].status === 'uncertain' && records[0].resolution === 'none-of-these');
  await page.locator('#aiActions').getByRole('button', {name:'手动查找圣人'}).click();
  await page.locator('#search').fill('Saint George');
  await page.locator('#results').getByRole('button', {name:'确认这位圣人（手动）'}).click();
  records = await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')));
  check('manual correction', records[0].confirmedId === 'george' && records[0].corrected === true);
  await page.locator('#aiActions').getByRole('button', {name:'无法确定'}).click();
  records = await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')));
  check('unknown outcome', records[0].status === 'uncertain' && records[0].confirmedId === null);
  await page.reload();
  check('history reads after reload', await page.locator('#recognitionHistory article').count() === 1);
  check('legacy favorite preserved', (await page.locator('#history').textContent()).includes('圣彼得'));
  await page.locator('#recognitionHistory').getByRole('button', {name:'删除这条记录'}).click();
  check('single deletion', await page.locator('#recognitionHistory article').count() === 0);

  await select('slow.jpg');
  await page.locator('#identify').click();
  await page.locator('#cancelIdentify').click();
  await page.waitForTimeout(800);
  check('cancel makes no record', (await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')))).length === 0);
  await select('fail.jpg');
  await page.locator('#identify').click();
  await page.waitForFunction(() => document.getElementById('modelStatus').textContent.includes('模型运行失败'));
  check('failure makes no record', (await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')))).length === 0);
  await page.locator('#search').fill('Saint George');
  check('manual search survives failure', await page.locator('#count').textContent() === '1 条结果');
  await select('retry.jpg');
  await page.locator('#identify').click();
  await page.waitForFunction(() => document.getElementById('modelStatus').textContent.includes('本地分析已完成'));
  check('retry creates one record', (await page.evaluate(() => JSON.parse(localStorage.getItem('saintscope-recognitions-v1')))).length === 1);
  await page.locator('#clearRecognitions').click();
  check('clear all', await page.evaluate(() => localStorage.getItem('saintscope-recognitions-v1') === null));
  check('old favorites remain after clear', (await page.locator('#history').textContent()).includes('圣彼得'));
  check('no upload requests', report.requests.every(request => request.method === 'GET') && report.requests.every(request => request.url.startsWith(`http://127.0.0.1:${server.address().port}/`)));
} catch (error) {
  report.error = String(error);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  await mkdir(join(root, 'reports'), {recursive:true});
  await writeFile(join(root, 'reports', 'phase3-browser.json'), JSON.stringify(report,null,2) + '\n');
  process.stdout.write(JSON.stringify({checks:report.checks,error:report.error,pageErrors:report.pageErrors,requestCount:report.requests.length},null,2) + '\n');
  if (report.error || report.pageErrors.length || report.checks.some(check => !check.pass)) process.exitCode = 1;
}
