'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const saints = require('../saints.js');
const prompts = require('../prompts.js');
const RecognitionHistory = require('../recognition-history.js');
const root = path.join(__dirname, '..');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.value = '';
    this.textContent = '';
    this.hidden = false;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  dispatch(name, event = {}) { this.listeners[name]?.({target:this, ...event}); }
}

function app(initialHistory, options = {}) {
  const ids = ['camera', 'gallery', 'search', 'reset', 'clearHistory', 'clearRecognitions', 'recognitionHistory', 'storageStatus', 'resolutionStatus', 'aiActionFeedback', 'aiActions', 'aiTitle', 'saintProfile', 'profileSection', 'chips', 'count', 'results', 'history', 'preview', 'photoStatus', 'identify', 'cancelIdentify', 'modelStatus', 'modelProgress', 'aiResults', 'modelMetrics'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  const storage = new Map();
  if (initialHistory) storage.set('saintscope-history', JSON.stringify(initialHistory));
  if (options.initialRecognitions) storage.set(RecognitionHistory.KEY, JSON.stringify(options.initialRecognitions));
  const revoked = [];
  const storageWrites = [];
  const workers = [];
  class TestWorker {
    constructor(url, options) { this.url = url; this.options = options; this.terminated = false; workers.push(this); }
    postMessage(data) { this.lastMessage = data; }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage?.({data}); }
  }
  const context = {
    SAINTS: saints, SAINT_PROMPTS: prompts, RecognitionHistory, Worker: TestWorker,
    document: {getElementById:id => elements[id], createElement:tag => new Element(tag)},
    localStorage: {
      getItem:key => { if (options.storageUnavailable) throw Error('storage unavailable'); return storage.get(key) ?? null; },
      setItem:(key,value) => { if (options.storageUnavailable || (options.storageFull && key === RecognitionHistory.KEY)) throw Error('quota'); storage.set(key,value); storageWrites.push(key); },
      removeItem:key => { if (options.storageUnavailable) throw Error('storage unavailable'); storage.delete(key); }
    },
    URL: {createObjectURL:file => `blob:${file.name}`, revokeObjectURL:url => revoked.push(url)},
    navigator: {}, location: {protocol:'file:'}, confirm:() => options.confirm ?? true, alert:message => {throw Error(message)}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  return {elements, storage, storageWrites, revoked, workers};
}

test('24 records have stable unique IDs and unverified editorial status', () => {
  assert.equal(saints.length, 24);
  assert.equal(new Set(saints.map(s => s.id)).size, 24);
  for (const saint of saints) {
    assert.match(saint.id, /^[a-z]+(?:-[a-z]+)*$/);
    for (const field of ['nameZh','nameFr','nameIntl','bio','feast','historical','legend']) {
      assert.ok(saint[field], `${saint.id}: ${field}`);
    }
    assert.ok(saint.tags.length, saint.id);
    assert.equal(saint.verification.status, 'unverified');
    assert.deepEqual(saint.verification.sources, []);
  }
});

test('Chinese page, manifest and offline shell contain the new data file', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(html, /<html lang="zh-CN">/);
  assert.equal(manifest.lang, 'zh-CN');
  for (const label of ['拍照识别','从相册选择','开始识别','可能的圣人','圣人简介','识别依据','圣人象征物','圣人纪念日','我的识别记录','无法确定身份']) {
    assert.ok(html.includes(label) || fs.readFileSync(path.join(root, 'app.js'), 'utf8').includes(label), label);
  }
  assert.ok(sw.includes("'./saints.js'"));
  assert.ok(html.indexOf('saints.js') < html.indexOf('app.js'));
  assert.match(html, /id="aiActionFeedback"[^>]*aria-live="polite"/);
});

test('symbol filtering, name search and reset still work', () => {
  const {elements} = app();
  assert.equal(elements.count.textContent, '24 条结果');
  const key = elements.chips.children.find(chip => chip.textContent === '钥匙');
  key.dispatch('click');
  assert.equal(elements.count.textContent, '1 条结果');
  assert.equal(elements.results.children[0].children[0].textContent, '圣彼得');
  elements.search.value = 'Saint Paul';
  elements.search.dispatch('input');
  assert.equal(elements.count.textContent, '0 条结果');
  assert.match(elements.results.children[0].textContent, /无法确定身份/);
  elements.reset.dispatch('click');
  assert.equal(elements.count.textContent, '24 条结果');
  assert.equal(elements.search.value, '');
});

test('legacy French-name history remains visible and saves stable IDs', () => {
  const {elements, storage} = app(['Saint Pierre']);
  assert.equal(elements.history.children[0].textContent, '圣彼得');
  const peter = elements.results.children.find(item => item.children[0].textContent === '圣彼得');
  peter.children.at(-1).dispatch('click');
  assert.deepEqual(JSON.parse(storage.get('saintscope-history')), ['peter']);
  elements.clearHistory.dispatch('click');
  assert.equal(storage.has('saintscope-history'), false);
});

