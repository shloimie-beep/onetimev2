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
- Latest integrated source merge: `ef16bd84ee4aaacd2a76ff7d0bbb97646dfbd4e2`
- Integrated so far: OT-71 product core, OT-74 audience reconciliation, OT-72
  provider sandbox/default-off infrastructure, and OT-73 landing intent
  reconciliation
- Implemented directly: Day-One communications catalog from preserved audit
  archive
- Source heads: `ops/execution/ot-80/SOURCE-HEADS.json`
- Immutable prompt: `ops/execution/ot-80/ORIGINAL-PROMPT.md`
- Input manifest: `ops/execution/ot-80/INPUT-MANIFEST.json`
- Communications decisions:
  `ops/execution/ot-80/COMMUNICATIONS-INTEGRATION-DECISIONS.md`
- Communications archive:
  `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`

## Next Commands

After the OT73 checkpoint records are committed and pushed, continue Phase 1
with OT75, then OT76:

```powershell
git fetch origin --prune
git merge --no-ff origin/codex/ot75-release-observability-readiness
```

Update the OT80 checkpoint files after each batch before pushing the next
checkpoint.

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

## Day-One Communications Disposition

OT80 implemented the preserved communications archive directly:

- catalog source hash:
  `865f04e7fd8d5842376485481804fb9d21595797fd9f40e8b5aa45424ae3a88a`;
- implementation commit:
  `aae879aea3ddbfce2ecdf8356c36711ef6a5e016`;
- active delivery copy is limited to Family acknowledgements, protected-link
  Family reminders, and internal owner/admin lead alerts;
- School submissions get public web acknowledgement copy plus internal alert
  only; School public email/WhatsApp sends and filters are not active;
- class reminders skip unless a protected One Time app route is present.

## OT-73 Disposition

OT80 merged the corrected landing addendum:

- campaign ticker is active and removes stale price/trial/no-card hero copy;
- DM Serif Display is self-hosted under `apps/web/public/assets/fonts/`;
- receive/gain/who/gallery/footer public landing updates are present;
- `/login` remains the canonical Member Login route;
- generated signup fallback copy now uses the domain `successCopy('family')`;
- School submissions still do not create class access, reminders, portal
  accounts, or public email/WhatsApp sends.

## Guardrails

Do not merge to `main`, do not use BNA product code, do not touch production or
root DNS, do not send to real audiences, do not run live Stripe charges, and do
not mutate real legacy contacts. Isolated staging is only allowed after the
candidate gates described in `ORIGINAL-PROMPT.md`.
