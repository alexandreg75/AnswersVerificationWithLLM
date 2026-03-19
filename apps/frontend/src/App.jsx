import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

function Navbar() {
  const { pathname } = useLocation()
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" style={{ textDecoration: 'none' }}>
          <div className="navbar__brand-icon">S</div>
          SupraProf
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

export { Navbar }

export default function App() {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/questions')
        const data = await res.json()
        setQuestions(data.items || [])
      } catch {
        setError('Impossible de charger les questions.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filledCount = questions.filter(q => (answers[q.id] || '').trim()).length
  const canSubmit = !submitting && questions.length > 0 && filledCount === questions.length

  async function submit() {
    setSubmitting(true)
    setResults(null)
    setError('')
    try {
      const res = await fetch('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: questions.map(q => ({ questionId: q.id, studentAnswer: answers[q.id] || '' })),
        }),
      })
      setResults(await res.json())
    } catch {
      setError('La soumission a échoué. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  const correct = results?.summary?.correct ?? 0
  const total   = results?.summary?.total   ?? 0
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0
  const pass    = pct >= 50

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container">
          <div className="page-header">
            <h1>SupraProf</h1>
            <p>Répondez à chaque question puis soumettez pour correction instantanée.</p>
          </div>

          {loading && <div className="loading">Chargement des questions…</div>}
          {error   && <div className="error-msg">{error}</div>}

          {!loading && !error && (
            <>
              <div className="form-grid">
                {questions.map((q, i) => (
                  <div key={q.id} className="question-card">
                    <div className="question-card__header">
                      <div>
                        <div className="question-card__num">Question {i + 1}</div>
                        <div className="question-card__text">{q.text}</div>
                      </div>
                      <span className="badge badge--type">{(q.type || 'open').toUpperCase()}</span>
                    </div>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Votre réponse…"
                    />
                  </div>
                ))}
              </div>

              <div className="submit-bar">
                <button className="btn btn--primary" disabled={!canSubmit} onClick={submit}>
                  {submitting ? 'Envoi en cours…' : 'Soumettre mes réponses'}
                </button>
                <span className="submit-summary">
                  {filledCount < questions.length
                    ? <>{filledCount} / {questions.length} réponses complétées</>
                    : results
                      ? <>Score : <strong>{correct}/{total}</strong> — {pct} %</>
                      : <>Toutes les réponses sont complètes</>
                  }
                </span>
              </div>

              {results && (
                <div className="results-section">
                  <h2>Résultats</h2>

                  <div className={'score-banner ' + (pass ? 'score-banner--pass' : 'score-banner--fail')}>
                    <div>
                      <div className="score-banner__label">Score global</div>
                      <div className="score-banner__value">{correct} / {total} bonnes réponses</div>
                    </div>
                    <div className="score-banner__value">{pct} %</div>
                  </div>

                  <div className="form-grid">
                    {results.results?.map((r, i) => {
                      const ok  = r.verdict?.isCorrect
                      const pct = Math.round((r.verdict?.score_0_1 ?? 0) * 100)
                      const q   = questions.find(x => x.id === r.questionId)
                      return (
                        <div key={r.questionId} className={'result-item ' + (ok ? 'result-item--correct' : 'result-item--incorrect')}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)', fontWeight: 500 }}>
                            Question {i + 1}{q ? ` — ${q.text}` : ''}
                          </div>
                          <div className="result-item__meta">
                            <span className={'badge ' + (ok ? 'badge--success' : 'badge--error')}>
                              {ok ? '✓ Correct' : '✗ Incorrect'}
                            </span>
                            <span className="result-item__score">Score : {pct} %</span>
                          </div>
                          {r.verdict?.feedback && (
                            <div className="result-item__feedback">
                              <strong>Feedback :</strong> {r.verdict.feedback}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
