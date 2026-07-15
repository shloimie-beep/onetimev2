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

- Phase: `phase6_local_candidate_handoff`
- Candidate status: `NOT_READY`
- Accepted base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Latest integrated source merge: `a95b4e3c2b7210f66f142322d2adcb900eb6890a`
- Final candidate source/evidence anchor:
  `b753d50ca562c01cfa8619762254e70c90b0105f`
- Integrated so far: OT-71 product core, OT-74 audience reconciliation, OT-72
  provider sandbox/default-off infrastructure, OT-73 landing intent
  reconciliation, OT-75 release/observability readiness, and OT-76 Day-One
  certification harness
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

Draft PR #23 is open at
`https://github.com/webcraft-media/onetimev2/pull/23`. CI passed on final PR
head `b753d50ca562c01cfa8619762254e70c90b0105f`. Candidate remains
`NOT_READY`; do not attempt isolated staging until gates allow it.

Useful final readback commands:

```powershell
git status --short --branch
gh pr checks 23 --watch
Get-Content ops/execution/ot-80/RELEASE-MANIFEST.json
Get-Content ops/evidence/ot-76/ot80-final-candidate/day-one-certify-report.json
```

Do not rerun the OT76 harness with the old OT76 scope base after OT80 final
evidence/checkpoint files are added unless intentionally checking OT76-only
scope behavior. The final OT80 Day-One readout is stored under
`ops/evidence/ot-76/ot80-final-candidate/` and is tied to candidate SHA
`b753d50ca562c01cfa8619762254e70c90b0105f`.

## Final Local Status

- `npm run build` - PASS.
- `npm run lint` - PASS.
- `npm run unit` - PASS, 18 files, 116 tests.
- `npm run integration` - PASS, 18 files, 86 tests.
- `npm run e2e` - PASS, 18 browser tests.
- `npm run accessibility` - PASS, 5 browser tests.
- `npm run performance` - PASS, including manifest-aware CRM bundle check.
- Final bundle check reported public JS `6316` bytes, public CSS `12801`
  bytes, and CRM JS `233126` bytes across `assets/app-crm.js` and
  `assets/app-crm2.js`.
- Final Day-One audit result:
  `audit_complete_not_certified`, 13 gates, 3 pass, 10 blockers.
- Final strict Day-One certify result: `failed`, Day-One certified `false`, 13
  gates, 3 pass, 10 blockers.

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

## OT-75 Disposition

OT80 merged OT75 as preparation-only release and observability readiness:

- release contracts, environment-name schema, predeploy gates, runbooks,
  deployment descriptors, observability contracts, alerts, dashboards, scripts,
  tests, and workflow are present;
- no runtime composition, provider code, migration, deployment, DNS, database,
  message, payment, real-user, or BNA mutation was performed;
- standalone OT75 validation still defaults to the immutable OT60R base;
- OT80 conductor validation uses
  `--scope-base d7bf846dda1c27aadd61f51c71aa163c70b2b871`;
- staging activation remains blocked on explicit external evidence listed in
  `ops/release/ot75/evidence/predeploy-gates.local.json`.

## OT-76 Disposition

OT80 merged the Day-One certification harness:

- registry, example manifest, synthetic fixtures, evidence reports, and harness
  script are present;
- OT80 conductor runs use
  `--scope-base bc2bcf2c7e16b5f1885aa65a2904f07578a18169`;
- audit mode passes with result `audit_complete_not_certified`;
- strict certify mode fails with result `failed`, 13 gates, 3 pass, 10 blockers;
- forbidden changed files and external mutation counts are zero.

## Guardrails

Do not merge to `main`, do not use BNA product code, do not touch production or
root DNS, do not send to real audiences, do not run live Stripe charges, and do
not mutate real legacy contacts. Isolated staging is only allowed after the
candidate gates described in `ORIGINAL-PROMPT.md`.
