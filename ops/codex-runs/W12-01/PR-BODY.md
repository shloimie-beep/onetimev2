# Summary

Implements W12-01 CRM audience inventory and safe import tooling for the One Time/Rabbi audience lane.

- Adds sanitized source inventory evidence and tooling for likely audience/contact exports in Downloads.
- Extends OT-74 audience reconciliation with governed taxonomy facts, source inventory persistence, conflict-decision persistence, apply-plan guards, and change-ledger tables.
- Adds admin/API preview paths for taxonomy, CRM tag visibility, source inventories, conflict decisions, and apply plans.
- Adds synthetic no-PII fixtures and focused unit/integration coverage.

# Safety

- No raw spreadsheets committed.
- No raw row values, real email/phone values, private message text, tokens, or passwords committed.
- No real bulk import applied.
- No sends queued.
- No provider mutation, production DB read, or deployment performed.
- Production apply attempts remain blocked by policy guards.

# Evidence

- `ops/codex-runs/W12-01/ARCHIVE-SAFETY.json`
- `ops/codex-runs/W12-01/SOURCE-INVENTORY.json`
- `ops/codex-runs/W12-01/SOURCE-INVENTORY.md`
- `ops/codex-runs/W12-01/SYNTHETIC-DRY-RUN-REPORT.json`
- `ops/codex-runs/W12-01/APPLY-PLAN-DRY-RUN.json`
- `ops/codex-runs/W12-01/APPLY-PLAN-PRODUCTION-BLOCKED.json`
- `ops/codex-runs/W12-01/FINAL-REPORT.md`

# Validation

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
- Privacy scan over `ops/codex-runs/W12-01`

Notes:

- `npm run format` fails on inherited PR #61 base formatting drift; W12-01 touched files pass scoped Prettier.
- `npm run db:verify` is blocked locally because `DATABASE_URL`, `docker`, and `psql` are unavailable. No production DB was used.
