const BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:3001';

export async function fetchQuestions() {
  const r = await fetch(`${BASE}/api/questions`);
  if (!r.ok) throw new Error('questions fetch failed');
  return r.json();
}

export async function submitAnswers(payload) {
  const r = await fetch(`${BASE}/api/student/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('submit failed');
  return r.json();
}

export async function fetchAdminResultsFull({ limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const r = await fetch(`${BASE}/api/admin/results-full?` + params.toString());
  if (!r.ok) throw new Error('admin full fetch failed');
  return r.json();
}
