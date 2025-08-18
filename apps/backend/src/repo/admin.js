/**
 * Accès DB robuste (quel que soit l'export de db.js : db, pool, default...)
 */
import * as DB from '../db.js';

function getQueryFn() {
  const cand = DB.db || DB.pool || DB.default || DB;
  if (cand && typeof cand.query === 'function') return cand.query.bind(cand);
  if (typeof DB.query === 'function') return DB.query.bind(DB);
  throw new Error('Aucune fonction query() trouvée dans db.js');
}

/**
 * Derniers résultats avec AUDIT complet (pour page Admin)
 */
export async function listResultsFull({ limit = 50 }) {
  const query = getQueryFn();
  const { rows } = await query(
    `SELECT id, created_at, job_id, exam_id, student_id, question_id,
            answer, is_correct, score_0_1, feedback, verdict, audit
     FROM grading_results
     ORDER BY created_at DESC
     LIMIT $1`, [limit]
  );
  return rows || [];
}
