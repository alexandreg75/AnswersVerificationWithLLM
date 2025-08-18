# Grader App — AI-assisted Answer Checking

Lightweight monorepo that auto-grades student answers with a **4-stage pipeline**:

1) **Deterministic rules** — MCQ, numeric tolerance, known formulas  
2) **Embeddings similarity** — semantic match vs. references  
3) **Concept coverage** — weighted key concepts & synonyms (formula-aware)  
4) **LLM judge** — only for “grey” cases; strict JSON + robust parsing

Final decision uses a **fusion** rule with safe fallbacks (handles LLM abstention). Includes a small **Admin UI** to inspect audits.

## Features

- Student UI (React/Vite) + **Admin UI** (`/admin`)
- Express API (Node) + local embeddings (Xenova, CPU)
- Optional **Ollama** (local LLM) for the judge stage
- Optional **async** mode (BullMQ) with Postgres/Redis
- Evaluation kit (`tools/`) to benchmark thresholds and accuracy
- Speed: **gating** avoids LLM calls on very clear cases; **LRU cache** for repeats

---

## Quick Start

```bash
npm i
# optional (local services)
docker compose -f infra/docker-compose.yml up -d

# env
cp apps/backend/.env.example apps/backend/.env
# optional async worker
cp apps/worker/.env.example apps/worker/.env

npm run dev
# Frontend → http://localhost:5173
# Backend  → http://localhost:3001
# Admin    → http://localhost:5173/admin
