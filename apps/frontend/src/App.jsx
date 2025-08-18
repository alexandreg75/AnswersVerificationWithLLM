import { useEffect, useState } from 'react'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/questions')
        const data = await res.json()
        setQuestions(data.items || [])
      } catch (e) {
        setError("Impossible de charger les questions")
      } finally { setLoading(false) }
    })()
  }, [])

  const canSubmit = questions.length && questions.every(q => (answers[q.id] || '').trim())

  async function submit() {
    try {
      setResults(null); setError('')
      const res = await fetch('/api/student/submit', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ answers: questions.map(q => ({ questionId: q.id, studentAnswer: answers[q.id] || '' })) })
      })
      const data = await res.json()
      setResults(data)
    } catch (e) {
      setError("Soumission échouée")
    }
  }

  if (loading) return <p style={{padding:16}}>Chargement…</p>
  if (error) return <p style={{padding:16, color:'crimson'}}>{error}</p>

  return (
    <div style={{maxWidth: 720, margin: '24px auto', fontFamily: 'system-ui, sans-serif'}}>
      <h1>Évaluation automatique — Démo Étudiant</h1>
      <p>Réponds puis envoie pour correction.</p>
      <div style={{display:'grid', gap:16, marginTop:16}}>
        {questions.map((q, i) => (
          <div key={q.id} style={{border:'1px solid #ddd', borderRadius:12, padding:16, background:'#fff'}}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <strong>{i+1}. {q.text}</strong>
              <span style={{fontSize:12, background:'#f1f1f1', padding:'2px 8px', borderRadius:999}}>{(q.type || 'open').toUpperCase()}</span>
            </div>
            <textarea rows={3} style={{width:'100%', marginTop:8}}
              value={answers[q.id] || ''} onChange={e => setAnswers(a => ({...a, [q.id]: e.target.value}))}
              placeholder="Ta réponse…" />
          </div>
        ))}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:12, marginTop:16}}>
        <button disabled={!canSubmit} onClick={submit} style={{padding:'8px 14px', borderRadius:10}}>
          Envoyer mes réponses
        </button>
        {results && <span>Résumé: {results.summary?.correct ?? 0}/{results.summary?.total ?? 0} justes</span>}
      </div>
      {results && (
        <div style={{marginTop:16, display:'grid', gap:12}}>
          <h2>Résultats</h2>
          {results.results?.map(r => (
            <div key={r.questionId} style={{border:'1px solid #eee', padding:12, borderRadius:10, background:'#fff'}}>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <span style={{fontSize:12, padding:'2px 8px', borderRadius:999, background: r.verdict?.isCorrect ? '#e6ffed' : '#ffe6e6'}}>
                  {r.verdict?.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
                <span style={{fontSize:12}}>Score: {Math.round((r.verdict?.score_0_1 ?? 0)*100)}%</span>
              </div>
              {r.verdict?.feedback && <div style={{fontSize:14, marginTop:4}}>Feedback: {r.verdict.feedback}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
