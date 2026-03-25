import "dotenv/config";
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import { QUESTIONS, QUESTIONS_BY_ID } from './data/questions.sample.js';
import { gradeAnswer } from './grading/index.js';
import { getEmbedder } from './grading/providers/embeddings/xenova.js';
import { initDb } from './db.js';
import { saveResult, listResults, getResultsByJob } from './repo/results.js';

console.log(`[LLM] provider=${process.env.LLM_PROVIDER || 'ollama'} model=${process.env.LLM_MODEL || '(default)'} base=${process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'}`);
console.log(`[EMB] model=${process.env.OLLAMA_EMBEDDINGS_MODEL || 'nomic-embed-text'} (Ollama)`);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 3001);

// ---- Health & questions ----
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/questions', (req, res) => res.json({ items: QUESTIONS }));

// ---- Soumission synchrone (avec persistance) ----
app.post('/api/student/submit', async (req, res) => {
  try {
    const { answers, examId = null, studentId = null } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: "answers[] requis" });
    }
    const results = [];
    for (const { questionId, studentAnswer } of answers) {
      try {
        const q = QUESTIONS_BY_ID[questionId];
        if (!q) {
          results.push({ questionId, error: 'Question inconnue' });
          continue;
        }
        const out = await gradeAnswer({
          questionId,
          questionText: q.text,
          studentAnswer: studentAnswer ?? "",
          rubric: q.rubric,
          contextDocs: []
        });
        results.push({ questionId, verdict: out.verdict, audit: out.audit });
        // persistance
        await saveResult({
          job_id: null,
          exam_id: examId,
          student_id: studentId,
          question_id: questionId,
          answer: studentAnswer,
          verdict: out.verdict,
          audit: out.audit
        });
      } catch (e) {
        console.error(`[submit] erreur sur ${questionId}:`, e?.message);
        results.push({ questionId, error: e?.message || 'Erreur interne (grading)' });
      }
    }
    const summary = {
      total: answers.length,
      correct: results.filter(r => r.verdict?.isCorrect).length
    };
    res.json({ results, summary });
  } catch (e) {
    console.error('[submit] fatal', e);
    res.status(500).json({ error: 'Erreur interne', details: e?.message });
  }
});

// ---- (Optionnel) Async avec BullMQ ----
let Queue, IORedis, queue;
if (process.env.REDIS_URL) {
  ({ Queue } = await import('bullmq'));
  IORedis = (await import('ioredis')).default;
  const conn = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null, enableOfflineQueue: false });
  queue = new Queue('grading', { connection: conn });
  console.log('[QUEUE] BullMQ actif');
}

app.post('/api/student/submit-async', async (req, res) => {
  if (!queue) return res.status(400).json({ error: 'Redis non configuré' });
  const { answers, examId = null, studentId = null } = req.body || {};
  if (!Array.isArray(answers) || !answers.length) return res.status(400).json({ error: 'answers[] requis' });
  const job = await queue.add('grade', { answers, examId, studentId }, { removeOnComplete: true, removeOnFail: true });
  res.json({ jobId: job.id });
});

app.get('/api/student/result/:jobId', async (req, res) => {
  const rows = await getResultsByJob(req.params.jobId);
  if (!rows.length) return res.status(404).json({ error: 'Aucun résultat pour ce job' });
  const summary = { total: rows.length, correct: rows.filter(r => r.is_correct).length };
  res.json({ results: rows, summary });
});

// ---- Boot ----
await initDb();

// Pré-chargement du modèle d'embeddings Ollama au démarrage
console.log('[Startup] Vérification de la disponibilité Ollama embeddings...');
getEmbedder()
  .then(() => console.log(`[Startup] ✅ Ollama embeddings prêts (${process.env.OLLAMA_EMBEDDINGS_MODEL || 'nomic-embed-text'})`))
  .catch(e => {
    console.warn(`[Startup] ⚠️ Ollama embeddings indisponibles: ${e.message}`);
    console.log('[Startup] → Le système utilisera le fallback Jaccard');
  });

app.listen(PORT, () => {
  console.log(`API backend sur http://localhost:${PORT}`);
});

// --- Admin (full) : résultats avec audit complet ---
try {
  // Express 'app' est déjà défini dans ce fichier
  app.get('/api/admin/results-full', async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)));
      const { listResultsFull } = await import('./repo/admin.js');
      const items = await listResultsFull({ limit });
      res.json({ items });
    } catch (e) {
      console.error('[admin/results-full] error', e);
      res.status(500).json({ error: 'admin_results_failed' });
    }
  });
} catch (e) {
  console.error('Failed to register /api/admin/results-full route:', e);
}
