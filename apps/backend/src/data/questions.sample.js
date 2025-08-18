export const QUESTIONS = [
  /* 0. Exemples existants */
  {
    id: 'q-ohm',
    text: "Définir la loi d'Ohm.",
    type: 'open',
    rubric: {
      concepts: [
        { label: "loi d'Ohm", poids: 0.5, synonymes: ["loi d ohm","loi ohm","U=RI","U = R I","U=R*I","u=r*i","u=r×i","u=r.i"] },
        { label: "proportionnalité", poids: 0.25, synonymes: ["proportionnelle","proportion"] },
        { label: "tension", poids: 0.125, synonymes: ["u","différence de potentiel","ddp"] },
        { label: "courant", poids: 0.125, synonymes: ["i","intensité"] }
      ],
      references: [
        "La loi d'Ohm énonce que la tension U est proportionnelle au courant I dans un dipôle ohmique : U = R × I."
      ]
    }
  },
  {
    id: 'q-2pi',
    text: "Donner la valeur de 2π arrondie à 2 décimales.",
    type: 'numeric',
    rubric: {
      numericTolerance: { abs: 0.01, rel: 0 },
      references: ["6.28318"]
    }
  },
  {
    id: 'q-capitale',
    text: "Sélectionnez la capitale de la France: 1) Paris  2) Lyon  3) Marseille. Répondez par l'indice (ex: 1).",
    type: 'mcq',
    rubric: { mcq: { correctIndices: [1], choices: ["Paris","Lyon","Marseille"] } }
  },

  /* 1. RÈGLES — Numérique (tolérance) */
  {
    id: 'q-disk-area',
    text: "Calcule l'aire d'un disque de rayon 2, arrondie à deux décimales.",
    type: 'numeric',
    rubric: {
      numericTolerance: { abs: 0.02, rel: 0 },
      references: ["12.56637"]
    }
  },

  /* 2. RÈGLES — QCM multi-réponses */
  {
    id: 'q-primes',
    text: "Quels sont les nombres premiers ? 1) 2  2) 9  3) 11  4) 15. Répondez par les indices (ex: 1,3).",
    type: 'mcq',
    rubric: { mcq: { correctIndices: [1,3], choices: ["2","9","11","15"] } }
  },

  /* 3. EMBEDDINGS — Photosynthèse (synonymes enrichis) */
  {
    id: 'q-photosynthese',
    text: "En une phrase, définis la photosynthèse.",
    type: 'open',
    rubric: {
      concepts: [
        { label: "lumière", poids: 0.2, synonymes: ["énergie lumineuse","lumiere","soleil","lumière du soleil"] },
        { label: "dioxyde de carbone", poids: 0.2, synonymes: ["co2","dioxyde","gaz carbonique"] },
        { label: "glucose", poids: 0.2, synonymes: ["sucre","sucre simple"] },
        { label: "oxygène", poids: 0.2, synonymes: ["o2","oxygene"] },
        { label: "chlorophylle", poids: 0.2, synonymes: ["pigment vert"] }
      ],
      references: [
        "La photosynthèse est le processus par lequel les plantes convertissent l'énergie lumineuse en énergie chimique, en produisant du glucose à partir du dioxyde de carbone et de l'eau, et en libérant de l'oxygène.",
        "Les plantes utilisent la lumière du soleil pour fabriquer du glucose à partir du CO2 et de l'eau; l'oxygène est rejeté."
      ]
    }
  },

  /* 4. CONCEPT COVERAGE — Merge sort (plus de variantes) */
  {
    id: 'q-merge-sort',
    text: "Cite au moins deux caractéristiques de l’algorithme tri fusion (merge sort).",
    type: 'open',
    rubric: {
      concepts: [
        { label: "diviser pour régner", poids: 0.34, synonymes: ["divide and conquer","divide-et-impera","division-fusion"] },
        { label: "O(n log n)", poids: 0.33, synonymes: ["complexité n log n","nlogn","n log n","n-log-n","O(nlogn)"] },
        { label: "stable", poids: 0.33, synonymes: ["stabilité","algorithme stable"] }
      ],
      references: [
        "Le tri fusion est un algorithme de type diviser pour régner, stable, dont la complexité en temps est O(n log n)."
      ]
    }
  },

  /* 5. LLM JUDGE — Preuve AM-GM (indices enrichis) */
  {
    id: 'q-am-gm',
    text: "Montrer que pour tout a,b ≥ 0, (a+b)^2 ≥ 4ab (indice : (a-b)^2 ≥ 0).",
    type: 'open',
    rubric: {
      concepts: [
        { label: "(a-b)^2 ≥ 0", poids: 0.4, synonymes: ["(a-b)^2 >= 0","carre positif","identité remarquable"] },
        { label: "développement", poids: 0.3, synonymes: ["développer (a+b)^2","a^2+2ab+b^2","a2+2ab+b2"] },
        { label: "conclusion", poids: 0.3, synonymes: ["donc (a+b)^2 ≥ 4ab","(a+b)^2 >= 4ab"] }
      ],
      references: [
        "Comme (a-b)^2 ≥ 0, on a a^2 - 2ab + b^2 ≥ 0, donc a^2 + 2ab + b^2 ≥ 4ab, soit (a+b)^2 ≥ 4ab."
      ]
    }
  },

  /* 6. FUSION — Overfitting (synonymes enrichis) */
  {
    id: 'q-overfitting',
    text: "Définis le surapprentissage (overfitting) en apprentissage automatique.",
    type: 'open',
    rubric: {
      concepts: [
        { label: "erreur d'entraînement faible", poids: 0.34, synonymes: ["faible perte train","faible erreur sur train","memorisation"] },
        { label: "généralisation faible", poids: 0.33, synonymes: ["forte erreur test","mauvaise généralisation","variance élevée","variance haute"] },
        { label: "modèle trop complexe", poids: 0.33, synonymes: ["complexité élevée","capacité trop grande","modèle sur-paramétré"] }
      ],
      references: [
        "Le surapprentissage correspond à un modèle trop complexe qui s'ajuste très bien aux données d'entraînement (faible erreur) mais généralise mal (erreur test élevée)."
      ]
    }
  },

  /* 7. Contrôle — Formule de puissance */
  {
    id: 'q-power',
    text: "Donner la relation de la puissance électrique P en fonction de la tension U et du courant I.",
    type: 'open',
    rubric: {
      concepts: [
        { label: "P = U × I", poids: 1, synonymes: ["P=UI","P = U*I","p=u*i","puissance u fois i","P = I × U"] }
      ],
      references: ["La puissance électrique se calcule par P = U × I."]
    }
  }
];

export const QUESTIONS_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
export default QUESTIONS;
