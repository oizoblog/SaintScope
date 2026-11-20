'use strict';

const RecognitionHistory = (() => {
  const KEY = 'saintscope-recognitions-v1';
  const STATUSES = new Set(['unconfirmed', 'confirmed', 'uncertain']);

  function validRecord(value) {
    return value && typeof value.id === 'string' && typeof value.at === 'string' &&
      typeof value.modelVersion === 'string' && STATUSES.has(value.status) &&
      Array.isArray(value.candidates) && value.candidates.every(candidate =>
        candidate && typeof candidate.id === 'string' && Number.isFinite(candidate.similarity)) &&
      (value.confirmedId === null || typeof value.confirmedId === 'string') &&
      typeof value.corrected === 'boolean';
  }

  function createStore(storage, options = {}) {
    const now = options.now || (() => new Date().toISOString());
    const makeId = options.makeId || (() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    let items = [];
    let persistent = true;
    try {
      const parsed = JSON.parse(storage.getItem(KEY) || '[]');
      items = Array.isArray(parsed) ? parsed.filter(validRecord) : [];
    } catch {
      persistent = false;
    }

    function commit(next) {
      items = next;
      try {
        storage.setItem(KEY, JSON.stringify(items));
        persistent = true;
      } catch {
        persistent = false;
      }
      return persistent;
    }

    return {
      key:KEY,
      list:() => [...items],
      get:id => items.find(item => item.id === id) || null,
      isPersistent:() => persistent,
      create(modelVersion, candidates) {
        const record = {
          id:makeId(),
          at:now(),
          modelVersion,
          candidates:candidates.slice(0, 3).map(({id, score}) => ({id, similarity:score})),
          confirmedId:null,
          status:'unconfirmed',
          corrected:false,
          resolution:null,
        };
        return {record,persisted:commit([record, ...items])};
      },
      resolve(id, kind, saintId = null) {
        const current = items.find(item => item.id === id);
        if (!current) return null;
        if (kind === 'candidate' && !current.candidates.some(candidate => candidate.id === saintId)) return null;
        if (kind === 'manual' && typeof saintId !== 'string') return null;
        if (!['candidate','manual','none-of-these','unknown'].includes(kind)) return null;
        const confirmed = kind === 'candidate' || kind === 'manual';
        const updated = {
          ...current,
          confirmedId:confirmed ? saintId : null,
          status:confirmed ? 'confirmed' : 'uncertain',
          corrected:kind === 'manual' || (kind === 'candidate' && saintId !== current.candidates[0]?.id),
          resolution:kind,
        };
        return {record:updated,persisted:commit(items.map(item => item.id === id ? updated : item))};
      },
      remove(id) {
        if (!items.some(item => item.id === id)) return false;
        commit(items.filter(item => item.id !== id));
        return true;
      },
      clear() {
        items = [];
        try { storage.removeItem(KEY); persistent = true; }
        catch { persistent = false; }
      },
    };
  }

  return {KEY,createStore};
})();

if (typeof module !== 'undefined') module.exports = RecognitionHistory;
