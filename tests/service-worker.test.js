'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function worker() {
  const listeners = {};
  const names = new Set(['saintscope-v03-ai6', 'saintscope-v03-ai7', 'saintscope-v03-ai8', 'saintscope-v-model', 'transformers-cache']);
  const deleted = [];
  const cached = new Map([['https://example.test/SaintScope/', {body:'offline app'}]]);
  const context = {
    self: {
      location:{origin:'https://example.test'},
      clients:{claim:async () => {}},
      addEventListener:(type, handler) => { listeners[type] = handler; },
      skipWaiting:() => {},
    },
    caches: {
      open:async () => ({addAll:async assets => { assert.ok(assets.includes('./image-guard.js')); }}),
      keys:async () => [...names],
      delete:async name => { deleted.push(name); names.delete(name); return true; },
      match:async request => cached.get(request.url),
    },
    fetch:async () => { throw Error('offline'); },
    URL,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), context);
  return {listeners, names, deleted};
}

test('service worker update removes only old app caches and preserves model cache', async () => {
  const {listeners, names, deleted} = worker();
  let pending;
  listeners.install({waitUntil:promise => { pending = promise; }});
  await pending;
  listeners.activate({waitUntil:promise => { pending = promise; }});
  await pending;
  assert.deepEqual(deleted, ['saintscope-v03-ai6', 'saintscope-v03-ai7']);
  assert.ok(names.has('saintscope-v03-ai8'));
  assert.ok(names.has('transformers-cache'));
  assert.ok(names.has('saintscope-v-model'));
});

test('offline cached app loads and uncached resource fails without clearing caches', async () => {
  const {listeners, names} = worker();
  let response;
  listeners.fetch({request:{method:'GET',url:'https://example.test/SaintScope/'},respondWith:promise => { response = promise; }});
  assert.equal((await response).body, 'offline app');
  listeners.fetch({request:{method:'GET',url:'https://example.test/SaintScope/missing.js'},respondWith:promise => { response = promise; }});
  await assert.rejects(response, /offline/);
  assert.ok(names.has('transformers-cache'));
});
