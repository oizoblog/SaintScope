'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const RecognitionHistory = require('../recognition-history.js');

function storage() {
  const values = new Map();
  return {
    getItem:key => values.get(key) ?? null,
    setItem:(key,value) => values.set(key,value),
    removeItem:key => values.delete(key),
    values,
  };
}

test('records survive store recreation and keep only allowed metadata', () => {
  const local = storage();
  const store = RecognitionHistory.createStore(local, {now:() => '2026-11-20T10:00:00.000Z',makeId:() => 'run-1'});
  const created = store.create('CLIP test revision', [{id:'peter',score:0.4,cueZh:'keys',photo:'secret'},{id:'paul',score:0.2}]);
  assert.equal(created.persisted, true);
  const reopened = RecognitionHistory.createStore(local);
  assert.equal(reopened.list().length, 1);
  assert.deepEqual(reopened.list()[0].candidates, [{id:'peter',similarity:0.4},{id:'paul',similarity:0.2}]);
  assert.ok(!local.values.get(RecognitionHistory.KEY).includes('secret'));
  reopened.resolve('run-1','candidate','peter');
  assert.equal(RecognitionHistory.createStore(local).get('run-1').confirmedId, 'peter');
  reopened.remove('run-1');
  assert.deepEqual(RecognitionHistory.createStore(local).list(), []);
});

test('invalid persisted objects are ignored without touching another storage key', () => {
  const local = storage();
  local.values.set(RecognitionHistory.KEY, JSON.stringify([{id:'bad',status:'confirmed',photo:'raw'}]));
  local.values.set('saintscope-history', JSON.stringify(['Saint Pierre']));
  const store = RecognitionHistory.createStore(local);
  assert.deepEqual(store.list(), []);
  store.clear();
  assert.deepEqual(JSON.parse(local.values.get('saintscope-history')), ['Saint Pierre']);
});

test('clear removes persisted records even when writing is blocked by quota', () => {
  const local = storage();
  const first = RecognitionHistory.createStore(local, {makeId:() => 'run-2'});
  first.create('CLIP test revision', [{id:'george',score:0.5}]);
  const quotaStorage = {
    getItem:local.getItem,
    setItem:() => {throw Error('quota exceeded');},
    removeItem:local.removeItem,
  };
  const reopened = RecognitionHistory.createStore(quotaStorage);
  reopened.clear();
  assert.equal(local.getItem(RecognitionHistory.KEY), null);
  assert.equal(reopened.isPersistent(), true);
});
