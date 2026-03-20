/**
 * evaluate.js — Pipeline d'évaluation des métriques de correction
 *
 * Usage :
 *   node evaluation/evaluate.js              (tous les cas, LLM actif)
 *   node evaluation/evaluate.js --skip-llm   (passe les cas zone grise, LLM non requis)
 *   node evaluation/evaluate.js --verbose    (affiche le détail de chaque cas)
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { gradeAnswer } from '../src/grading/index.js';
import { QUESTIONS_BY_ID } from '../src/data/questions.sample.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const SKIP_LLM = args.includes('--skip-llm');
const VERBOSE  = args.includes('--verbose');

// ── Chargement du dataset ────────────────────────────────────────────────────
const dataset = JSON.parse(readFileSync(join(__dirname, 'dataset.json'), 'utf8'));
const toRun   = SKIP_LLM ? dataset.filter(d => d.path !== 'llm_judge') : dataset;

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ÉVALUATION DU PIPELINE — ${toRun.length} cas de test`);
if (SKIP_LLM) console.log('  ⚠️  Mode --skip-llm : cas zone grise exclus');
console.log(`${'═'.repeat(60)}\n`);

// ── Exécution ────────────────────────────────────────────────────────────────
const results = [];
let llmCallCount = 0;
let llmAbstainCount = 0;
let totalLatencyMs = 0;
const latencies = [];

for (const item of toRun) {
  const q = QUESTIONS_BY_ID[item.questionId];
  if (!q) {
    console.error(`[SKIP] Question inconnue: ${item.questionId}`);
    continue;
  }

  const t0 = Date.now();
  let out;
  try {
    out = await gradeAnswer({
      questionId:    item.questionId,
      questionText:  q.text,
      studentAnswer: item.studentAnswer,
      rubric:        q.rubric,
      contextDocs:   []
    });
  } catch (e) {
    console.error(`[ERREUR] id=${item.id}: ${e.message}`);
    results.push({ ...item, predicted: null, error: e.message, latencyMs: Date.now() - t0 });
    continue;
  }

  const latencyMs = Date.now() - t0;
  latencies.push(latencyMs);
  totalLatencyMs += latencyMs;

  const predicted = out.isCorrect ?? out.verdict?.isCorrect ?? false;
  const judge     = out.audit?.judge ?? out.verdict?.audit?.judge;
  const actualPath = judge?.reason ?? 'unknown';

  // Compteurs LLM
  if (!['skip_easy_positive','skip_easy_negative','skipped'].includes(actualPath) &&
      !actualPath.startsWith('rules') &&
      judge?.confidence_0_1 !== undefined) {
    llmCallCount++;
    if (judge.confidence_0_1 === 0 && actualPath !== 'skip_easy_positive' && actualPath !== 'skip_easy_negative') {
      llmAbstainCount++;
    }
  }

  const ok = predicted === item.expected;
  results.push({ ...item, predicted, ok, latencyMs, actualPath });

  if (VERBOSE || !ok) {
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} [${String(item.id).padStart(2)}] ${item.questionId}`);
    console.log(`   Attendu: ${item.expected} | Prédit: ${predicted} | Chemin: ${actualPath} | ${latencyMs}ms`);
    console.log(`   ${item.note}`);
    if (!ok) {
      const sim = out.audit?.sim ?? out.verdict?.audit?.sim;
      const cov = out.audit?.coverage ?? out.verdict?.audit?.coverage;
      console.log(`   sim.best=${sim?.best?.toFixed(3)} coverage=${cov?.coverage?.toFixed(3)}`);
    }
    console.log('');
  }
}

// ── Calcul des métriques ─────────────────────────────────────────────────────
const valid   = results.filter(r => r.predicted !== null && r.predicted !== undefined);
const TP = valid.filter(r =>  r.predicted &&  r.expected).length;
const TN = valid.filter(r => !r.predicted && !r.expected).length;
const FP = valid.filter(r =>  r.predicted && !r.expected).length;
const FN = valid.filter(r => !r.predicted &&  r.expected).length;

const precision = TP + FP > 0 ? TP / (TP + FP) : 0;
const recall    = TP + FN > 0 ? TP / (TP + FN) : 0;
const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
const accuracy  = valid.length > 0 ? (TP + TN) / valid.length : 0;

// Latence P50 / P95
const sorted = [...latencies].sort((a, b) => a - b);
const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? 0;
const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
const avgLat = latencies.length ? Math.round(totalLatencyMs / latencies.length) : 0;

// Répartition par chemin
const byPath = {};
for (const r of valid) {
  byPath[r.path] = (byPath[r.path] || 0) + 1;
}
const zoneGriseCount = byPath['llm_judge'] ?? 0;
const zoneGrisePct   = valid.length ? (zoneGriseCount / valid.length * 100).toFixed(1) : 0;
const abstainPct     = llmCallCount ? (llmAbstainCount / llmCallCount * 100).toFixed(1) : 'N/A';

// ── Rapport final ────────────────────────────────────────────────────────────
console.log(`${'═'.repeat(60)}`);
console.log('  MÉTRIQUES DE PERFORMANCE');
console.log(`${'═'.repeat(60)}`);
console.log(`\n  Matrice de confusion`);
console.log(`  ┌──────────────────────────────┐`);
console.log(`  │  TP (vrais positifs) : ${String(TP).padStart(4)}  │`);
console.log(`  │  TN (vrais négatifs) : ${String(TN).padStart(4)}  │`);
console.log(`  │  FP (faux positifs)  : ${String(FP).padStart(4)}  │  ← accepte à tort`);
console.log(`  │  FN (faux négatifs)  : ${String(FN).padStart(4)}  │  ← pénalise à tort`);
console.log(`  └──────────────────────────────┘`);
console.log(`\n  Métriques globales`);
console.log(`  ┌──────────────────────────────┐`);
console.log(`  │  Précision  : ${(precision * 100).toFixed(1).padStart(5)}%          │`);
console.log(`  │  Recall     : ${(recall    * 100).toFixed(1).padStart(5)}%          │`);
console.log(`  │  F1-score   : ${(f1        * 100).toFixed(1).padStart(5)}%          │`);
console.log(`  │  Accuracy   : ${(accuracy  * 100).toFixed(1).padStart(5)}%          │`);
console.log(`  └──────────────────────────────┘`);
console.log(`\n  Métriques spécifiques au pipeline`);
console.log(`  ┌──────────────────────────────────────────┐`);
console.log(`  │  Cas évalués       : ${String(valid.length).padStart(3)}                    │`);
console.log(`  │  Zone grise (LLM)  : ${String(zoneGriseCount).padStart(3)} / ${String(valid.length).padStart(3)} (${zoneGrisePct}%)  │`);
console.log(`  │  Taux abstention   : ${String(abstainPct).padStart(6)}                │`);
console.log(`  │  Latence moyenne   : ${String(avgLat).padStart(5)} ms               │`);
console.log(`  │  Latence P50       : ${String(p50).padStart(5)} ms               │`);
console.log(`  │  Latence P95       : ${String(p95).padStart(5)} ms               │`);
console.log(`  └──────────────────────────────────────────┘`);
console.log(`\n  Répartition par chemin pipeline`);
for (const [path, count] of Object.entries(byPath)) {
  const bar = '█'.repeat(Math.round(count / valid.length * 20));
  console.log(`  ${path.padEnd(22)} ${String(count).padStart(3)} ${bar}`);
}

if (FP > 0 || FN > 0) {
  console.log(`\n  ⚠️  Erreurs détectées`);
  for (const r of valid.filter(r => !r.ok)) {
    const type = r.predicted && !r.expected ? 'FP' : 'FN';
    console.log(`  [${type}] id=${r.id} ${r.questionId} — ${r.note}`);
  }
}

console.log(`\n${'═'.repeat(60)}\n`);
