#!/usr/bin/env bash
# Grader App — project verification script
# Usage:
#   npm run verify
# Env:
#   VERIFY_RUN_EVAL=1   # also run tools/eval.mjs (optional)

set -u
IFS=$'\n\t'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ok()   { echo "OK   $*"; }
warn() { echo "WARN $*"; }
err()  { echo "ERR  $*"; }
info() { echo "•    $*"; }
SECTION() { echo; echo "== $* =="; }

# 0) Versions
SECTION "Versions"
node -v  >/dev/null 2>&1 && ok "Node: $(node -v)" || err "Node not found"
npm  -v  >/dev/null 2>&1 && ok "npm:  $(npm -v)"   || err "npm not found"
if command -v docker >/dev/null 2>&1; then
  ok "Docker detected"
  if docker compose version >/dev/null 2>&1; then ok "docker compose detected"; else warn "docker compose not available"; fi
else
  warn "Docker not found (infra checks will be skipped)"
fi
command -v curl >/dev/null 2>&1 && ok "curl detected" || warn "curl not found"

# 1) Node engine check (Vite 7 needs ^20.19.0 or >=22.12.0)
SECTION "Node engine check"
NODE_V_RAW="$(node -v 2>/dev/null || echo v0.0.0)"
NODE_MAJ="$(echo "$NODE_V_RAW" | sed -E 's/^v([0-9]+).*/\1/')"
NODE_MIN="$(echo "$NODE_V_RAW" | sed -E 's/^v[0-9]+\.([0-9]+).*/\1/')"
PASS_NODE=0
if { [ "$NODE_MAJ" -gt 22 ] ; } || { [ "$NODE_MAJ" -eq 22 ] && [ "$NODE_MIN" -ge 12 ] ; } || { [ "$NODE_MAJ" -eq 21 ] ; } || { [ "$NODE_MAJ" -eq 20 ] && [ "$NODE_MIN" -ge 19 ] ; }; then
  ok "Node satisfies Vite requirement: $NODE_V_RAW"
  PASS_NODE=1
else
  err "Node too old for Vite 7 (need ^20.19.0 or >=22.12.0) — current: $NODE_V_RAW"
fi

# 2) Env files presence
SECTION "Environment files"
for f in apps/backend/.env apps/worker/.env; do
  if [ -f "$f" ]; then
    ok "$f present"
  else
    if [ -f "${f}.example" ]; then
      warn "$f missing (copy from ${f}.example)"
    else
      warn "$f missing (no example found)"
    fi
  fi
done

# 3) Docker compose sanity (if available)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  SECTION "Docker compose sanity"
  if [ -f infra/docker-compose.yml ]; then
    if docker compose -f infra/docker-compose.yml config >/dev/null 2>&1; then
      ok "infra/docker-compose.yml is valid"
      DB_PORT="$(docker compose -f infra/docker-compose.yml port db 5432 2>/dev/null | awk -F: '{print $2}')"
      REDIS_PORT="$(docker compose -f infra/docker-compose.yml port redis 6379 2>/dev/null | awk -F: '{print $2}')"
      [ -n "${DB_PORT:-}" ]    && info "Postgres mapped port: $DB_PORT"
      [ -n "${REDIS_PORT:-}" ] && info "Redis mapped port:    $REDIS_PORT"
    else
      err "docker-compose.yml invalid"
    fi
  else
    warn "infra/docker-compose.yml not found"
  fi
fi

# 4) depcheck per workspace (non-blocking)
SECTION "depcheck (unused/missing deps)"
if ! command -v npx >/dev/null 2>&1; then
  warn "npx not found; skipping depcheck"
else
  for ws in apps/backend apps/frontend apps/worker; do
    [ -d "$ws" ] || continue
    echo "== $ws =="
    (cd "$ws" && npx -y depcheck) || true
  done
fi

# 5) Potential orphan files (heuristic), excluding node_modules/.vite and whitelists
SECTION "Potential orphan files (heuristic)"
entrypoints="apps/backend/src/server.js apps/frontend/src/main.jsx apps/worker/src/index.js"
FOUND=0
while IFS= read -r -d '' f; do
  case " $entrypoints " in *" $f "*) continue;; esac
  case "$f" in
    */node_modules/*|*/.vite/*) continue;;
    */vite.config.js|*/eslint.config.js) continue;;
    */src/api.js) continue;;
  esac
  base="$(basename "$f")"
  if ! grep -R --exclude-dir=node_modules --exclude-dir=.vite --exclude="$base" -n "[\"'/]$base" apps >/dev/null 2>&1; then
    echo "  • $f"
    FOUND=1
  fi
done < <(find apps \( -path "*/node_modules/*" -o -path "*/.vite/*" \) -prune -o -type f \( -name "*.js" -o -name "*.jsx" \) -print0)
if [ "$FOUND" = "0" ]; then
  ok "No obvious orphans (heuristic)"
else
  warn "Review the files above (could be false positives)."
fi

# 6) API health probe
SECTION "API health"
if command -v curl >/dev/null 2>&1; then
  if curl -fsS http://localhost:3001/health >/dev/null 2>&1; then
    ok "Backend health OK at http://localhost:3001/health"
  else
    warn "Backend not responding at http://localhost:3001/health (start dev first: npm run dev)"
  fi
fi

# 7) Optional evaluation kit
if [ "${VERIFY_RUN_EVAL:-0}" = "1" ] && [ -f tools/eval.mjs ]; then
  SECTION "Evaluation kit (tools/eval.mjs)"
  node tools/eval.mjs || warn "Evaluation failed (is backend running?)"
fi

SECTION "Done"
[ "$PASS_NODE" = "1" ] || exit 1
exit 0
