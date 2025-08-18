import { normalizeText } from '../utils/text.js';
import { getEmbedder, cosineSimilarity } from './providers/embeddings/xenova.js';

export async function embed(texts = []) {
  const embedder = await getEmbedder();
  return embedder(texts.map(t => normalizeText(String(t || ''))));
}

export async function embeddingSimilarity(studentAnswer, references = []) {
  if (!references.length) return { best: 0, avg: 0 };
  try {
    const [ansVec, ...refVecs] = await embed([studentAnswer, ...references]);
    const sims = refVecs.map(v => cosineSimilarity(ansVec, v));
    const best = Math.max(...sims);
    const avg = sims.reduce((a, b) => a + b, 0) / sims.length;
    return { best, avg };
  } catch {
    // Fallback robuste (Jaccard)
    const a = tokenSet(studentAnswer);
    const sims = references.map(r => jaccard(a, tokenSet(r)));
    const best = Math.max(...sims);
    const avg = sims.reduce((x, y) => x + y, 0) / sims.length;
    return { best, avg, _fallback: 'jaccard' };
  }
}

export function conceptCoverage(studentAnswer, concepts = []) {
  const txt = String(studentAnswer || '');
  const normTxt = normalizeText(txt);
  const flatTxt = flattenForFormula(txt); // pour formules: supprime espaces/signes

  const units = concepts.map(c => ({
    label: c.label,
    poids: c.poids ?? 1,
    present: matchConcept(normTxt, flatTxt, c)
  }));
  const totalPoids = units.reduce((s, u) => s + (u.poids || 0), 0) || 1;
  const covered = units.reduce((s, u) => s + (u.present ? (u.poids || 0) : 0), 0);
  return { coverage: covered / totalPoids, details: units };
}

// ---------- helpers ----------
function matchConcept(normTxt, flatTxt, concept) {
  const needles = [concept.label, ...(concept.synonymes || [])].filter(Boolean);

  for (const raw of needles) {
    const label = normalizeText(raw);
    // Si le label est "mots simples" -> regex avec \b
    if (/^[a-z0-9\s]+$/i.test(label)) {
      const rx = new RegExp(`\\b${label.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (rx.test(normTxt)) return true;
    } else {
      // Sinon, "formule" -> on aplati et on fait un includes
      const flatNeedle = flattenForFormula(raw);
      if (flatNeedle && flatTxt.includes(flatNeedle)) return true;
    }
  }
  return false;
}

function flattenForFormula(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\W_]+/g, ''); // enlève espaces et symboles
}

function tokenSet(s) {
  return new Set(
    normalizeText(String(s || '')).split(/[^a-z0-9]+/i).filter(Boolean)
  );
}
function jaccard(aSet, bSet) {
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter++;
  const union = aSet.size + bSet.size - inter;
  return union ? inter / union : 0;
}
