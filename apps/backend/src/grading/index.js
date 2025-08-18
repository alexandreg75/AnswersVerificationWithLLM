import { normalizeText } from '../utils/text.js';
import { detectQuestionType, checkMCQ, checkNumeric, checkKnownDefinitions } from './rules.js';
import { embeddingSimilarity, conceptCoverage } from './embeddings.js';
import { llmJudge } from './judge.js';
import { fuse } from './fuse.js';
import { LRU } from '../cache/lru.js';

const CACHE = new LRU({
  max: parseInt(process.env.CACHE_SIZE || '500', 10),
  ttl: parseInt(process.env.CACHE_TTL_MS || '86400000', 10) // 24h par défaut
});

export async function gradeAnswer({ questionId, questionText, studentAnswer, rubric, contextDocs = [] }) {
  const key = `${questionId}|${normalizeText(String(studentAnswer || ''))}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  // 1) RÈGLES DÉTERMINISTES (formules connues, QCM, numérique)
  let precheck = checkKnownDefinitions({ questionText, studentAnswer, rubric });
  if (!precheck?.decidable) {
    const t = detectQuestionType({ questionText, rubric });
    if (t === 'mcq')    precheck = checkMCQ({ studentAnswer, rubric });
    if (t === 'numeric') precheck = checkNumeric({ studentAnswer, rubric });
  }

  // 2) EMBEDDINGS + COUVERTURE (rapide)
  const sim = await embeddingSimilarity(studentAnswer, rubric?.references || []);
  const coverage = conceptCoverage(studentAnswer, rubric?.concepts || []);

  // 3) GATING — n'appeler le LLM que pour les cas "gris"
  const HI_SIM = Number(process.env.FASTJ_HIGH_SIM || 0.82);
  const HI_COV = Number(process.env.FASTJ_HIGH_COV || 0.72);
  const LO_SIM = Number(process.env.FASTJ_LOW_SIM  || 0.45);
  const LO_COV = Number(process.env.FASTJ_LOW_COV  || 0.30);

  let judge = { score_0_1: 0, confidence_0_1: 0, reason: 'skipped' };

  if (!precheck?.decidable) {
    if (sim.best >= HI_SIM && coverage.coverage >= HI_COV) {
      // cas facile POSITIF → pas d'appel LLM (on laisse confidence=0 pour signaler l'abstention contrôlée)
      judge = { score_0_1: 0.6, confidence_0_1: 0, reason: 'skip_easy_positive' };
    } else if (sim.best <= LO_SIM || coverage.coverage <= LO_COV) {
      // cas facile NÉGATIF
      judge = { score_0_1: 0.0, confidence_0_1: 0, reason: 'skip_easy_negative' };
    } else {
      // cas GRIS → jugement LLM (coûteux)
      judge = await llmJudge({ questionText, studentAnswer, rubric, contextDocs });
    }
  }

  // 4) FUSION (inchangé, mais sait gérer l'abstention)
  const verdict = fuse({ precheck, sim, coverage, judge });
  const result = { verdict, audit: { sim, coverage, judge } };

  CACHE.set(key, result);
  return result;
}
