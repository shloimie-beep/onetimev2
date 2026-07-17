# W12-01 Final Report

## Scope

Implemented CRM audience inventory and safe import tooling for the One Time/Rabbi audience lane without applying a real import.

## Base And Intake

- Target repo: `webcraft-media/onetimev2`.
- Branch: `codex/w12-01-crm-audience-import`.
- Worktree: external isolated W12-01 worktree.
- Base: PR #61 head `c7d46066517d7a458d189f2c782cc06200f7861c`; no newer accepted production source was identified during intake.
- ZIP: `W12-NEXT-PARALLEL-WAVE-2026-07-17.zip` in Downloads.
- ZIP SHA-256: `d26bf78fb3887f1b7d705cede101acb0ae3f611c2c86f73c850fcc9ab213fd3b`.
- Archive safety: 23 entries, 0 unsafe entries, 19 embedded SHA-256 entries verified, 0 failures.

## Implemented

- Sanitized source inventory script for likely audience/contact exports in Downloads.
- Metadata-only CSV/TSV streaming parser and XLSX workbook metadata parser.
- Source classification: proven One Time, mixed/needs review, unrelated, duplicate.
- Governed audience taxonomy facts for contacts, households, guardians, learners, leads, members, legacy/current activation, enrollment, consent, suppression, provenance, and campaign eligibility.
- Counts-only dry-run report taxonomy fact counts.
- Apply-plan guard requiring manifest/source hash, exact counts, explicit operator authorization for apply mode, and target environment declaration.
- Production apply attempts are blocked and never mutate contacts.
- Conflict-decision API and repository persistence.
- Source-inventory and apply-plan API endpoints.
- Change-ledger tables for future reversible import application without applying a real bulk import in this branch.
- Admin preview/UI visibility for CRM tags and governed facts.
- Synthetic no-PII fixtures and focused tests.

## Sanitized Inventory

- Manifest SHA-256: `399f33d13668e27568b1956af453a29c53a780c75ace51011daeb4ac9e418c46`.
- Files inventoried: 33.
- Proven One Time: 1.
- Mixed/needs review: 26.
- Unrelated: 1.
- Duplicate: 5.
- Possible PII columns detected: 31.
- Raw row values included: `false`.
- Production side effects: `false`.

## Safety Result

- Raw spreadsheets committed: `false`.
- Raw PII committed: `false`.
- Real bulk import applied: `false`.
- Sends queued: `false`.
- Provider mutation: `false`.
- Production DB read: `false`.
- Deployment: `false`.

## Validation Ledger

Completed before final closeout:

- `npm ci`
- `npm run lint`
- `npm run secret:scan`
- `npm run typecheck`
- `npx prettier --check --ignore-unknown <W12-01 touched files>`
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts tests/unit/ot111-legacy-activation-campaign.test.ts tests/unit/w12-01-audience-import.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts`
- `npx tsx scripts/w12-01/source-inventory.ts --root=<Downloads> --label=Downloads --out-dir=ops/codex-runs/W12-01`
- `npx tsx scripts/ot74/audience-dry-run.ts --rows=10000`
- `npx tsx scripts/ot111/legacy-activation-campaign-dry-run.ts`
- `npx tsx scripts/w12-01/synthetic-dry-run-report.ts --out=ops/codex-runs/W12-01/SYNTHETIC-DRY-RUN-REPORT.json`
- `npx tsx scripts/w12-01/audience-apply-plan.ts --report=ops/codex-runs/W12-01/SYNTHETIC-DRY-RUN-REPORT.json --mode=dry_run --target-environment=test`
- `npx tsx scripts/w12-01/audience-apply-plan.ts --report=ops/codex-runs/W12-01/SYNTHETIC-DRY-RUN-REPORT.json --apply --target-environment=production`
- Privacy scan over `ops/codex-runs/W12-01` for emails, phone numbers, local paths, raw-row flags, production-side-effect flags, and real-import flags.

Inherited base warning:

- `npm run format` fails on 827 pre-existing files in the PR #61 base. W12-01 touched files pass the scoped Prettier check, and I did not mass-format unrelated files.

Blocked local disposable PostgreSQL proof:

- `npm run db:verify` fails because `DATABASE_URL` is unset.
- `docker` is not installed.
- `psql` is not installed.
- No production database was read. The repository integration test applies the migration path through pg-mem and records W12-01 tables without contact mutation.

## Notes

The apply-plan proof uses the dry-run report `source_digest` as the hash-bound manifest guard for an import batch. The separate source-inventory manifest remains committed as discovery evidence and may feed a later W12-99 convergence/import packet.
