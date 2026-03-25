# ✅ 10 Réponses CORRIGÉES - Tous les cas de gating

## Les 10 réponses à soumettre (copie-colle)

| # | Question | Réponse à mettre |
|---|----------|-----------------|
| 1 | q-capitale | `1` |
| 2 | q-primes | `1,3` |
| 3 | q-2pi | `6.28` |
| 4 | q-disk-area | `9.99` |
| 5 | q-ohm | `U = R * I` |
| 6 | q-power | `P = U * I` |
| 7 | q-photosynthese | `La photosynthèse est le processus par lequel les plantes convertissent l'énergie lumineuse en énergie chimique, en produisant du glucose à partir du dioxyde de carbone et de l'eau, et en libérant de l'oxygène.` |
| 8 | q-merge-sort | `Le tri fusion est un algorithme stable avec une complexité en temps de O(n log n).` |
| 9 | q-am-gm | `On sait que (a-b)² ≥ 0 toujours. En développant : a² + b² - 2ab ≥ 0. Donc a² + b² + 2ab ≥ 4ab. Par conséquent (a+b)² ≥ 4ab.` |
| 10 | q-overfitting | `Le surapprentissage est un phénomène où un modèle trop complexe apprend par cœur les données d'entraînement avec une erreur d'entraînement faible, au lieu de généraliser correctement aux nouvelles données, ce qui entraîne une mauvaise généralisation en test.` |

---

## 📊 Résumé - Cas attendus

| Q | Cas | LLM? | Temps | Verdict | Raison |
|---|-----|------|-------|---------|--------|
| 1 | CAS 1 | ❌ | 0.1s | ✅ Accept | Règle MCQ |
| 2 | CAS 1 | ❌ | 0.1s | ✅ Accept | Règle MCQ multi |
| 3 | CAS 1 | ❌ | 0.1s | ✅ Accept | Règle Numeric (dans intervalle) |
| 4 | CAS 1 | ❌ | 0.1s | ❌ Reject | Règle Numeric (hors intervalle) |
| 5 | CAS 1 | ❌ | 0.1s | ✅ Accept | Règle Formule U=R*I |
| 6 | CAS 1 | ❌ | 0.1s | ✅ Accept | Règle Formule P=U*I |
| 7 | CAS 2 | ❌ | 0.5s | ✅ Accept | skip_easy_positive (sim≥0.82 + cov≥0.72) |
| 8 | CAS 3 | ✅ | 7-10s | ✅ Accept | LLM juge (zone grise) |
| 9 | CAS 4 | ✅→abstain | 7-10s | ✅ Accept | LLM s'abstient → fallback |
| 10 | CAS 3 | ✅ | 7-10s | ✅ Accept | LLM juge (zone grise, couvre concepts) |

**Total: ~50-70 secondes** (6 rapides + 4 appels LLM)

---

## 🔍 Problème observé sur Q4 (q-disk-area)

**Fait rapporté:** La réponse `9.99` demande une revue humaine au lieu d'être rejetée directement par la règle numeric.

**Analyse:**
- Attendu: Coverage=0, sim=0.71 → `skip_easy_negative` (pas d'appel LLM) ✓
- Mais verdict final: "revue humaine" au lieu de "❌ Reject"
- **Problème:** Stage 1 ne détecte pas le type `numeric` correctement

**Cause possible:**
- Le regex pour extraire le nombre accepte `9,99` (virgule française) mais pas certains formats
- Ou: La question n'est pas identifiée comme `type: numeric` dans la DB

**À vérifier:**
- Essayer avec `9.99` (point américain) au lieu de `9,99`
- Ou: Ajouter un point ET la virgule: `9.99` ou `9,99`

**Code à vérifier:** [apps/backend/src/grading/rules.js](apps/backend/src/grading/rules.js) - fonction `checkNumeric()`

---

## 🎯 Flux attendu lors de la soumission

1. **Submit les 10 réponses** d'un coup via l'interface
2. **Attends 50-70 secondes** (plus rapide qu'avant grâce à Ollama qui fonctionne)
3. **Regarde les résultats:**
   - Q1-6: Virtuellement instantanés (règles)
   - Q7: Rapide, skip_easy_positive
   - Q8-10: Plus lents (5-10s chacun) = appels LLM

4. **Vérifies les audit trails** pour chaque réponse:
   - Cherche `judge.reason` pour voir le motif (rules, skip_easy_positive, llm_judge)
   - Vérifie `judge.confidence_0_1` (=0 = LLM s'abstient, >0 = LLM a décidé)

---

## ✅ Validation finale

Si les résultats matchent le tableau ci-dessus, tous les cas de gating fonctionnent correctement! 🎉
