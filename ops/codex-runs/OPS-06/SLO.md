# OPS-06 SLO And Thresholds

## Readiness

- `/health`: process liveness only, expected 200 if the web process can respond.
- `/ready`: essential dependency readiness. Database and migration ledger failures return 503 with non-secret blocker codes. Optional provider disabled/unconfigured state is reported but does not fail readiness.

## Queue SLOs

- Delivery/support/lifecycle ready oldest age warning: 10 minutes.
- Expired lease critical: any expired processing/leased row.
- Dead-letter warning: any dead-letter row.
- Retry storm critical: more than 100 retry rows in a queue snapshot.
- Throughput: report delivered rows in the last 15 minutes for each operational queue.

## Worker SLOs

- Heartbeat TTL default: 90 seconds.
- Stale worker critical: heartbeat lease expired while state is not `stopped`.
- Graceful drain: SIGTERM/SIGINT marks `draining`, stops new polling claims, completes the current batch, marks `stopped`, and lets expired leases be reclaimed by later workers.

## Load Gates

- Synthetic load uses reserved `example.test` data only.
- Required percentile report: p50, p75, p95, p99 for signup idempotency, rate-limit budget, and worker claim scenarios.
- Fail on duplicate side effects, unbounded claim fanout, failed idempotency uniqueness, failed rate-limit rejection, or unbounded memory growth above 256 MiB during the harness.
