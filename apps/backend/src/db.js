import pg from 'pg';
const { Pool } = pg;

const DB_URL = process.env.DB_URL || 'postgresql://grader:grader@localhost:5432/grader';
export const pool = new Pool({ connectionString: DB_URL });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grading_results (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      job_id TEXT,
      exam_id TEXT,
      student_id TEXT,
      question_id TEXT NOT NULL,
      answer TEXT,
      is_correct BOOLEAN,
      score_0_1 DOUBLE PRECISION,
      feedback TEXT,
      verdict JSONB,
      audit JSONB
    );
  `);
}
export const db = {
  query: (text, params) => pool.query(text, params)
};
