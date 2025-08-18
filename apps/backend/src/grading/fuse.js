export function fuse({ precheck, sim, coverage, judge }) {
  if (precheck?.decidable) {
    return annotate(precheck.verdict, { sim, coverage, judge });
  }

  // Seuils standards
  const T_SIM   = 0.70;
  const T_COV   = 0.55;
  const T_JUDGE = 0.55;
  const T_CONF  = 0.30;

  const passEmb   = (sim.best >= T_SIM) && (coverage.coverage >= T_COV);
  const passJudge = (judge.score_0_1 >= T_JUDGE) && (judge.confidence_0_1 >= T_CONF);

  // Abstention LLM -> voies de secours graduées
  const ABSTAIN = judge.confidence_0_1 === 0;
  if (ABSTAIN) {
    const s = sim.best, c = coverage.coverage;
    if (c >= 0.95) {
      // Couverture quasi parfaite (ex: merge sort) => OK
      return annotate({ isCorrect: true, score_0_1: 0.85, feedback: 'Conforme (couverture quasi parfaite, LLM abstention)' }, { sim, coverage, judge });
    }
    if (s >= 0.55 && c >= 0.70) {
      return annotate({ isCorrect: true, score_0_1: weightedScore({ simBest: s, cov: c, judge: 0.55 }) }, { sim, coverage, judge });
    }
    if (s >= 0.35 && c >= 0.65) {
      // cas Q9 : sim plus faible mais bonne couverture
      return annotate({ isCorrect: true, score_0_1: 0.65, feedback: 'Conforme (embeddings/couverture), LLM abstention' }, { sim, coverage, judge });
    }
    return annotate({ isCorrect: false, score_0_1: 0, feedback: 'Revue humaine requise' }, { sim, coverage, judge });
  }

  // Règle souple: (emb+cov) OU (judge)
  const isCorrect = passJudge || passEmb;
  const score = weightedScore({ simBest: sim.best, cov: coverage.coverage, judge: judge.score_0_1 });
  const feedback = isCorrect
    ? 'Réponse conforme aux critères'
    : `Concepts manquants: ${listMissing(coverage, judge)}`;

  return annotate({ isCorrect, score_0_1: score, feedback }, { sim, coverage, judge });
}

function weightedScore({ simBest, cov, judge }) {
  const wSim = 0.35, wCov = 0.35, wJudge = 0.30;
  return clamp(wSim*simBest + wCov*cov + wJudge*judge, 0, 1);
}
function listMissing(coverage, judge) {
  const fromJudge = (judge?.missing_concepts || []).slice(0, 3);
  const fromCov = (coverage?.details || []).filter(x => !x.present).map(x => x.label).slice(0, 3);
  const set = new Set([...fromJudge, ...fromCov].filter(Boolean));
  return Array.from(set).join(', ') || '—';
}
function annotate(result, audit) { return { ...result, audit }; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
