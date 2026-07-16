# OPS-08 Conflict Ledger

## Resolved During Integration

- PR #42 (`3fe848809e8d958c7c839452d73cf0f90916147c`)
  - `OPS04-INTEGRATION-DELTA.md`: add/add conflict resolved by combining OT-109 and OT-103 integration notes.
  - `tests/integration/telegram-db-foundation.test.ts`: migration expectations generalized to assert required IDs, uniqueness, sorted order, and checksums.

- PR #43 (`dc05747d55413149743a4c4c6b0223912c29b8eb`)
  - `ops/codex-runs/OPS-09A/FLEET-REPORT.md`: combined OPS-09A PR-42/PR-43 status and retained pending rows for #44/#46/#48.
  - `tests/integration/telegram-db-foundation.test.ts`: added WhatsApp migration `2100_ot100_whatsapp_provider_activation`.

- PR #45 (`10cee196dbb6628edd9bacb6e224646d7bf39e70`)
  - `OPS04-INTEGRATION-DELTA.md`: combined OT-109, OT-103, and OT-105 Stripe TEST notes.

- OPS-06 (`aa17fed49b936ccc2fbfafad7826af39c1754b12`)
  - Migration namespace collision resolved by renaming `packages/db/migrations/2010_ops06_reliability_observability.sql` to `packages/db/migrations/2015_ops06_reliability_observability.sql`.
  - Updated OPS-06 report references and `tests/integration/telegram-db-foundation.test.ts` accordingly.

## Observed But Not Resolved In This Checkpoint

- Current PR #44 (`3871c38b75e7fc866f572ec80d3b2ec37cde6b6e`)
  - `git merge-tree --write-tree HEAD origin/pr/44` reported conflicts in:
    - `ops/codex-runs/OPS-09A/FLEET-REPORT.md`
    - `tests/e2e/ot-83r-portals.spec.ts`
    - `tests/integration/telegram-db-foundation.test.ts`
  - Decision: do not merge without green checks and an OT-113 unblock path.

- OT-114 (`096dd614c9493cec1c29851e14f56166863ad26b`)
  - `git merge-tree --write-tree HEAD origin/codex/ot114-crm-communications-support` reported a central conflict in `apps/web/src/server/app.ts`.
  - Decision: observe/report only; leave for the next integration pass.
