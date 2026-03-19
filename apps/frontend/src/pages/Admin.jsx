import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchAdminResultsFull } from '../api'

/* ─── Shared Navbar (same as App.jsx) ────────────────────────────────── */
function Navbar() {
  const { pathname } = useLocation()
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" style={{ textDecoration: 'none' }}>
          <div className="navbar__brand-icon">G</div>
          GradeAI
        </Link>
        <div className="navbar__nav">
          <Link to="/" className={'navbar__link' + (pathname === '/' ? ' navbar__link--active' : '')}>
            Étudiant
          </Link>
          <Link to="/admin" className={'navbar__link' + (pathname === '/admin' ? ' navbar__link--active' : '')}>
            Administration
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ─── Sub-components ─────────────────────────────────────────────────── */
function Badge({ ok }) {
  return (
    <span className={'badge ' + (ok ? 'badge--success' : 'badge--error')}>
      {ok ? '✓ Correct' : '✗ À revoir'}
    </span>
  )
}

function ReviewBadge() {
  return <span className="badge badge--warning" style={{ marginLeft: 6 }}>Revue humaine</span>
}

function JsonBlock({ obj }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button className="json-toggle" onClick={() => setOpen(v => !v)}>
        {open ? '▴ Masquer' : '▾ Afficher'} audit
      </button>
      {open && (
        <pre className="json-pre">{JSON.stringify(obj, null, 2)}</pre>
      )}
    </div>
  )
}

function AnswerCell({ text }) {
  const [open, setOpen] = useState(false)
  if (!text) return <span className="text-subtle">—</span>

  const MAX = 120
  const full = String(text)
  const isLong = full.length > MAX
  const shown = open || !isLong ? full : full.slice(0, MAX) + '…'

  async function copy() {
    try { await navigator.clipboard.writeText(full) } catch {}
  }

  return (
    <div style={{ maxWidth: 260 }}>
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.85rem' }}>{shown}</div>
      <div style={{ marginTop: 4, display: 'flex', gap: 10 }}>
        {isLong && (
          <button className="json-toggle" onClick={() => setOpen(v => !v)}>
            {open ? 'Réduire' : 'Voir plus'}
          </button>
        )}
        <button className="json-toggle" onClick={copy} style={{ color: 'var(--c-text-muted)' }}>
          Copier
        </button>
      </div>
    </div>
  )
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function needsHumanReview(row) {
  const fb   = String(row.feedback || '').toLowerCase()
  const conf = Number(row.audit?.judge?.confidence_0_1 ?? 0)
  return !row.is_correct && (fb.includes('revue humaine') || conf === 0)
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function Admin() {
  const [items,      setItems]      = useState([])
  const [limit,      setLimit]      = useState(50)
  const [only,       setOnly]       = useState('all')
  const [q,          setQ]          = useState('')
  const [intervalMs, setIntervalMs] = useState(5000)
  const [loading,    setLoading]    = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAdminResultsFull({ limit })
      setItems(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [limit])
  useEffect(() => {
    if (!intervalMs) return
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, limit])

  const filtered = useMemo(() => {
    return items
      .filter(it => {
        if (only === 'ok')     return !!it.is_correct
        if (only === 'ko')     return !it.is_correct
        if (only === 'review') return needsHumanReview(it)
        return true
      })
      .filter(it =>
        !q ||
        String(it.question_id || '').toLowerCase().includes(q.toLowerCase()) ||
        String(it.feedback    || '').toLowerCase().includes(q.toLowerCase()) ||
        String(it.answer      || '').toLowerCase().includes(q.toLowerCase())
      )
  }, [items, only, q])

  const nbCorrect  = filtered.filter(r => r.is_correct).length
  const nbReview   = filtered.filter(r => needsHumanReview(r)).length
  const avgScore   = filtered.length
    ? (filtered.reduce((s, r) => s + (Number(r.score_0_1) || 0), 0) / filtered.length).toFixed(2)
    : '—'

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container--wide">

          <div className="page-header">
            <h1>Tableau de bord — Administration</h1>
            <p>Suivi en temps réel des soumissions et audits automatiques.</p>
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-card__value">{filtered.length}</div>
              <div className="stat-card__label">Soumissions</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value" style={{ color: 'var(--c-success)' }}>{nbCorrect}</div>
              <div className="stat-card__label">Correctes</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value" style={{ color: 'var(--c-error)' }}>{filtered.length - nbCorrect}</div>
              <div className="stat-card__label">À revoir</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value" style={{ color: 'var(--c-warning)' }}>{nbReview}</div>
              <div className="stat-card__label">Revue humaine</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">{avgScore}</div>
              <div className="stat-card__label">Score moyen</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="toolbar__field">
              <label className="form-label">Afficher</label>
              <select className="form-input" value={only} onChange={e => setOnly(e.target.value)}>
                <option value="all">Tous</option>
                <option value="ok">Corrects</option>
                <option value="ko">À revoir</option>
                <option value="review">Revue humaine</option>
              </select>
            </div>
            <div className="toolbar__field">
              <label className="form-label">Limite</label>
              <input
                type="number" min={1} max={500}
                className="form-input" style={{ width: 90 }}
                value={limit}
                onChange={e => setLimit(Number(e.target.value) || 50)}
              />
            </div>
            <div className="toolbar__field">
              <label className="form-label">Auto-refresh</label>
              <select className="form-input" value={intervalMs} onChange={e => setIntervalMs(Number(e.target.value))}>
                <option value={0}>Désactivé</option>
                <option value={2000}>2 s</option>
                <option value={5000}>5 s</option>
                <option value={10000}>10 s</option>
              </select>
            </div>
            <div className="toolbar__field toolbar__field--grow">
              <label className="form-label">Recherche</label>
              <input
                className="form-input"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="question_id, feedback, réponse…"
              />
            </div>
            <button className="btn btn--ghost" onClick={load}>
              {loading ? '…' : '↻ Rafraîchir'}
            </button>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Question</th>
                  <th>État</th>
                  <th>Score</th>
                  <th>Réponse</th>
                  <th>Feedback</th>
                  <th>Audit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const review = needsHumanReview(r)
                  return (
                    <tr key={r.id} className={review ? 'row--review' : ''}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
                        {fmt(r.created_at)}
                      </td>
                      <td style={{ fontWeight: 500 }}>{r.question_id}</td>
                      <td>
                        <Badge ok={r.is_correct} />
                        {review && <ReviewBadge />}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {r.score_0_1 != null ? Number(r.score_0_1).toFixed(2) : '—'}
                      </td>
                      <td><AnswerCell text={r.answer} /></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--c-text-muted)', maxWidth: 280 }}>
                        {r.feedback}
                      </td>
                      <td><JsonBlock obj={r.audit || r.verdict || {}} /></td>
                    </tr>
                  )
                })}
                {!filtered.length && (
                  <tr className="empty">
                    <td colSpan={7}>Aucun résultat</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </>
  )
}
