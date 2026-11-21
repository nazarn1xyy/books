# Libify

Monorepo: `apps/web` (React SPA), `apps/api` (Hono + Postgres), `packages/shared` (zod contracts), `deploy/`.
Specs and plans: `docs/superpowers/`.

## graphify (code knowledge graph)

The graph lives in `graphify-out/` (git-ignored) and is refreshed by git hooks (post-commit, post-checkout).

- If `graphify-out/graph.json` is missing, build it: `graphify update .`
- For questions about how the code is structured, use the graph first, then read only the files it points to:
  - `graphify query "<question>" --budget 1500` — matching is by words, so put real symbol/file names in the question (e.g. "SyncEngine Outbox pushAll"), not only prose
  - `graphify path "A" "B"` — how two symbols/files connect
  - `graphify explain "X"` — what a symbol/file is and what depends on it
  - `graphify-out/GRAPH_REPORT.md` — overview, communities, key nodes
