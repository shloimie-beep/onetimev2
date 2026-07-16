# OPS-05 Operator Runbooks

These runbooks are safe for One Time operations without exposing private
payloads. Evidence should be copied as alert IDs, timestamps, service keys,
status classes, latency buckets, source SHA, config mode, and opaque receipt
references only.

## Public Landing Or Signup Down

Rabbi-facing degraded state: "Signup is temporarily unavailable. Leads are not
lost if the form confirms receipt; otherwise use the public WhatsApp lead
assistant only if it is separately healthy."

1. Check `/healthz`, `/readyz`, and `/version` for source SHA and config mode.
2. Check public `public_signup` 5xx rate and p95 latency.
3. Check `onetime_signup_funnel_total` by step: validation, CRM write, outbox
   enqueue, sink delivery.
4. If health fails, roll back to the last known passing source SHA.
5. If only provider delivery is degraded, leave signup capture active and keep
   provider mode disabled or sink until credentials are fixed.

## CRM List Or Detail Regression

Rabbi-facing degraded state: "Contacts are delayed. New signups are still being
captured; detail history may load slowly."

1. Check CRM synthetic results and `crm` route p95 latency.
2. Confirm no migration drift or source SHA mismatch.
3. Check query count and response-size evidence from the CRM performance gate.
4. Roll back if list/detail cannot show first usable rows within the SLO.

## Migration Failure Or Schema Drift

Rabbi-facing degraded state: "Admin data is temporarily locked for safety while
schema health is checked."

1. Stop promotion and keep provider sends disabled.
2. Compare repository migration checksums with `onetime.schema_migrations`.
3. If mismatch exists, do not run ad hoc schema edits. Restore from the latest
   known good migration path or roll back app traffic.
4. Record migration ID, checksum status, service key, and source SHA only.

## Outbox Backlog Duplicates Or Dead Letters

Rabbi-facing degraded state: "Messages are queued for review. Local receipts
remain available; external delivery is paused or delayed."

1. Check queue depth, oldest pending age bucket, retry count, duplicate count,
   and dead-letter count.
2. Verify worker lease conflicts and source SHA.
3. Keep provider mode in sink/test unless a separate provider canary is
   explicitly approved.
4. For dead letters, record failure code/category/provider family only.

## Provider Degradation

Rabbi-facing degraded state: "A provider is unavailable. The app remains usable
and will show setup/unavailable states instead of unsafe links or fake health."

1. Identify provider family: email, WhatsApp, Telegram, Vimeo, Buffer,
   Stripe TEST, Zoom, or BNA support bridge.
2. Check provider mode: disabled, sink, test, configured, or degraded.
3. Do not paste provider tokens, chat IDs, phone numbers, raw URLs, payment IDs,
   or message bodies into evidence.
4. Use the provider kill-switch by disabling the protected provider enable flag
   and leaving local receipts active.

## Auth MFA Session Or Cross-Scope Anomaly

Rabbi-facing degraded state: "Login protection is active. Some users may need
to retry or contact support."

1. Check `onetime_auth_failures_total` by auth step and failure class.
2. Compare with 24 hour baseline and synthetic negative checks.
3. Confirm no cross-scope data read succeeded.
4. If anomaly is unexplained, revoke suspicious sessions by scoped admin tooling
   only after explicit authorization.

## Class Launch Or Reminder Failure

Rabbi-facing degraded state: "Class launch is not ready yet. Students should
wait for the portal state to change; raw meeting links are not shown."

1. Check class readiness state and reminder outbox age.
2. Confirm no raw Zoom or provider URL is exposed in logs, portal responses, or
   evidence.
3. Keep class launch disabled if entitlement, session window, provider
   readiness, or protected reference checks fail.
4. If reminders are late, leave signup/portal capture active and repair the
   sink queue before enabling provider delivery.

## BNA Support Consumer Unavailable

Rabbi-facing degraded state: "Support requests are saved locally. Super-admin
sync is delayed."

1. Confirm local receipt count is still increasing.
2. Confirm ordinary One Time routes make no synchronous BNA calls.
3. Check cached BNA support bridge state and async outbox backlog.
4. Do not import BNA code into One Time. Repair the async producer/consumer
   contract or leave status cached until BNA recovers.

## Backup PITR Or Restore Failure

Rabbi-facing degraded state: "Changes are paused while backup safety is
verified."

1. Check backup evidence freshness, PITR state, and latest restore drill result.
2. Record only backup label/status/time and restore result, not database URLs.
3. Block promotion if evidence is stale or failed.

## Wrong Source SHA Or Provider Mode

Rabbi-facing degraded state: "The app is running an unexpected version or mode.
Operations are paused until it is corrected."

1. Compare `/version`, `/healthz`, `/readyz`, and deployment descriptor source
   SHA.
2. Compare provider mode with release manifest.
3. If wrong, stop canary/promotion and roll back to the expected source SHA.
4. Record expected/actual SHA, config mode, provider mode, and service key only.

## Rollback And Provider Kill-Switch

1. Disable provider mode first when external delivery is the risk.
2. Roll back traffic when web, auth, CRM, portal, migration, or source SHA
   safety fails.
3. Preserve local receipts, audit-safe opaque references, and incident timeline.
4. Do not hard-delete incidents or dead letters during triage.
