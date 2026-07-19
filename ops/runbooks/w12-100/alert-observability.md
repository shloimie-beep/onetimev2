# W12-100 Alert And Observability Runbook

Purpose: define launch checks for web, worker, queues, database, auth,
webhooks, classrooms, billing, and backups. The checker emits machine-readable
evidence only and sends no external notifications.

## Generate Evidence

Create a redacted snapshot:

```json
{
  "schema_version": "onetime.w12_100.observability_snapshot.v1",
  "generated_at": "2026-07-17T00:00:00.000Z",
  "web": {
    "ready": true,
    "health_status": 200,
    "ready_status": 200,
    "version_commit_sha": "<commit-sha>"
  },
  "workers": [
    {
      "worker_type": "delivery_outbox",
      "state": "ready",
      "heartbeat_age_ms": 15000
    }
  ],
  "queues": [
    {
      "queue": "delivery_outbox",
      "ready_count": 0,
      "oldest_ready_age_ms": 0,
      "retry_count": 0,
      "dead_letter_count": 0
    }
  ],
  "database": {
    "connection_saturation_percent": 20,
    "cpu_saturation_percent": 30,
    "storage_saturation_percent": 40
  },
  "rate_limits": {
    "spike_count_5m": 0,
    "max_limited_ratio_5m": 0
  },
  "auth": {
    "login_failures_5m": 0,
    "login_failure_ratio_5m": 0
  },
  "webhooks": {
    "whatsapp_verification_failures_5m": 0,
    "telegram_verification_failures_5m": 0,
    "generic_signature_failures_5m": 0
  },
  "classes": {
    "launch_failures_15m": 0
  },
  "billing": {
    "webhook_failures_5m": 0,
    "webhook_signature_failures_5m": 0
  },
  "backups": {
    "latest_backup_age_minutes": 30,
    "pitr_enabled": true
  }
}
```

Run:

```powershell
npx tsx scripts/w12-100/ops/observability-checks.ts --input "$RunDir/observability-snapshot.json" --output "$RunDir/observability.evidence.json"
```

## Checks

| Check                         | Severity | Source                                                             | Threshold                                                     |
| ----------------------------- | -------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| Web readiness                 | critical | `/health`, `/ready`, `/version`, `onetime_ready`                   | health and ready 2xx, ready ok, version commit exact          |
| Worker heartbeat              | critical | `/api/internal/ops/diagnostics`, `onetime_worker_heartbeat_age_ms` | at least one non-stale delivery worker heartbeat <= 120000 ms |
| Queue depth                   | warning  | diagnostics queue snapshot, `onetime_queue_ready_count`            | ready count <= 50 for every launch queue                      |
| Oldest ready age              | warning  | diagnostics queue snapshot                                         | oldest ready age <= 600000 ms                                 |
| Delivery retries              | critical | diagnostics queue snapshot                                         | retry count <= 100                                            |
| Delivery dead letters         | critical | diagnostics queue snapshot                                         | dead-letter count is 0                                        |
| Database saturation           | critical | Railway/database metrics export                                    | connection, CPU, and storage saturation each < 85 percent     |
| Rate-limit spikes             | warning  | HTTP/rate-limit metrics                                            | spike count <= 20 and limited ratio <= 0.10 over 5 minutes    |
| Login failures                | warning  | auth metrics                                                       | failures <= 20 and failure ratio <= 0.20 over 5 minutes       |
| Webhook verification failures | critical | WhatsApp, Telegram, generic signature metrics                      | 0 during launch window                                        |
| Class launch failures         | critical | classroom launch metrics                                           | 0 over 15 minutes                                             |
| Billing webhook failures      | critical | billing webhook metrics                                            | 0 webhook or signature failures over 5 minutes                |
| Backup age                    | critical | Railway backup metadata                                            | latest backup age <= 1440 minutes and PITR metadata present   |

## Fail-Closed Behavior

- Missing evidence blocks launch readiness.
- Any critical firing check blocks promotion.
- Warning checks block until an operator records why the risk is acceptable.
- The checker records `external_notifications_sent: false`.
- The checker records `production_mutations: 0`.
- No private rows, destinations, tokens, passwords, variable values, raw message
  bodies, database URLs, private links, or screenshots belong in the snapshot.