test('photo preview stays local and revokes the previous object URL', () => {
  const {elements, revoked} = app();
  elements.gallery.dispatch('change', {target:{files:[{name:'one.jpg',type:'image/jpeg'}],value:'one.jpg'}});
  assert.equal(elements.preview.src, 'blob:one.jpg');
  assert.equal(elements.preview.hidden, false);
  elements.camera.dispatch('change', {target:{files:[{name:'two.jpg',type:'image/jpeg'}],value:'two.jpg'}});
  assert.deepEqual(revoked, ['blob:one.jpg']);
  assert.equal(elements.preview.src, 'blob:two.jpg');
});

test('English prompts cover every stable saint ID with distinct visual descriptions', () => {
  assert.equal(prompts.length, saints.length);
  assert.deepEqual(new Set(prompts.map(item => item.id)), new Set(saints.map(item => item.id)));
  for (const item of prompts) {
    assert.ok(item.prompts.length >= 2, item.id);
    for (const [text, cueZh] of item.prompts) {
      assert.ok(text.length > 25 && cueZh.length > 3, item.id);
    }
  }
});

test('model starts only after click, reuses worker and renders at most three ranked candidates', () => {
  const {elements, workers} = app();
  assert.equal(workers.length, 0);
  elements.gallery.dispatch('change', {target:{files:[{name:'photo.jpg',type:'image/jpeg'}],value:'photo.jpg'}});
  elements.identify.dispatch('click');
  assert.equal(workers.length, 1);
  assert.equal(workers[0].options.type, 'module');
  assert.equal(workers[0].lastMessage.entries.length, 24);
  workers[0].emit({type:'loaded',initMs:1000,networkBytes:100});
  workers[0].emit({type:'result',candidates:[
    {id:'peter',score:0.4,cueZh:'钥匙'},
    {id:'denis',score:0.3,cueZh:'头颅'},
    {id:'george',score:0.2,cueZh:'龙'},
    {id:'roch',score:0.1,cueZh:'狗'}
  ],metrics:{inferenceMs:2000,networkBytes:300}});
  assert.equal(elements.aiResults.children.length, 4); // three candidates and a caution
  assert.match(elements.aiResults.children[0].children[0].textContent, /圣彼得/);
  assert.ok(elements.aiResults.children[0].children.some(child => child.textContent.includes('余弦相似度')));
  assert.match(elements.modelMetrics.textContent, /本次推理：2000 毫秒/);
  elements.identify.dispatch('click');
  assert.equal(workers.length, 1);
});

test('cancellation terminates the worker and ignores a late result', () => {
  const {elements, workers} = app();
  elements.camera.dispatch('change', {target:{files:[{name:'photo.jpg',type:'image/jpeg'}],value:'photo.jpg'}});
  elements.identify.dispatch('click');
  const old = workers[0];
  elements.cancelIdentify.dispatch('click');
  assert.equal(old.terminated, true);
  old.emit({type:'result',candidates:[{id:'peter',score:0.9,cueZh:'钥匙'}],metrics:{}});
  assert.match(elements.aiResults.children[0].textContent, /识别已取消/);
  elements.identify.dispatch('click');
  assert.equal(workers.length, 2);
});

test('download progress and model errors leave manual search available', () => {
  const {elements, workers} = app();
  elements.gallery.dispatch('change', {target:{files:[{name:'photo.jpg',type:'image/jpeg'}],value:'photo.jpg'}});
  elements.identify.dispatch('click');
  workers[0].emit({type:'progress',percent:37,networkBytes:1048576});
  assert.equal(elements.modelProgress.value, 37);
  assert.match(elements.modelStatus.textContent, /1.0 MiB/);
  workers[0].emit({type:'error',message:'Failed to fetch'});
  assert.equal(workers[0].terminated, true);
  assert.match(elements.modelStatus.textContent, /手动搜索/);
  assert.equal(elements.count.textContent, '24 条结果');
});

test('declining model download starts no worker or recognition record', () => {
  const {elements, workers, storage} = app(null, {confirm:false});
  elements.gallery.dispatch('change', {target:{files:[{name:'test.jpg',type:'image/jpeg'}],value:'test.jpg'}});
  elements.identify.dispatch('click');
  assert.equal(workers.length, 0);
  assert.equal(storage.has(RecognitionHistory.KEY), false);
  assert.match(elements.modelStatus.textContent, /已取消模型下载/);
});

