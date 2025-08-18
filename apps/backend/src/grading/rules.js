import { normalizeText, extractNumbers } from '../utils/text.js';

export function detectQuestionType({ questionText, rubric }) {
  if (rubric?.mcq) return 'mcq';
  if (rubric?.numericTolerance) return 'numeric';
  const t = normalizeText(questionText);
  if (/date|jour|mois|annee|quand/.test(t)) return 'date';
  if (/defini|definir|donne une definition|qu'est-ce que/.test(t)) return 'definition';
  return 'open';
}

export function checkMCQ({ studentAnswer, rubric }) {
  const norm = normalizeText(String(studentAnswer));
  const digits = norm.match(/\d+/g)?.map(n => parseInt(n, 10)) ?? [];
  const correct = (rubric.mcq.correctIndices || []).slice().sort().join(',');
  const given = digits.slice().sort().join(',');
  const isCorrect = correct === given;
  return { decidable: true, verdict: baseVerdict(isCorrect, isCorrect ? 1 : 0, 'QCM vérifié par clé') };
}

export function checkNumeric({ studentAnswer, rubric }) {
  const { abs = 0, rel = 0 } = rubric.numericTolerance || {};
  const nums = extractNumbers(studentAnswer);
  const refs = extractNumbers(rubric.references?.[0] || '');
  if (!nums.length || !refs.length) return { decidable: false };
  const x = nums[0];
  const r = refs[0];
  const maxTol = Math.max(abs, Math.abs(rel * r));
  const isCorrect = Math.abs(x - r) <= maxTol;
  return { decidable: true, verdict: baseVerdict(isCorrect, isCorrect ? 1 : 0, `Vérif. numérique (tolérance ±${maxTol})`) };
}

/** Règles dédiées: formules connues (Ohm, Puissance) */
export function checkKnownDefinitions({ questionText, studentAnswer }) {
  const q = normalizeText(questionText);
  const s = String(studentAnswer).toLowerCase();

  // Loi d'Ohm
  if (/\bloi d'?ohm\b/.test(q)) {
    const ohm =
      /u\s*=\s*r\s*([*x×·]\s*)?i/.test(s) ||
      /u\s*=\s*i\s*([*x×·]\s*)?r/.test(s);
    if (ohm) {
      return { decidable: true, verdict: baseVerdict(true, 1, "Règle: équation d'Ohm reconnue (U=R×I)") };
    }
  }

  // Puissance électrique
  if (/\bpuissance\b/.test(q) && /\bu\b/.test(q) && /\bi\b/.test(q)) {
    const power =
      /p\s*=\s*u\s*([*x×·]\s*)?i/.test(s) ||    // P=U*I, P=U×I, P=U I
      /p\s*=\s*i\s*([*x×·]\s*)?u/.test(s);      // P=I*U
    if (power) {
      return { decidable: true, verdict: baseVerdict(true, 1, "Règle: formule de puissance reconnue (P=U×I)") };
    }
  }

  return { decidable: false };
}

export function baseVerdict(isCorrect, score, note) {
  return {
    isCorrect,
    score_0_1: Math.max(0, Math.min(1, Number(score || 0))),
    feedback: note,
    audit: { stage: 'rules' }
  };
}
