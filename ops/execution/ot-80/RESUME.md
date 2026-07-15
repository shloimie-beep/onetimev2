# Resume OT-80

Use this repository state, not the original chat, to continue.

## Worktree

```powershell
cd "C:\Users\User\OneTimeOneTime-ot80-one-shot-final-convergence"
git status --short
git branch --show-current
```

Expected branch: `codex/ot80-one-shot-final-convergence`.

## Current State

- Phase: `phase1_source_lane_integration`
- Candidate status: `NOT_READY`
- Accepted base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Latest source merge head: `29ab2b1888ab2f6c00892f7f353921fe5aabb638`
- Integrated so far: OT-71 product core and OT-74 audience reconciliation
- Source heads: `ops/execution/ot-80/SOURCE-HEADS.json`
- Immutable prompt: `ops/execution/ot-80/ORIGINAL-PROMPT.md`
- Input manifest: `ops/execution/ot-80/INPUT-MANIFEST.json`
- Communications decisions:
  `ops/execution/ot-80/COMMUNICATIONS-INTEGRATION-DECISIONS.md`
- Communications archive:
  `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`

## Next Commands

After the OT-74 checkpoint records are committed and pushed, continue Phase 1
with OT-72:

```powershell
git fetch origin --prune
git merge --no-ff origin/codex/ot72-provider-sandbox-train
```

If conflicts occur, resolve them deliberately and update:

- `ops/execution/ot-80/CONFLICT-LEDGER.md`
- `ops/execution/ot-80/MIGRATION-LEDGER.json`
- `ops/execution/ot-80/IMPLEMENTED.md`
- `ops/execution/ot-80/REMAINING.md`
- `ops/execution/ot-80/TEST-RESULTS.md`
- `ops/execution/ot-80/RESUME.md`

Known OT72 work: the OT71 account-lifecycle migration already occupies prefix
`1700`, so OT72 provider-truth migration references must be renumbered to the
next stable free prefix during integration. Preserve OT72 PostgreSQL teardown
guards for later OT75 release-readiness work.

Then run focused checks relevant to the integrated lane before committing and
pushing the next checkpoint.

## OT-74 Disposition

OT80 kept only the legacy `audience-reconciliation` path from OT74:

- retained migration `1201_ot74_legacy_audience_reconciliation.sql`;
- retained contracts/domain/repository/router/panel/script/tests under
  `audience-reconciliation`;
- rejected the duplicate generic `audience` import-preview path and migration
  `1200_ot74_audience_reconciliation.sql`.

The retained path is dry-run only and does not authorize production imports,
sends, provider mutations, or contact deletion.

## Guardrails

Do not merge to `main`, do not use BNA product code, do not touch production or
root DNS, do not send to real audiences, do not run live Stripe charges, and do
not mutate real legacy contacts. Isolated staging is only allowed after the
candidate gates described in `ORIGINAL-PROMPT.md`.