function finishModel(elements, workers, candidates = [{id:'peter',score:0.41,cueZh:'钥匙'},{id:'paul',score:0.32,cueZh:'剑'}]) {
  elements.gallery.dispatch('change', {target:{files:[{name:'test.jpg',type:'image/jpeg'}],value:'test.jpg'}});
  elements.identify.dispatch('click');
  workers.at(-1).emit({type:'result',candidates,metrics:{inferenceMs:100,networkBytes:200}});
}

test('each completed model run is unconfirmed and stores IDs without a photo', () => {
  const {elements, workers, storage} = app(['Saint Pierre']);
  finishModel(elements, workers);
  const records = JSON.parse(storage.get(RecognitionHistory.KEY));
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'unconfirmed');
  assert.equal(records[0].confirmedId, null);
  assert.equal(records[0].corrected, false);
  assert.deepEqual(records[0].candidates.map(x => x.id), ['peter','paul']);
  assert.equal(typeof records[0].at, 'string');
  assert.match(records[0].modelVersion, /clip-vit-base-patch32/);
  assert.deepEqual(Object.keys(records[0]).sort(), ['at','candidates','confirmedId','corrected','id','modelVersion','resolution','status']);
  assert.ok(!storage.get(RecognitionHistory.KEY).includes('test.jpg'));
  assert.equal(elements.resolutionStatus.textContent, '身份尚未确认。这不是确定的身份识别结果。');
  assert.equal(elements.history.children[0].textContent, '圣彼得');
});

test('candidate confirmation and changed choice record correction without editorial verification', () => {
  const {elements, workers, storage} = app();
  finishModel(elements, workers);
  const first = elements.aiResults.children[0].children.find(child => child.textContent === '确认是这位圣人');
  first.dispatch('click');
  let record = JSON.parse(storage.get(RecognitionHistory.KEY))[0];
  assert.equal(record.status, 'confirmed');
  assert.equal(record.confirmedId, 'peter');
  assert.equal(record.corrected, false);
  assert.match(elements.resolutionStatus.textContent, /人工选择，不代表史料已核实/);
  const second = elements.aiResults.children[1].children.find(child => child.textContent === '确认是这位圣人');
  second.dispatch('click');
  record = JSON.parse(storage.get(RecognitionHistory.KEY))[0];
  assert.equal(record.confirmedId, 'paul');
  assert.equal(record.corrected, true);
  const profile = elements.aiResults.children[1].children.find(child => child.textContent === '查看圣人资料');
  profile.dispatch('click');
  assert.equal(elements.profileSection.hidden, false);
  assert.equal(elements.saintProfile.children[0].textContent, '圣保罗');
});

test('none of these, manual search correction and unknown remain separate outcomes', () => {
  const {elements, workers, storage} = app();
  finishModel(elements, workers);
  elements.aiActions.children.find(child => child.textContent === '都不是').dispatch('click');
  let record = JSON.parse(storage.get(RecognitionHistory.KEY))[0];
  assert.equal(record.status, 'uncertain');
  assert.equal(record.resolution, 'none-of-these');
  elements.search.value = 'Saint George';
  elements.search.dispatch('input');
  const george = elements.results.children[0];
  george.children.find(child => child.textContent === '确认这位圣人（手动）').dispatch('click');
  record = JSON.parse(storage.get(RecognitionHistory.KEY))[0];
  assert.equal(record.confirmedId, 'george');
  assert.equal(record.status, 'confirmed');
  assert.equal(record.corrected, true);
  elements.aiActions.children.find(child => child.textContent === '无法确定').dispatch('click');
  record = JSON.parse(storage.get(RecognitionHistory.KEY))[0];
  assert.equal(record.status, 'uncertain');
  assert.equal(record.resolution, 'unknown');
  assert.equal(record.confirmedId, null);
});

