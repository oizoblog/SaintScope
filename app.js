'use strict';

const saints = SAINTS;
const $ = id => document.getElementById(id);
const selected = new Set();
const byId = new Map(saints.map(s => [s.id, s]));
const byLegacyName = new Map(saints.map(s => [s.nameFr, s]));
const tags = [...new Set(saints.flatMap(s => s.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
const MODEL_VERSION = 'Xenova/clip-vit-base-patch32@4c1807b705b1d015fb032789cc4d221b23025a6f · q8 WASM · Transformers.js 4.3.2';
const recognitionStore = (() => {
  try { return RecognitionHistory.createStore(localStorage); }
  catch { return RecognitionHistory.createStore({getItem(){throw Error('unavailable')},setItem(){throw Error('unavailable')}}); }
})();
let photoURL = null;
let selectedFile = null;
let aiWorker = null;
let taskVersion = 0;
let identifying = false;
let loadMetrics = null;
let activeRecognitionId = null;
let modelConsentThisPage = false;

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function button(text, handler, cls = 'btn secondary') {
  const node = el('button', text, cls);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function updateStorageStatus() {
  $('storageStatus').textContent = recognitionStore.isPersistent()
    ? '记录仅保存在此浏览器；清理浏览器数据会删除记录。'
    : '本地存储不可用或空间不足：本页暂存的记录关闭后可能丢失。';
}

function statusLabel(record) {
  if (record.status === 'confirmed') return `已由您确认：${byId.get(record.confirmedId)?.nameZh || record.confirmedId}。这是人工选择，不代表史料已核实。`;
  if (record.resolution === 'none-of-these') return '已标记“都不是”。可以手动查找圣人；身份仍未确定。';
  if (record.status === 'uncertain') return '已标记“无法确定身份”。';
  return '身份尚未确认。这不是确定的身份识别结果。';
}

function updateResolutionStatus() {
  $('resolutionStatus').textContent = statusLabel(recognitionStore.get(activeRecognitionId) || {status:'unconfirmed'});
}

function showProfile(id) {
  const saint = byId.get(id);
  if (!saint) return;
  const root = $('saintProfile');
  root.replaceChildren(
    el('h3', saint.nameZh),
    el('p', `${saint.nameFr} · ${saint.nameIntl}`, 'hint'),
    el('p', `圣人简介：${saint.bio}`),
    el('p', `圣人象征物：${saint.tags.join('、')}`),
    el('p', `圣人纪念日：${saint.feast}`),
    el('p', `历史资料：${saint.historical}`),
    el('p', `传说与图像传统：${saint.legend}`),
    el('p', '资料核查状态：待核查', 'hint')
  );
  $('profileSection').hidden = false;
  $('profileSection').scrollIntoView?.({behavior:'smooth',block:'start'});
}

function focusManualSearch() {
  $('search').scrollIntoView?.({behavior:'smooth',block:'center'});
  $('search').focus?.();
}

function resolveActive(kind, id = null) {
  if (!activeRecognitionId || (id && !byId.has(id))) return;
  const result = recognitionStore.resolve(activeRecognitionId, kind, id);
  if (!result) return;
  updateResolutionStatus();
  renderRecognitionHistory();
  updateStorageStatus();
}

function renderChips() {
  const root = $('chips');
  root.replaceChildren();
  for (const tag of tags) {
    const button = el('button', tag, 'chip');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(selected.has(tag)));
    button.addEventListener('click', () => {
      selected.has(tag) ? selected.delete(tag) : selected.add(tag);
      renderChips();
      renderResults();
    });
    root.append(button);
  }
}

function readHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem('saintscope-history') || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function historySaint(value) {
  return typeof value === 'string' ? byId.get(value) || byLegacyName.get(value) : null;
}

function save(id) {
  try {
    const previous = readHistory().map(value => historySaint(value)?.id || value);
    localStorage.setItem('saintscope-history', JSON.stringify([id, ...previous.filter(value => value !== id)].slice(0, 30)));
    renderHistory();
  } catch {
    alert('本地存储不可用。');
  }
}

function renderResults() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const matches = saints.map(s => ({...s, hits:s.tags.filter(tag => selected.has(tag))}))
    .filter(s => (!selected.size || s.hits.length > 0) &&
      (!query || [s.nameZh, s.nameFr, s.nameIntl, s.bio, ...s.tags].join(' ').toLocaleLowerCase().includes(query)))
    .sort((a, b) => b.hits.length - a.hits.length || a.nameZh.localeCompare(b.nameZh, 'zh-CN'));
  $('count').textContent = `${matches.length} 条结果`;
  const root = $('results');
  root.replaceChildren();
  if (!matches.length) {
    root.append(el('p', '无法确定身份。请减少筛选条件，或尝试其他象征物。', 'muted'));
    return;
  }
  for (const s of matches) {
    const item = el('article', undefined, 'result');
    item.append(el('h3', s.nameZh));
    item.append(el('p', `${s.nameFr} · ${s.nameIntl}`, 'hint'));
    item.append(el('p', `圣人象征物：${s.tags.join('、')}`));
    item.append(el('p', `圣人简介：${s.bio}`));
    item.append(el('p', `圣人纪念日：${s.feast}`, 'hint'));
    item.append(el('p', `历史资料：${s.historical}`));
    item.append(el('p', `传说与图像传统：${s.legend}`));
    item.append(el('p', '资料核查状态：待核查', 'hint'));
    if (selected.size) item.append(el('p', `识别依据：与您选择的象征物相符 ${s.hits.length} 项（仅供检索，不代表识别概率）。`, 'score'));
    item.append(button('查看圣人资料', () => showProfile(s.id)));
    if (activeRecognitionId) item.append(button('确认这位圣人（手动）', () => resolveActive('manual', s.id)));
    item.append(button('☆ 加入收藏', () => save(s.id)));
    root.append(item);
  }
}

function renderHistory() {
  const root = $('history');
  root.replaceChildren();
  const history = readHistory();
  if (!history.length) {
    root.append(el('p', '暂无保存记录。', 'hint'));
    return;
  }
  for (const value of history) {
    const saint = historySaint(value);
    root.append(el('p', saint?.nameZh || String(value)));
  }
}

function renderRecognitionHistory() {
  const root = $('recognitionHistory');
  root.replaceChildren();
  const records = recognitionStore.list();
  if (!records.length) {
    root.append(el('p', '暂无识别记录。', 'hint'));
    return;
  }
  for (const record of records) {
    const item = el('article', undefined, 'history-item');
    const time = new Date(record.at);
    item.append(el('h3', Number.isNaN(time.getTime()) ? record.at : time.toLocaleString('zh-CN')));
    item.append(el('p', statusLabel(record)));
    item.append(el('p', `模型版本：${record.modelVersion}`, 'hint'));
    const candidates = record.candidates.map(candidate => {
      const name = byId.get(candidate.id)?.nameZh || candidate.id;
      return `${name} ${candidate.similarity.toFixed(3)}`;
    });
    item.append(el('p', `候选圣人及余弦相似度：${candidates.join('；') || '无'}`, 'score'));
    item.append(el('p', `状态：${record.status === 'confirmed' ? '已确认' : record.status === 'uncertain' ? '无法确定' : '未确认'} · 人工纠正：${record.corrected ? '是' : '否'}`, 'hint'));
    item.append(button('查看并处理', () => {
      activeRecognitionId = record.id;
      renderCandidates(record.candidates.map(candidate => ({id:candidate.id,score:candidate.similarity,cueZh:'参照该圣人的典型象征物'})));
      updateResolutionStatus();
      renderResults();
      $('aiTitle').scrollIntoView?.({behavior:'smooth',block:'start'});
    }));
    item.append(button('删除这条记录', () => {
      recognitionStore.remove(record.id);
      if (activeRecognitionId === record.id) {
        activeRecognitionId = null;
        $('aiResults').replaceChildren(el('p', '这条识别记录已删除。', 'hint'));
        $('aiActions').replaceChildren();
        updateResolutionStatus();
        renderResults();
      }
      renderRecognitionHistory();
      updateStorageStatus();
    }));
    root.append(item);
  }
}

function photoChanged(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    $('photoStatus').textContent = '请选择有效的图片文件。';
    return;
  }
  if (identifying) cancelIdentification();
  if (photoURL) URL.revokeObjectURL(photoURL);
  activeRecognitionId = null;
  selectedFile = file;
  photoURL = URL.createObjectURL(file);
  $('preview').src = photoURL;
  $('preview').hidden = false;
  $('identify').disabled = false;
  $('photoStatus').textContent = `已选择照片：${file.name}。请在下方选择可见的象征物。`;
  $('modelStatus').textContent = '照片已就绪。点击“开始识别”后才会加载模型。';
  $('modelMetrics').textContent = '';
  $('aiResults').replaceChildren(el('p', '尚未运行本地识别。', 'hint'));
  $('aiActions').replaceChildren();
  updateResolutionStatus();
  renderResults();
  event.target.value = '';
}

function setIdentifying(value) {
  identifying = value;
  $('identify').disabled = value || !selectedFile;
  $('cancelIdentify').disabled = !value;
}

function stopWorker() {
  if (aiWorker) aiWorker.terminate();
  aiWorker = null;
  loadMetrics = null;
}

function cancelIdentification() {
  taskVersion++;
  stopWorker();
  setIdentifying(false);
  $('modelProgress').hidden = true;
  $('modelStatus').textContent = '已取消。模型可能需要重新初始化；您仍可手动搜索象征物。';
  $('aiResults').replaceChildren(el('p', '识别已取消。', 'hint'));
  $('aiActions').replaceChildren();
  $('modelMetrics').textContent = '';
}

function renderAiActions() {
  const root = $('aiActions');
  root.replaceChildren();
  if (!activeRecognitionId) return;
  root.append(
    button('都不是', () => resolveActive('none-of-these')),
    button('手动查找圣人', focusManualSearch),
    button('无法确定', () => resolveActive('unknown'))
  );
}

function renderCandidates(candidates) {
  const root = $('aiResults');
  root.replaceChildren();
  const valid = candidates.filter(candidate => byId.has(candidate.id) && Number.isFinite(candidate.score)).slice(0, 3);
  if (!valid.length) {
    root.append(el('p', '无法确定身份。请按象征物手动搜索。', 'muted'));
    renderAiActions();
    return;
  }
  valid.forEach((candidate, index) => {
    const saint = byId.get(candidate.id);
    const article = el('article', undefined, 'result');
    article.append(el('h3', `${index + 1}. ${saint.nameZh}`));
    article.append(el('p', saint.nameFr, 'hint'));
    article.append(el('p', `典型象征物：${saint.tags.join('、')}`));
    article.append(el('p', `识别线索：${candidate.cueZh || '参照典型象征物'}`));
    article.append(el('p', `余弦相似度：${candidate.score.toFixed(3)}（仅用于排序）`, 'score'));
    article.append(button('确认是这位圣人', () => resolveActive('candidate', saint.id), 'btn'));
    article.append(button('查看圣人资料', () => showProfile(saint.id)));
    root.append(article);
  });
  root.append(el('p', '身份尚未确认。这不是确定的身份识别结果；图中人物也可能不在资料库中。', 'hint'));
  renderAiActions();
}

function showMetrics(metrics) {
  const parts = [];
  if (loadMetrics) parts.push(`模型初始化：${Math.round(loadMetrics.initMs)} 毫秒`);
  if (Number.isFinite(metrics.inferenceMs)) parts.push(`本次推理：${Math.round(metrics.inferenceMs)} 毫秒`);
  if (Number.isFinite(metrics.networkBytes)) parts.push(`本次会话模型资源网络读取：${(metrics.networkBytes / 1048576).toFixed(1)} MiB`);
  $('modelMetrics').textContent = parts.join(' · ');
}

function startIdentification() {
  if (!selectedFile || identifying) return;
  if (typeof Worker === 'undefined') {
    $('modelStatus').textContent = '此浏览器不支持后台模型运行。请按象征物手动搜索。';
    return;
  }
  if (!modelConsentThisPage) {
    if (!confirm('本地 AI 首次运行可能下载约 162 MiB 模型资源，另需约 14 MB 运行组件。缓存命中时无需重复下载。照片只在本机处理。现在继续吗？')) {
      $('modelStatus').textContent = '已取消模型下载。您仍可手动搜索象征物。';
      return;
    }
    modelConsentThisPage = true;
  }
  const version = ++taskVersion;
  activeRecognitionId = null;
  setIdentifying(true);
  $('modelStatus').textContent = '正在准备本地模型…';
  $('modelProgress').hidden = false;
  $('modelProgress').value = 0;
  $('aiResults').replaceChildren(el('p', '正在分析照片…', 'hint'));
  $('aiActions').replaceChildren();
  $('modelMetrics').textContent = '';
  updateResolutionStatus();
  renderResults();
  try {
    if (!aiWorker) aiWorker = new Worker('./ai-worker.bundle.js', {type:'module'});
    const worker = aiWorker;
    worker.onmessage = event => {
      if (version !== taskVersion || worker !== aiWorker) return;
      const data = event.data || {};
      if (data.type === 'progress') {
        if (Number.isFinite(data.percent)) $('modelProgress').value = Math.min(100, Math.max(0, data.percent));
        const amount = Number.isFinite(data.networkBytes) ? `；已从网络读取 ${(data.networkBytes / 1048576).toFixed(1)} MiB` : '';
        $('modelStatus').textContent = `正在下载或读取模型资源${amount}…`;
      } else if (data.type === 'status') {
        $('modelStatus').textContent = data.status === 'inferencing' ? '模型已就绪，正在本机分析照片…' : '正在加载模型，请稍候…';
      } else if (data.type === 'loaded') {
        loadMetrics = data;
        $('modelStatus').textContent = '模型已加载，正在本机分析照片…';
      } else if (data.type === 'result') {
        const candidates = (data.candidates || []).filter(candidate => byId.has(candidate.id) && Number.isFinite(candidate.score)).slice(0, 3);
        const {record} = recognitionStore.create(MODEL_VERSION, candidates);
        activeRecognitionId = record.id;
        renderCandidates(candidates);
        updateResolutionStatus();
        renderRecognitionHistory();
        updateStorageStatus();
        renderResults();
        showMetrics(data.metrics || {});
        $('modelStatus').textContent = '本地分析已完成，身份尚未确认。';
        $('modelProgress').hidden = true;
        setIdentifying(false);
      } else if (data.type === 'error') {
        failIdentification(data.message || '未知错误');
      }
    };
    worker.onerror = event => {
      if (version === taskVersion && worker === aiWorker) failIdentification(event.message || 'Worker 加载失败');
    };
    worker.postMessage({type:'identify',file:selectedFile,entries:SAINT_PROMPTS});
  } catch (error) {
    failIdentification(error instanceof Error ? error.message : String(error));
  }
}

function failIdentification(message) {
  taskVersion++;
  stopWorker();
  setIdentifying(false);
  $('modelProgress').hidden = true;
  const reason = navigator.onLine === false
    ? '离线模型资源不可用或缓存已清理；联网下载后再试'
    : /out of memory|allocation failed|memory limit|\boom\b/i.test(message)
      ? '设备内存不足；请关闭其他页面后重试'
      : message;
  $('modelStatus').textContent = `模型运行失败：${reason}。请按象征物手动搜索。`;
  $('aiResults').replaceChildren(el('p', '无法确定身份。', 'muted'));
  $('aiActions').replaceChildren();
  $('modelMetrics').textContent = '';
}

$('camera').addEventListener('change', photoChanged);
$('gallery').addEventListener('change', photoChanged);
$('identify').addEventListener('click', startIdentification);
$('cancelIdentify').addEventListener('click', cancelIdentification);
$('search').addEventListener('input', renderResults);
$('reset').addEventListener('click', () => {
  selected.clear();
  $('search').value = '';
  renderChips();
  renderResults();
});
$('clearHistory').addEventListener('click', () => {
  if (confirm('确定清除所有保存记录吗？')) {
    try { localStorage.removeItem('saintscope-history'); } catch {}
    renderHistory();
  }
});
$('clearRecognitions').addEventListener('click', () => {
  if (!confirm('确定清空全部识别记录吗？')) return;
  if (identifying) cancelIdentification();
  recognitionStore.clear();
  activeRecognitionId = null;
  $('aiResults').replaceChildren(el('p', '识别记录已清空。', 'hint'));
  $('aiActions').replaceChildren();
  updateResolutionStatus();
  renderRecognitionHistory();
  renderResults();
  updateStorageStatus();
});
renderChips();
renderResults();
renderHistory();
renderRecognitionHistory();
updateStorageStatus();
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => {
  taskVersion++;
  stopWorker();
  if (photoURL) URL.revokeObjectURL(photoURL);
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').then(registration => {
    let updateRequested = false;
    const offerUpdate = () => {
      if (registration.waiting && navigator.serviceWorker.controller) $('updateNotice').hidden = false;
    };
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed') offerUpdate();
      });
    });
    $('applyUpdate').addEventListener('click', () => {
      if (!registration.waiting) return;
      if (identifying) cancelIdentification();
      updateRequested = true;
      $('applyUpdate').disabled = true;
      registration.waiting.postMessage({type:'SKIP_WAITING'});
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) location.reload();
    });
  }).catch(() => {});
}
