# W12-100-04 Resume

Status: implemented and validated; real source packet blocked.

## Branch And Worktree

- Repo: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\.w12-100-20260717-worktrees\W12-100-04`
- Branch: `codex/w12-100-04-real-source-dry-run-tooling`
- Starting commit: `0d8d7168f066668f035176d777bdaaa4dcc5accd`

## What Exists

- `scripts/w12-100/data/real-source-preflight.ts`
- `tests/unit/w12-100-data/real-source-preflight.test.ts`
- `tests/integration/w12-100-data/real-source-preflight-cli.test.ts`
- `ops/codex-runs/W12-100-04/REAL-SOURCE-PREFLIGHT.json`
- `ops/codex-runs/W12-100-04/APPLY-ROLLBACK-SCHEMA-PROPOSAL.md`

## Pickup Notes

The runner is counts-only and local-file-only. It does not connect to the
production database, does not write to any database, and does not send or mutate
providers.

The real-source artifact is blocked because the exact approved sanitized source
packet is not available locally. Do not point the tool at Downloads or unknown
spreadsheets as a substitute. The packet directory must contain exactly the six
approved files with the OPS-13A hashes.

If an approved packet is later supplied, run the preflight with a source
directory containing only that approved packet and review the blocked/done
status before any later lane considers apply work.

## Validation Already Run

- Focused unit: passed, 1 file / 3 tests.
- Focused integration: passed, 1 file / 2 tests.
- Secret scan: passed.
- Lint: passed.
- Typecheck: passed.
- Scoped Prettier check: passed.
- Full unit: passed, 39 files / 199 tests on rerun.
- Full integration: passed, 39 files / 186 tests.
- Build: passed with inherited Vite font URL warning only.

## Hard Stops

- Do not implement apply mode in this lane.
- Do not import or print source rows.
- Do not read production private rows.
- Do not connect to the production database.
- Do not send email, WhatsApp, Telegram, provider webhooks, payments, Zoom
  invitations, posts, or helper requests.
- Do not copy OPS-13A artifacts into this branch.