test('action feedback is immediate, idempotent, restored, and reset for a new photo', () => {
  const {elements, workers, storage, storageWrites} = app();
  finishModel(elements, workers);
  assert.equal(elements.aiActionFeedback.hidden, true);
  const noneButton = elements.aiActions.children[0];
  noneButton.dispatch('click');
  assert.equal(elements.aiActionFeedback.textContent, '已标记『都不是』，身份仍未确定。');
  assert.equal(elements.aiActionFeedback.hidden, false);
  assert.equal(elements.aiActions.children[0].disabled, true);
  const writes = storageWrites.length;
  noneButton.dispatch('click');
  assert.equal(storageWrites.length, writes);
  let records = JSON.parse(storage.get(RecognitionHistory.KEY));
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'uncertain');
  assert.equal(records[0].resolution, 'none-of-these');
  assert.equal(records[0].confirmedId, null);
  assert.deepEqual(records[0].candidates.map(candidate => candidate.id), ['peter', 'paul']);
  assert.match(records[0].modelVersion, /clip-vit-base-patch32/);
  assert.ok(!storage.get(RecognitionHistory.KEY).includes('test.jpg'));

  const reopened = app(null, {initialRecognitions:records});
  assert.equal(reopened.elements.aiActionFeedback.textContent, '已标记『都不是』，身份仍未确定。');
  assert.equal(reopened.elements.aiActionFeedback.hidden, false);
  assert.equal(reopened.elements.aiActions.children[0].disabled, true);
  const unknownButton = reopened.elements.aiActions.children[2];
  unknownButton.dispatch('click');
  assert.equal(reopened.elements.aiActionFeedback.textContent, '已标记『无法确定』，识别结果尚未确认。');
  assert.equal(reopened.elements.aiActions.children[2].disabled, true);
  const reopenedWrites = reopened.storageWrites.length;
  unknownButton.dispatch('click');
  assert.equal(reopened.storageWrites.length, reopenedWrites);
  records = JSON.parse(reopened.storage.get(RecognitionHistory.KEY));
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'uncertain');
  assert.equal(records[0].resolution, 'unknown');
  assert.equal(records[0].confirmedId, null);
  assert.ok(!reopened.storage.get(RecognitionHistory.KEY).includes('test.jpg'));

  const reloaded = app(null, {initialRecognitions:records});
  assert.equal(reloaded.elements.aiActionFeedback.textContent, '已标记『无法确定』，识别结果尚未确认。');
  assert.equal(reloaded.elements.aiActions.children[2].disabled, true);
  reloaded.elements.gallery.dispatch('change', {target:{files:[{name:'next.jpg',type:'image/jpeg'}],value:'next.jpg'}});
  assert.equal(reloaded.elements.aiActionFeedback.hidden, true);
  assert.equal(reloaded.elements.aiActions.children.length, 0);
  reloaded.elements.identify.dispatch('click');
  assert.equal(reloaded.elements.aiActionFeedback.hidden, true);
  reloaded.workers[0].emit({type:'result',candidates:[{id:'denis',score:0.3,cueZh:'头颅'}],metrics:{}});
  assert.equal(reloaded.elements.aiActionFeedback.hidden, true);
  assert.equal(reloaded.elements.aiActions.children[0].disabled, false);
  assert.equal(JSON.parse(reloaded.storage.get(RecognitionHistory.KEY)).length, 2);
});

test('recognition history reads, deletes one, clears all, and preserves old favorites', () => {
  const {elements, workers, storage} = app(['Saint Pierre']);
  finishModel(elements, workers);
  finishModel(elements, workers);
  assert.equal(elements.recognitionHistory.children.length, 2);
  assert.equal(JSON.parse(storage.get(RecognitionHistory.KEY)).length, 2);
  elements.recognitionHistory.children[0].children.find(child => child.textContent === '删除这条记录').dispatch('click');
  assert.equal(JSON.parse(storage.get(RecognitionHistory.KEY)).length, 1);
  assert.equal(elements.recognitionHistory.children.length, 1);
  elements.clearRecognitions.dispatch('click');
  assert.equal(storage.has(RecognitionHistory.KEY), false);
  assert.equal(elements.history.children[0].textContent, '圣彼得');
});

test('cancel and failure create no record; retry creates one', () => {
  const {elements, workers, storage} = app();
  elements.gallery.dispatch('change', {target:{files:[{name:'test.jpg',type:'image/jpeg'}],value:'test.jpg'}});
  elements.identify.dispatch('click');
  const cancelled = workers[0];
  elements.cancelIdentify.dispatch('click');
  cancelled.emit({type:'result',candidates:[{id:'peter',score:0.4,cueZh:'钥匙'}],metrics:{}});
  assert.equal(storage.has(RecognitionHistory.KEY), false);
  elements.identify.dispatch('click');
  workers[1].emit({type:'error',message:'Failed to fetch'});
  assert.equal(storage.has(RecognitionHistory.KEY), false);
  elements.identify.dispatch('click');
  workers[2].emit({type:'result',candidates:[{id:'peter',score:0.4,cueZh:'钥匙'}],metrics:{}});
  assert.equal(JSON.parse(storage.get(RecognitionHistory.KEY)).length, 1);
});

test('unavailable or full storage keeps temporary records and shows a warning', () => {
  for (const options of [{storageUnavailable:true},{storageFull:true}]) {
    const {elements, workers, storage} = app(null, options);
    finishModel(elements, workers);
    assert.equal(elements.recognitionHistory.children.length, 1);
    assert.match(elements.storageStatus.textContent, /关闭后可能丢失/);
    assert.equal(storage.has(RecognitionHistory.KEY), false);
    elements.recognitionHistory.children[0].children.find(child => child.textContent === '删除这条记录').dispatch('click');
    assert.match(elements.recognitionHistory.children[0].textContent, /暂无识别记录/);
  }
});
