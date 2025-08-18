import "dotenv/config";
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Importe le gradeur et la DB depuis le backend (monorepo)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../../backend/src');

const { gradeAnswer } = await import(path.join(backendRoot, 'grading/index.js'));
const { initDb } = await import(path.join(backendRoot, 'db.js'));
const { saveResult } = await import(path.join(backendRoot, 'repo/results.js'));

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null, enableOfflineQueue: false });

await initDb();
console.log('[worker] DB OK');

new Worker('grading', async job => {
  console.log(`[worker] job ${job.id} reçu, ${job.data.answers?.length || 0} réponses`);
  const { answers = [], examId = null, studentId = null } = job.data || {};
  for (const { questionId, studentAnswer } of answers) {
    const { default: QUESTIONS } = await import(path.join(backendRoot, 'data/questions.sample.js'));
    const q = QUESTIONS.find(x => x.id === questionId);
    if (!q) continue;

    const out = await gradeAnswer({
      questionId,
      questionText: q.text,
      studentAnswer: studentAnswer ?? '',
      rubric: q.rubric,
      contextDocs: []
    });

    await saveResult({
      job_id: String(job.id),
      exam_id: examId,
      student_id: studentId,
      question_id: questionId,
      answer: studentAnswer,
      verdict: out.verdict,
      audit: out.audit
    });
  }
  return { ok: true };
}, { connection });

console.log('[worker] prêt (BullMQ)');
