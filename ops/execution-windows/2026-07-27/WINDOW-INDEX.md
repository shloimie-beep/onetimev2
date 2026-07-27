# 2026-07-27 self-driving execution queue

This directory is the canonical Git-backed dispatch queue for the seven
permanent lanes. `BOARD.yaml` remains the only current goal-status and
acceptance map. Queue `dispatch_state` coordinates claims and terminal attempts
only.

## Canonical control files

- [`queue.yaml`](queue.yaml) — lane assignments, claims, terminal results, and
  compare-and-swap protocol
- [`writer-locks.yaml`](writer-locks.yaml) — exclusive current lock holders
- [`dependencies.yaml`](dependencies.yaml) — dependency edges and external-gate
  acceptance contracts
- [`decisions-needed.md`](decisions-needed.md) — the only permitted manual
  handoff classes and current genuine gates
- [`BOARD.yaml`](../../goals/OT-LAUNCH-01/BOARD.yaml) — sole current goal status
  and authority map

Every worker fetches and rereads the remote queue ref and current Board before
claiming a task and again before selecting a successor. Chat text is bootstrap
context, not continuing authority.

## Permanent lanes

| Lane               | Exclusive scope                                                                   | Bootstrap prompt                             |
| ------------------ | --------------------------------------------------------------------------------- | -------------------------------------------- |
| `01-OT-CONTROL`    | Sole Board writer; queue/dependency/result reconciliation; no lane implementation | [`01-OT-CONTROL.md`](01-OT-CONTROL.md)       |
| `02-OT-ZOOM`       | Sole Zoom provider writer                                                         | [`02-OT-ZOOM.md`](02-OT-ZOOM.md)             |
| `03-OT-GHL`        | Sole GHL repository writer or sole GHL browser writer, one exact task at a time   | [`03-OT-GHL.md`](03-OT-GHL.md)               |
| `04-OT-PRODUCT`    | Sole One Time product writer; separate migration lock when required               | [`04-OT-PRODUCT.md`](04-OT-PRODUCT.md)       |
| `05-OT-HYGIENE`    | Sole preservation/hygiene writer                                                  | [`05-OT-HYGIENE.md`](05-OT-HYGIENE.md)       |
| `06-BNA-CONTROL`   | Sole BNA control/governance writer                                                | [`06-BNA-CONTROL.md`](06-BNA-CONTROL.md)     |
| `07-OT-PRODUCTION` | Production lane, disabled until every dependency and fresh authority are accepted | [`07-OT-PRODUCTION.md`](07-OT-PRODUCTION.md) |

## Zoom terminal blocker

Draft PR #125 exact head
`eeb31101e0d8f8a395a1c3833129b1afde4fd845` is the current Zoom evidence.
Cleanup stopped before DELETE on an exact reconciliation-scope mismatch.
Do not retry cleanup or create another meeting.

The smallest queued source task is
[`ZOOM-SCOPE-MISMATCH-DIAGNOSTIC-TASK.md`](ZOOM-SCOPE-MISMATCH-DIAGNOSTIC-TASK.md).
It adds a mutation-impossible safe predicate classifier only after the existing
product item is terminal. A later one-OAuth/one-GET provider read remains
separately gated.

The A01–A12 audit control tower under
[`ops/audits/2026-07-26/parallel-control-tower/`](../../audits/2026-07-26/parallel-control-tower/README.md)
is immutable evidence and dependency lineage, not the live queue.
