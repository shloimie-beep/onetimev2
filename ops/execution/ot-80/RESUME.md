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
- Latest source merge head: `bdddf576fc39615d9b6cb6414695651de33d331d`
- Integrated so far: OT-71 product core, OT-74 audience reconciliation, and
  OT-72 provider sandbox/default-off infrastructure
- Source heads: `ops/execution/ot-80/SOURCE-HEADS.json`
- Immutable prompt: `ops/execution/ot-80/ORIGINAL-PROMPT.md`
- Input manifest: `ops/execution/ot-80/INPUT-MANIFEST.json`
- Communications decisions:
  `ops/execution/ot-80/COMMUNICATIONS-INTEGRATION-DECISIONS.md`
- Communications archive:
  `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`

## Next Commands

After the OT-72 checkpoint records are committed and pushed, continue with the
Day-One communications implementation from the preserved audit archive:

- `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`
- `ops/execution/ot-80/COMMUNICATIONS-INTEGRATION-DECISIONS.md`
- `ops/execution/ot-80/ORIGINAL-PROMPT.md`

Then integrate OT73, OT75, and OT76, updating the OT80 checkpoint files after
each batch before pushing the next checkpoint.

## OT-74 Disposition

OT80 kept only the legacy `audience-reconciliation` path from OT74:

- retained migration `1201_ot74_legacy_audience_reconciliation.sql`;
- retained contracts/domain/repository/router/panel/script/tests under
  `audience-reconciliation`;
- rejected the duplicate generic `audience` import-preview path and migration
  `1200_ot74_audience_reconciliation.sql`.

The retained path is dry-run only and does not authorize production imports,
sends, provider mutations, or contact deletion.

## OT-72 Disposition

OT80 kept OT72's provider work default-off:

- retained provider event/readiness/oversight contracts and repository;
- retained Stripe test adapter, delivery provider router/webhook normalization,
  Zoom/Vimeo descriptors, One Time Telegram transport, and BNA follow-up
  manifest fixture;
- retained the PostgreSQL assurance teardown guard;
- renamed source migration `1700_ot72_provider_truth.sql` to
  `1800_ot72_provider_truth.sql` because OT71 owns the `1700` prefix.

No live charge, send, webhook registration, provider mutation, deployment, DNS
change, or production database mutation is authorized.

## Guardrails

Do not merge to `main`, do not use BNA product code, do not touch production or
root DNS, do not send to real audiences, do not run live Stripe charges, and do
not mutate real legacy contacts. Isolated staging is only allowed after the
candidate gates described in `ORIGINAL-PROMPT.md`.
