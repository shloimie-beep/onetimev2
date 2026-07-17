# W12-100-04 Final Report

Generated: 2026-07-17T18:02:05+03:00

## Outcome

Implemented a local, read-only, counts-only real-source preflight runner for
the approved W12-100 data scope. The runner is compatible with the W12-01
import contracts and does not implement apply mode.

The exact sanitized source packet was not available locally, so
`REAL-SOURCE-PREFLIGHT.json` records a precise blocked result instead of using
another file.

## Implemented

- Added `scripts/w12-100/data/real-source-preflight.ts`.
- Hard-coded the six OPS-13A approved source filenames, row counts, and hash
  requirements.
- Stops before parsing on missing file, filename mismatch, hash mismatch, or
  unapproved supported spreadsheet presence.
- Parses local CSV/TSV/XLSX files only after exact validation.
- Normalizes email/phone identity privately in memory.
- Emits counts, aggregate digests, and stable non-reversible fingerprints only.
- Applies suppression and opt-out precedence before eligibility.
- Distinguishes `matched_existing_contact`, `stage_new_contact`,
  `duplicate_input`, `no_op`, and `manual_review`.
- Reports every OPS-13A manual-review category, even when count is zero.
- Excludes communication exports, message bodies, external lead lists, and
  unknown spreadsheets.
- Provides an optional sanitized existing-identity snapshot path without
  reading any database.
- Blocks `--apply` explicitly.

## Real-Source Result

- Status: `blocked`.
- Reason: approved sanitized source packet unavailable locally.
- Approved scope: 6 files, 1 Rabbi/One Time followers source, 5 email-audience
  sources, 2,509 expected naive rows.
- Source substitution: none.
- Raw row parsing: none.
- Production database connected/read: false.
- Database writes: 0.

## Tests And Validation

- `npm ci`: passed.
- `npx vitest run --config vitest.unit.config.ts tests/unit/w12-100-data/real-source-preflight.test.ts`: passed, 1 file / 3 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/w12-100-data/real-source-preflight-cli.test.ts`: passed, 1 file / 2 tests.
- `npx tsx scripts/w12-100/data/real-source-preflight.ts --out=ops/codex-runs/W12-100-04/REAL-SOURCE-PREFLIGHT.json`: produced expected blocked report.
- `npm run secret:scan`: passed across 1302 repo text files.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npx prettier --check --ignore-unknown <W12-100-04 touched files>`: passed.
- `npm run integration`: passed, 39 files / 186 tests.
- `npm run unit`: rerun alone passed, 39 files / 199 tests. Initial parallel
  full-unit run hit a Vitest worker IPC `Channel closed` while integration was
  also running.
- `npm run build`: passed. Vite emitted the inherited font URL warning only.
- Final `npm run secret:scan`: passed across 1302 repo text files.

## Safety

- Deployments: 0.
- External actions: 0.
- Provider mutations: 0.
- Production database reads: 0.
- Production database writes: 0.
- Database writes: 0.
- Raw source rows committed: false.
- Secrets/private rows committed: false.
- Apply mode implemented: false.

## Follow-Up For Later Lane

Use `APPLY-ROLLBACK-SCHEMA-PROPOSAL.md` only as a review proposal. A later lane
must approve exact source report hash, counts, backup proof, manual-review
terminal statuses, mutation budget, and rollback plan before any apply work.
