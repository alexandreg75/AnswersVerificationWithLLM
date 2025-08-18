import { useEffect, useMemo, useState } from 'react';
import { fetchAdminResultsFull } from '../api';

function Badge({ ok }) {
  return (
    <span className={"px-2 py-0.5 rounded text-sm " + (ok ? "bg-green-100 text-green-800" : "bg-rose-100 text-rose-800")}>
      {ok ? "Correct" : "À revoir"}
    </span>
  );
}

function NeedsReviewBadge() {
  return <span className="ml-2 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 border border-yellow-300">Revue humaine</span>;
}

function JsonBlock({ obj }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(v => !v)} className="text-blue-600 underline text-sm">
        {open ? "Masquer audit" : "Afficher audit"}
      </button>
      {open && (
        <pre className="mt-2 p-3 bg-gray-50 rounded border overflow-auto text-xs">
          {JSON.stringify(obj, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AnswerCell({ text, expand }) {
  const [open, setOpen] = useState(!!expand);
  if (!text) return <span className="text-gray-400">—</span>;

  const MAX = 140;
  const short = String(text).slice(0, MAX);
  const isLong = String(text).length > MAX;
  const shown = open || !isLong ? String(text) : short + "…";

  async function copy() {
    try { await navigator.clipboard.writeText(String(text)); } catch {}
  }

  return (
    <div className="max-w-xs">
      <div className="whitespace-pre-wrap break-words text-sm">{shown}</div>
      <div className="mt-1 flex gap-3">
        {isLong && (
          <button onClick={() => setOpen(v => !v)} className="text-blue-600 underline text-xs">
            {open ? "Réduire" : "Voir plus"}
          </button>
        )}
        <button onClick={copy} className="text-gray-600 underline text-xs">Copier</button>
      </div>
    </div>
  );
}

// Heuristique : nécessite revue humaine ?
// - feedback contient explicitement "Revue humaine"
// - OU le LLM s'est abstenu (confidence=0) et le verdict est KO
function needsHumanReview(row) {
  const fb = String(row.feedback || "").toLowerCase();
  const audit = row.audit || {};
  const conf = Number(audit?.judge?.confidence_0_1 ?? 0);
  return (!row.is_correct) && (fb.includes("revue humaine") || conf === 0);
}

export default function Admin() {
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(50);
  const [only, setOnly] = useState('all'); // all | ok | ko | review
  const [q, setQ] = useState('');
  const [intervalMs, setIntervalMs] = useState(5000);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminResultsFull({ limit });
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [limit]);
  useEffect(() => {
    if (!intervalMs) return;
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, limit]);

  const filtered = useMemo(() => {
    return (items || [])
      .filter(it => {
        if (only === 'ok') return !!it.is_correct;
        if (only === 'ko') return !it.is_correct;
        if (only === 'review') return needsHumanReview(it);
        return true;
      })
      .filter(it => !q || (String(it.question_id||'').toLowerCase().includes(q.toLowerCase())
                        || String(it.feedback||'').toLowerCase().includes(q.toLowerCase())
                        || String(it.answer||'').toLowerCase().includes(q.toLowerCase())));
  }, [items, only, q]);

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Admin · Live audits</h1>
        <a href="/" className="text-blue-600 underline">← Retour élève</a>
      </div>

      <div className="flex gap-4 items-end flex-wrap mb-4">
        <div>
          <label className="block text-sm text-gray-600">Afficher</label>
          <select value={only} onChange={e => setOnly(e.target.value)} className="border rounded px-2 py-1">
            <option value="all">Tous</option>
            <option value="ok">Corrects</option>
            <option value="ko">À revoir</option>
            <option value="review">À revoir (humain)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Limit</label>
          <input type="number" min={1} max={500} value={limit}
                 onChange={e => setLimit(Number(e.target.value)||50)}
                 className="border rounded px-2 py-1 w-24"/>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Auto-refresh</label>
          <select value={intervalMs} onChange={e => setIntervalMs(Number(e.target.value))}
                  className="border rounded px-2 py-1">
            <option value={0}>Désactivé</option>
            <option value={2000}>2 s</option>
            <option value={5000}>5 s</option>
            <option value={10000}>10 s</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-600">Recherche</label>
          <input value={q} onChange={e => setQ(e.target.value)}
                 placeholder="question_id, feedback, réponse…"
                 className="border rounded px-2 py-1 w-full"/>
        </div>
        <button onClick={load} className="px-3 py-2 bg-gray-800 text-white rounded">{loading ? "…" : "Rafraîchir"}</button>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Question</th>
              <th className="p-2">État</th>
              <th className="p-2">Score</th>
              <th className="p-2">Réponse</th>
              <th className="p-2">Feedback</th>
              <th className="p-2">Audit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const review = needsHumanReview(r);
              return (
                <tr key={r.id} className={"border-t align-top " + (review ? "bg-yellow-50" : "")}>
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">{r.question_id}</td>
                  <td className="p-2">
                    <Badge ok={r.is_correct} />
                    {review && <NeedsReviewBadge />}
                  </td>
                  <td className="p-2">{(r.score_0_1!=null) ? Number(r.score_0_1).toFixed(2) : ''}</td>
                  <td className="p-2">
                    <AnswerCell text={r.answer} expand={review} />
                  </td>
                  <td className="p-2">{r.feedback}</td>
                  <td className="p-2"><JsonBlock obj={r.audit || r.verdict || {}} /></td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={7}>Aucun résultat</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
