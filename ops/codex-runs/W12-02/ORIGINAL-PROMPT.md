# W12-02 - Historical communications and premium communications workspace

## Outcome

Turn Communications into a truthful, usable contact history workspace with
branded filters and links to contacts/households. Add provider/export ingestion
seams without pretending unavailable provider history exists and without
enabling live sends.

## Base and isolation

Target `webcraft-media/onetimev2`; dynamically choose current accepted release
source from PR #61/latest release evidence; record exact SHA. Create clean
branch/worktree `codex/w12-02-communication-history`.

## Audit first

Inspect existing communications contracts, local outbox projection, inbound
webhook storage, reply drafts, Resend/email adapters, Meta WhatsApp adapters,
legacy exports, and CRM relationships. Produce a source-truth matrix:

- locally stored outbound intent;
- sink/test processing;
- provider accepted/delivered/bounced/suppressed truth;
- stored inbound webhook message;
- importable provider/export history;
- unavailable/unprovable history.

Do not label local intent as delivered. Do not fabricate subjects, bodies,
replies, threads, or history.

## Implement

1. Canonical communication event/thread model with channel, direction,
   participant/contact/household link, timestamp, truthful state/source/
   provenance, redacted preview, provider reference digest, import batch, and
   idempotency.
2. Read-only ingestion adapters for actual discoverable exports/stored
   webhooks. If Resend or WhatsApp cannot provide old history, record the exact
   limitation and complete the adapter contract/fixture instead.
3. Safe historical backfill dry-run with counts/conflicts; no raw message
   bodies in Git/evidence.
4. Contact detail and global communications views with thread preview, channel/
   direction/time/status, contact/household deep links, pagination, empty/
   error/offline/session-expiry states.
5. Replace gray generic filters with existing One Time semantic brand
   components: high-contrast black/yellow/ice-blue, clear labels, mobile
   horizontal/overflow-safe filters, keyboard and screen-reader support.
6. Provider-off single-recipient draft remains visibly a draft. No compose/send/
   reply control should imply working transport unless capability state proves
   it.
7. Negative tests: cross-account access, PII in URLs/cache/logs, replay,
   duplicate import, out-of-order webhook, unknown contact, missing history,
   suppression, and role denial.

Own communications module/UI/styles/adapters. Avoid canonical contact schema
changes; use a documented provisional interface for W12-01 reconciliation.
Record server/root/navigation edits in `HOTSPOTS.json`.

## Continuity/safety

Maintain task artifacts under `ops/codex-runs/W12-02/`. Missing external
credentials must not stop provider-independent implementation. No live send, no
provider mutation, no production backfill, no broad data export, no deploy. Run
unit/integration/e2e/a11y/performance/privacy/secret checks. Commit, push, open
draft PR.
