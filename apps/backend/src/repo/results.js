import { db } from '../db.js';

export async function saveResult({ job_id = null, exam_id = null, student_id = null, question_id, answer, verdict, audit }) {
  const { isCorrect, score_0_1, feedback } = verdict || {};
  await db.query(
    `INSERT INTO grading_results (job_id, exam_id, student_id, question_id, answer, is_correct, score_0_1, feedback, verdict, audit)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [job_id, exam_id, student_id, question_id, String(answer ?? ''), !!isCorrect, Number(score_0_1 ?? 0), feedback || '', verdict || {}, audit || {}]
  );
}

export async function listResults({ limit = 50 }) {
  const { rows } = await db.query(
    `SELECT id, created_at, job_id, exam_id, student_id, question_id, is_correct, score_0_1, feedback
     FROM grading_results
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getResultsByJob(jobId) {
  const { rows } = await db.query(
    `SELECT *
     FROM grading_results
     WHERE job_id = $1
     ORDER BY created_at ASC`,
    [jobId]
  );
  return rows;
}
