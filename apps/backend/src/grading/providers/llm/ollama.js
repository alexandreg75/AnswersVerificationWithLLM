export async function callWithOllama({ prompt, model = process.env.LLM_MODEL || 'llama3.1:8b-instruct' }) {
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.response;
}
