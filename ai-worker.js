import { AutoProcessor, AutoTokenizer, CLIPModel, RawImage, env } from '@huggingface/transformers';

const MODEL = 'Xenova/clip-vit-base-patch32';
const REVISION = '4c1807b705b1d015fb032789cc4d221b23025a6f';
// Transformers.js 4.3.2 probes tokenizer metadata without forwarding revision.
// Pin every Hub path so that the metadata probe uses the same cached revision offline.
env.remotePathTemplate = `{model}/resolve/${REVISION}/`;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL('./vendor/ort-wasm-simd-threaded.mjs', import.meta.url).href,
  wasm: new URL('./vendor/ort-wasm-simd-threaded.wasm', import.meta.url).href,
};
env.useBrowserCache = true;
env.useWasmCache = true;

let networkBytes = 0;
let networkRequests = 0;
const originalFetch = env.fetch;
env.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  if (!response.ok || !response.body) return response;
  networkRequests++;
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      networkBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
  }));
  return new Response(body, {status:response.status, statusText:response.statusText, headers:response.headers});
};

let modelPromise = null;
let busy = false;

function cosine(a, b, offset, size) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < size; i++) {
    const x = a[i], y = b[offset + i];
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const started = performance.now();
      const progress = info => {
        if (info.status === 'progress_total' && Number.isFinite(info.progress)) {
          self.postMessage({type:'progress',percent:info.progress,networkBytes});
        } else if (info.status === 'progress' && Number.isFinite(info.loaded)) {
          self.postMessage({type:'progress',file:info.file,loaded:info.loaded,total:info.total,networkBytes});
        }
      };
      self.postMessage({type:'status',status:'loading'});
      const options = {device:'wasm',dtype:'q8',revision:REVISION,progress_callback:progress};
      const [tokenizer, processor, model] = await Promise.all([
        AutoTokenizer.from_pretrained(MODEL, options),
        AutoProcessor.from_pretrained(MODEL, options),
        CLIPModel.from_pretrained(MODEL, options),
      ]);
      const initMs = performance.now() - started;
      self.postMessage({type:'loaded',initMs,networkBytes,networkRequests});
      return {tokenizer, processor, model};
    })().catch(error => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

self.onmessage = async event => {
  const {type, file, entries} = event.data || {};
  if (type !== 'identify' || busy) return;
  busy = true;
  try {
    if (!(file instanceof Blob) || !Array.isArray(entries) || !entries.length) throw Error('输入无效');
    const {tokenizer, processor, model} = await loadModel();
    self.postMessage({type:'status',status:'inferencing'});
    const started = performance.now();
    const descriptions = entries.flatMap(entry => entry.prompts.map(([text, cueZh]) => ({id:entry.id,text,cueZh})));
    const image = await RawImage.fromBlob(file);
    const textInputs = tokenizer(descriptions.map(item => item.text), {padding:true,truncation:true});
    const imageInputs = await processor(image);
    const output = await model({...textInputs,...imageInputs});
    const imageData = output.image_embeds.data;
    const textData = output.text_embeds.data;
    const size = output.image_embeds.dims.at(-1);
    const best = new Map();
    descriptions.forEach((item, index) => {
      const score = cosine(imageData, textData, index * size, size);
      const previous = best.get(item.id);
      if (!previous || score > previous.score) best.set(item.id, {id:item.id,score,cueZh:item.cueZh});
    });
    const candidates = [...best.values()].sort((a,b) => b.score - a.score).slice(0,3);
    const inferenceMs = performance.now() - started;
    self.postMessage({type:'result',candidates,metrics:{inferenceMs,networkBytes,networkRequests}});
  } catch (error) {
    self.postMessage({type:'error',message:error instanceof Error ? error.message : String(error),networkBytes});
  } finally {
    busy = false;
  }
};
