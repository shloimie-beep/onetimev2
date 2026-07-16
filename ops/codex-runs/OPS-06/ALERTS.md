# OPS-06 Alerts

Alert schema: `ops.alert.v1` in `packages/contracts/src/ops/index.ts`.

Routing adapters:

- `owner_ops`: actionable operational warnings for owner review.
- `engineering`: code, database, or worker health failures.
- `staging_conductor`: staging candidate blockers and restore/load proof gaps.

Branch behavior:

- `scripts/ops06-alert-eval.ts` evaluates fixture snapshots and writes a deterministic local sink report.
- `deterministicAlertSink()` records accepted alert keys and events.
- `external_notifications_sent=false` is part of the sink report.
- No real notification channel is called in this branch.

Anti-spam:

- Alert dedupe keys are deterministic SHA-256 truncations of the stable alert key.
- Queue lag is thresholded at 10 minutes.
- Retry storm alert fires above 100 retry rows.
- Dead-letter and expired-lease blockers are deduped per queue/dependency.
