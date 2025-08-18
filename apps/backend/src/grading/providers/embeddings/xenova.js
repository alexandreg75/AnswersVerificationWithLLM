import { env, pipeline } from '@xenova/transformers';

let _embedder = null;

// Force ONNX Runtime Node (évite le fallback wasm et ses workers)
env.backends = env.backends || {};
env.backends.onnx = 'onnxruntime-node';

// Options robustes côté Node
env.allowLocalModels = true;
env.useBrowserCache = false;
env.useFSCache = true;          // cache sur disque
env.localModelPath = undefined; // défaut (~/.cache/huggingface/hub)
env.cacheDir = undefined;       // idem

export async function getEmbedder(
  modelId = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
) {
  if (!_embedder) {
    const extractor = await pipeline('feature-extraction', modelId, {
      quantized: true,
      progress_callback: () => {}
    });
    _embedder = async (texts = []) => {
      const out = [];
      for (const t of texts) {
        const res = await extractor(String(t || ''), { pooling: 'mean', normalize: true });
        out.push(Array.from(res.data));
      }
      return out;
    };
  }
  return _embedder;
}

export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    dot += x * y; na += x * x; nb += y * y;
  }
  na = Math.sqrt(na); nb = Math.sqrt(nb);
  return na && nb ? dot / (na * nb) : 0;
}
