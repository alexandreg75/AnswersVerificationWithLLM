let _embedder = null;

export async function getEmbedder() {
  if (_embedder) return _embedder;
  
  _embedder = async (texts = []) => {
    const OLLAMA_URL = process.env.OLLAMA_EMBEDDINGS_URL || 'http://127.0.0.1:11434/api/embed';
    const MODEL = process.env.OLLAMA_EMBEDDINGS_MODEL || 'nomic-embed-text';

    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, input: texts })
      });
      const data = await response.json();
      
      // Handle different response formats
      if (Array.isArray(data)) return data;
      if (data.embedding) return [data.embedding];
      if (data.embeddings) return data.embeddings;
      if (Array.isArray(data.data)) return data.data.map(obj => obj.embedding);
      
      return texts.map(() => new Array(768).fill(0)); // Fallback vides
    } catch (err) {
      console.error('[Embeddings] Ollama error:', err.message);
      return texts.map(() => new Array(768).fill(0)); // Fallback sur erreur
    }
  };
  
  return _embedder;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  na = Math.sqrt(na); nb = Math.sqrt(nb);
  return na && nb ? dot / (na * nb) : 0;
}
