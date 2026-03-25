# AnswersVerificationWithLLM — Grader App

> **Automatic answer grading** for student exams using a 4-stage hybrid AI pipeline: deterministic rules → semantic embeddings → concept coverage → LLM judge.

**📹 Demo Video:** [YouTube](https://youtu.be/2gfJSEfAVHI?si=AM2RYZx6avxb7K4u)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Grading Pipeline (4 stages)](#3-grading-pipeline-4-stages)
4. [Tech Stack](#4-tech-stack)
5. [Getting Started](#5-getting-started)
6. [Environment Variables](#6-environment-variables)
7. [API Reference](#7-api-reference)
8. [Question Bank & Rubric Format](#8-question-bank--rubric-format)
9. [Threshold Calibration](#9-threshold-calibration)
10. [Limitations & Honest Analysis](#10-limitations--honest-analysis)
11. [Screenshots](#11-screenshots)

---

## 1. Project Overview

**Goal:** Build a web application that automatically grades student answers and returns:

- A **verdict**: `Correct` / `Incorrect` / `Needs human review`
- A short **feedback** message
- A full **audit trail** explaining the decision (per-stage scores)

The system is designed to be fast (LRU cache + LLM gating), explainable (full audit JSON), and safe (human-in-the-loop for uncertain cases).

---

## 2. Architecture

```
grader-app/
├── apps/
│   ├── frontend/          # React + Vite  →  Student UI + /admin
│   ├── backend/           # Node + Express →  REST API + grading engine
│   └── worker/            # BullMQ worker  →  async grading (optional)
├── infra/
│   └── docker-compose.yml # Postgres 16 + Redis 7
├── scripts/
│   └── verify.sh          # env/version/health/deps checks
└── package.json           # npm workspaces monorepo
```

### Data flow

```
Browser (Student)
   │  POST /api/student/submit
   ▼
Express API (backend :3001)
   │
   ├── Stage 1 ─ Rules (deterministic: MCQ, numeric, known formulas)
   │     └─ decidable? ──yes──► verdict (fast exit)
   │
  ├── Stage 2 ─ Embeddings similarity  (Ollama/nomic-embed-text, CPU)
  │     └─ sim_best = cosine(ans, best_ref)
   │
   ├── Stage 3 ─ Concept coverage  (weighted keywords + synonyms)
   │     └─ coverage = Σ w_k · present(k) / Σ w_k
   │
   ├── Gating ─ skip LLM if clearly correct/incorrect
   │
   ├── Stage 4 ─ LLM Judge (Ollama, local)  ← only for grey zone
   │     └─ JSON: {is_correct, score_0_1, confidence_0_1, missing_concepts}
   │
   └── Fusion ─ combine stages → final verdict + audit
         │
         ▼
    Postgres (grading_results)    LRU cache (in-memory)
         │
         ▼
Browser (Admin /admin)
   GET /api/admin/results-full
```

---

## 3. Grading Pipeline (4 stages)

### Stage 1 — Deterministic Rules

Handles closed-form question types immediately, without any ML:

| Type | Check |
|---|---|
| **MCQ** | Parse digit indices from answer, compare to `correctIndices` |
| **Numeric** | Extract number, verify `|x − target| ≤ max(abs_tol, rel_tol × target)` |
| **Known formulas** | Regex matching for Ohm's law (`U=R×I`), electrical power (`P=U×I`) |

If a rule fires → exit immediately with verdict (no embedding or LLM call).

### Stage 2 — Embedding Similarity

- Model: **Ollama** with `nomic-embed-text` (768-dim vectors, fast local inference)
- Computes cosine similarity between student answer and each reference answer
- **`sim_best`** = max cosine similarity across all references
- Fallback: Jaccard similarity on tokens if Ollama embeddings unavailable

### Stage 3 — Concept Coverage

- Each open question has a list of weighted `concepts` with `synonymes[]`
- **`coverage`** = `Σ w_k · present(k) / Σ w_k`
- Matching: word boundary regex for plain terms; flattened string includes for formulas
- Output includes `details[]` — which concepts were/weren't found

### Gating (latency reduction)

```
if sim_best ≥ HI_SIM AND coverage ≥ HI_COV  →  skip LLM (accept)
if sim_best ≤ LO_SIM OR  coverage ≤ LO_COV  →  skip LLM (reject)
else                                          →  call LLM judge
```

Default thresholds (configurable via env):

| Variable | Default | Meaning |
|---|---|---|
| `FASTJ_HIGH_SIM` | `0.82` | "clearly correct" similarity |
| `FASTJ_HIGH_COV` | `0.72` | "clearly correct" coverage |
| `FASTJ_LOW_SIM` | `0.45` | "clearly wrong" similarity |
| `FASTJ_LOW_COV` | `0.30` | "clearly wrong" coverage |

### Stage 4 — LLM Judge (Ollama)

- Only called for "grey zone" answers
- Receives: question + rubric + student answer
- Must reply in **strict JSON**:
  ```json
  {
    "is_correct": true,
    "score_0_1": 0.85,
    "confidence_0_1": 0.9,
    "missing_concepts": [],
    "reasoning_brief": "..."
  }
  ```
- Robust parsing: direct parse → regex extraction → retry with strict prompt → abstention
- Schema validated with AJV

### Fusion (final decision)

```
if rules decided  →  rules verdict
else:
  passEmb   = (sim_best ≥ T_SIM=0.70) AND (coverage ≥ T_COV=0.55)
  passJudge = (llm_score ≥ T_JUDGE=0.55) AND (llm_conf ≥ T_CONF=0.30)
  isCorrect = passEmb OR passJudge

  if LLM abstained (confidence=0):
    coverage ≥ 0.95           → Correct (near-perfect coverage)
    sim ≥ 0.55 AND cov ≥ 0.70 → Correct (weighted score)
    sim ≥ 0.35 AND cov ≥ 0.65 → Correct (fallback)
    else                       → "Needs human review"
```

Final score is a weighted blend: `0.35·sim + 0.35·coverage + 0.30·llm_score`.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS (Admin UI) |
| Backend | Node.js (ESM), Express 4 |
| Embeddings | **Ollama** — `nomic-embed-text` (768-dim, local inference) |
| LLM Judge | **Ollama** — `llama2` or `neural-chat` (local inference) |
| Schema validation | AJV 8 |
| Database | PostgreSQL 16 (via `pg` pool) |
| Queue (optional) | BullMQ + Redis 7 (async grading) |
| Cache | LRU in-memory (configurable size + TTL) |
| Infrastructure | Docker Compose + Ollama |

---

## 5. Getting Started

### Prerequisites

- Node.js ≥ 20 (see `.nvmrc`)
- Docker + Docker Compose (for Postgres & Redis)
- [Ollama](https://ollama.ai) (optional, for LLM judge stage)

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure (Postgres + Redis)

```bash
docker compose -f infra/docker-compose.yml up -d
```

This starts:
- PostgreSQL on port `5433` (mapped from container's 5432)
- Redis on port `6379`

### 3. Configure environment

```bash
cp apps/backend/.env.example apps/backend/.env
# Edit as needed (DB_URL, OLLAMA_BASE_URL, etc.)
```

### 4. (Optional) Start Ollama

```bash
ollama serve
ollama pull llama3          # or any model you prefer
```

### 5. Launch the application

```bash
npm run dev
```

This starts three processes concurrently:
- **Backend API** → `http://localhost:3001`
- **Frontend (Student UI)** → `http://localhost:5173`
- **Worker** (if Redis configured)

### 6. Verify your setup

```bash
npm run verify
```

Checks Node version, env file, Docker services, API health, and dependencies.

### URLs

| URL | Description |
|---|---|
| `http://localhost:5173` | Student exam interface |
| `http://localhost:5173/admin` | Admin dashboard (live audits) |
| `http://localhost:3001/health` | Backend health check |
| `http://localhost:3001/api/questions` | Question bank (JSON) |

---

## 6. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend HTTP port |
| `DB_URL` | `postgresql://grader:grader@localhost:5433/grader` | PostgreSQL connection string |
| `REDIS_URL` | _(empty)_ | Redis URL — enables async mode if set |
| `LLM_MODEL` | `llama2` | LLM model name (via Ollama) |
| `OLLAMA_EMBEDDINGS_URL` | `http://127.0.0.1:11434/api/embed` | Ollama embeddings API endpoint |
| `OLLAMA_EMBEDDINGS_MODEL` | `nomic-embed-text` | Embedding model (Ollama) |
| `CACHE_SIZE` | `500` | LRU cache max entries |
| `CACHE_TTL_MS` | `86400000` | LRU cache TTL (24h) |
| `FASTJ_HIGH_SIM` | `0.82` | Gating: "clearly correct" sim threshold |
| `FASTJ_HIGH_COV` | `0.72` | Gating: "clearly correct" coverage threshold |
| `FASTJ_LOW_SIM` | `0.45` | Gating: "clearly wrong" sim threshold |
| `FASTJ_LOW_COV` | `0.30` | Gating: "clearly wrong" coverage threshold |

---

## 7. API Reference

### `GET /health`
Returns `{ "ok": true }`.

### `GET /api/questions`
Returns the full question bank.
```json
{ "items": [ { "id": "q-ohm", "text": "...", "type": "open", "rubric": {...} } ] }
```

### `POST /api/student/submit`
Grade a student's answers (synchronous).

**Request:**
```json
{
  "answers": [
    { "questionId": "q-ohm", "studentAnswer": "U = R × I" }
  ],
  "examId": "exam-2025",
  "studentId": "student-42"
}
```

**Response:**
```json
{
  "results": [
    {
      "questionId": "q-ohm",
      "verdict": {
        "isCorrect": true,
        "score_0_1": 0.95,
        "feedback": "Règle: équation d'Ohm reconnue (U=R×I)",
        "audit": { "stage": "rules" }
      },
      "audit": { "sim": {...}, "coverage": {...}, "judge": {...} }
    }
  ],
  "summary": { "total": 1, "correct": 1 }
}
```

### `POST /api/student/submit-async` _(requires Redis)_
Enqueues answers for async grading. Returns `{ "jobId": "..." }`.

### `GET /api/student/result/:jobId` _(requires Redis)_
Poll for async grading results.

### `GET /api/admin/results-full?limit=N`
Returns the N most recent grading results with full audit data (for Admin UI).

---

## 8. Question Bank & Rubric Format

Questions live in `apps/backend/src/data/questions.sample.js`.

### MCQ
```json
{
  "id": "q-primes",
  "type": "mcq",
  "rubric": {
    "mcq": { "correctIndices": [1, 3] }
  }
}
```

### Numeric
```json
{
  "id": "q-2pi",
  "type": "numeric",
  "rubric": {
    "numericTolerance": { "abs": 0.01, "rel": 0 },
    "references": ["6.28318"]
  }
}
```

### Open (with concepts + references)
```json
{
  "id": "q-photosynthese",
  "type": "open",
  "rubric": {
    "concepts": [
      { "label": "lumière", "poids": 0.2, "synonymes": ["énergie lumineuse", "soleil"] },
      { "label": "glucose",  "poids": 0.2, "synonymes": ["sucre"] }
    ],
    "references": [
      "La photosynthèse est le processus par lequel les plantes convertissent..."
    ]
  }
}
```

---

## 9. Threshold Calibration

Current thresholds (`T_SIM`, `T_COV`, `T_JUDGE`, `T_CONF`, gating bounds) are manually set based on domain intuition. The planned approach to learn optimal thresholds:

### Option A — Grid/Random Search on annotated dataset
1. Build a labelled dataset: `(questionId, studentAnswer, ground_truth_label)`
2. Run the pipeline on all entries to collect `(sim_best, coverage, llm_score)` vectors
3. Grid-search over threshold combinations to maximize **F1** or **accuracy** under a "human review rate" constraint
4. Optionally: train a logistic regression fusion model to predict `P(correct | sim, cov, llm_score)`

### Option B — LLM-first calibration (professor's suggestion)
Skip stages 1–3 entirely; use the LLM judge as the sole ground truth generator on a sample set. Then use those LLM verdicts to calibrate the thresholds for stages 2 and 3 (which are deterministic and cheaper to run at scale). This approach trades compute cost during calibration for faster inference in production.

### MLOps notes
- All thresholds are externalized as **environment variables** — no code change needed to recalibrate
- Full audit stored in Postgres → enables offline analysis and threshold simulation
- A `tools/` evaluation kit directory is planned for automated benchmark runs

---

## 10. Limitations & Honest Analysis

| Limitation | Impact | Mitigation |
|---|---|---|
| **Ollama latency** (2–10 s/call) | Slow for grey-zone answers | Gating + LRU cache reduces LLM calls significantly |
| **Embedding model size** (first load ~500 MB) | Cold start takes ~10–30 s | Model cached in memory after first load |
| **Thresholds are hand-tuned** | May produce wrong verdicts on edge cases | See §9 — calibration roadmap |
| **Concept matching is lexical** | Misses paraphrases not in `synonymes[]` | Mitigated by embedding stage; synonymes list must be maintained |
| **Single-language** | French-centric rubrics | Embedding model (`nomic-embed-text` via Ollama) supports different langages but is not optimized for french |
| **No authentication** | Admin UI is public | Out of scope for MVP; JWT dependency is present for future use |
| **No CI/CD** | Manual testing only | `npm run verify` script covers basic checks; GitHub Actions planned |
| **Small question bank** | Only 8 demo questions | Easily extended via `questions.sample.js` |

---

## 11. Screenshots

### Student UI — Exam interface

> Students answer all questions in a single form and receive instant feedback after submission.

![Student UI](docs/screenshots/student-ui.png)

### Student UI — Results

> Each answer shows Correct/Incorrect badge, score percentage, and feedback from the pipeline.

![Student Results](docs/screenshots/student-results.png)

### Admin Dashboard — Live audits

> The admin view lists all recent submissions with full audit trails. Yellow rows require human review.

![Admin Dashboard](docs/screenshots/admin-dashboard.png)

### Admin Dashboard — Audit detail

> Clicking "Afficher audit" reveals the complete JSON audit: sim scores, concept coverage, LLM judge output, and the fusion decision.

![Admin Audit Detail](docs/screenshots/admin-audit.png)

---

## Project Structure (summary)

```
apps/backend/src/
├── cache/lru.js                  # LRU in-memory cache
├── data/questions.sample.js      # Question bank + rubrics
├── db.js                         # Postgres pool + schema init
├── grading/
│   ├── index.js                  # Pipeline orchestrator + cache
│   ├── rules.js                  # Stage 1: deterministic rules
│   ├── embeddings.js             # Stage 2 & 3: similarity + coverage
│   ├── judge.js                  # Stage 4: LLM judge (AJV schema)
│   ├── fuse.js                   # Fusion + fallback logic
│   └── providers/
│       ├── embeddings/xenova.js  # (Legacy) Xenova embedder, now replaced by Ollama
│       └── llm/ollama.js         # Ollama HTTP client
├── repo/
│   ├── results.js                # Save / query grading results
│   └── admin.js                  # Admin full results query
├── schemas/rubric.schema.json    # JSON Schema for rubric validation
├── server.js                     # Express app + routes
└── utils/
    ├── json.js                   # Safe JSON parse
    └── text.js                   # Normalize, extract numbers

apps/frontend/src/
├── App.jsx                       # Student exam UI
├── api.js                        # Fetch wrappers
└── pages/Admin.jsx               # Admin dashboard

apps/worker/src/index.js          # BullMQ async worker
infra/docker-compose.yml          # Postgres + Redis
scripts/verify.sh                 # Project health checks
```

---

*Projet de Fin d'Études — Telecom SudParis, 2025*
