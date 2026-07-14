# OT-36 Delivery Sink Worker Foundation

Task: OT-36 current-base sink delivery worker adaptation.

Branch: `codex/ot36-delivery-sink-foundation`
Base: `a73458d1884b8fcb4843c4852425009577f59ef7`
Stacked base branch: `codex/crm-core-v1`

## Packet Verification

- ZIP: `C:\Users\User\Downloads\OT-21-delivery-worker-packet.zip`
- ZIP SHA-256: `38ec04b37413b6862cad8838473b0cd49868c92d14a5b8bc1f1dcde64252b4ff`
- Internal manifest: `manifest_files_verified=40`
- Packet base: `610b585f3d221addd4e7b824c92a5cc256cffcf9`
- Packet was treated as source material only. `PATCH.diff` was not applied.

## Stale OT-21 Assumptions Corrected

- OT-21 created `apps/delivery-worker`; OT-36 keeps the existing single worker app at `apps/worker/src/main/index.ts`.
- OT-21 claimed pending/processing rows without account/product, transport, or supported event/channel predicates; OT-36 claims only current account/product, `transport_mode='sink'`, and the three supported pairs.
- OT-21 joined contacts/signups by bare keys; OT-36 joins by key plus matching account/product.
- OT-21 said no migration was required; OT-36 adds additive migration `0004_delivery_worker_claim_index.sql`.
- OT-21 allowed a future provider router shape; OT-36 keeps the runnable worker sink-only and has no live Resend/WAPI adapter path.
- OT-21 noted missing Vitest config on its stale base; current base already has unit/integration config globs covering the delivery roots.
- OT-21 used an overlapping interval in the current worker entrypoint; OT-36 replaces it with a non-overlapping polling loop and graceful signal drain.

## OT-25 / OT-26 Addendum Applied

Source: `ops/evidence/ot-36/OT-25-OT-26-ADDENDUM.md`
Original local file: `C:\Users\User\Downloads\OT-36-URGENT-OT25-26-ADDENDUM.md`
SHA-256: `21F1B8662458157607878A8A2AB9298F1FF200E23BC297768A1599774FA13F26`

- School public rows are no longer terminally skipped merely because they are School.
- Valid School email acknowledgements use generic receipt copy only: no class target, access language, join action, or reminder language.
- Eligible School WhatsApp receipts use the same generic receipt posture and still require WhatsApp/Both, valid E.164 phone, recorded consent, active suppression state, and a non-archived contact.
- Family email acknowledgement remains eligible even when `reminder_preference=none`.
- Family WhatsApp confirmation still requires WhatsApp/Both, valid E.164 phone, recorded consent, active suppression state, and a non-archived contact.
- The protected Family class target is resolved only at dispatch request build time through `ONE_TIME_PROTECTED_CLASS_TARGET_URL`; it is not stored in source fixtures, outbox JSON, CRM DTOs, logs, audit metadata, screenshots, or evidence.
- Expired `deliver_by` metadata now produces a stable skipped outcome instead of sending.
- OT-36 still does not implement or prove recurring reminders, the 30-minute producer, class tables, occurrence generation, recurring cron, BNA dependency, live Resend/WAPI calls, Railway services, or raw URL storage.

## Claim Predicates

The PostgreSQL claim path uses:

- `account_key = $1`
- `product_key = $2`
- `transport_mode = $3`, always `sink`
- pending due rows or expired processing leases
- supported event/channel allowlist:
  - `email_acknowledgement` + `email`
  - `whatsapp_confirmation` + `whatsapp`
  - `internal_lead_alert` + `internal_email`
- `FOR UPDATE SKIP LOCKED`

Provider-mode rows, unsupported rows, and cross-account/product rows remain untouched, not skipped or dead-lettered.

## Family / School Matrix

- Family email acknowledgement: sink-delivered when a scoped committed signup/contact is still eligible.
- Family WhatsApp confirmation: sink-delivered only when preference is WhatsApp/Both, consent is recorded, suppression is active, the contact is non-archived, and the normalized phone is valid E.164.
- Family public suppression: public row becomes `suppressed`; owner alert remains separate.
- School public email rows: sink-delivered as generic acknowledgements when the scoped committed signup/contact is still eligible; the worker never builds a public class-link request for School.
- School public WhatsApp rows: sink-delivered as generic receipts only when preference is WhatsApp/Both, consent is recorded, suppression is active, the contact is non-archived, and the normalized phone is valid E.164.
- School internal owner alert: remains eligible through the protected owner destination from worker config.
- Expired `deliver_by` rows: terminal `skipped` with stable reason `delivery_window_expired`.

## Migration

- File: `packages/db/migrations/0004_delivery_worker_claim_index.sql`
- SHA-256: `f7534522a26bacafe7dd998827fac84948b52b942702dce251d5cf79a47e1951`
- Additive, independent of reserved migration 0003.

## Verification

Passed:

- `npm ci`
- Packet internal manifest verification
- `npm run typecheck`
- Focused unit: `npm run unit -- --run tests/unit/delivery` - 5 files, 36 tests
- Focused integration: `npm run integration -- --run tests/integration/delivery` - 3 files, 11 tests
- Scoped Prettier check for OT-36 TypeScript files
- `npm run lint`
- `npm run test` - 6 unit files / 43 tests, 6 integration files / 22 tests
- `npm run secret:scan`
- `npm run build`
- `npm run e2e` - 7 tests
- `npm run accessibility` - 3 tests
- `npm run performance` - 3 tests plus bundle check
- `git diff --check` - no whitespace errors; Git printed a Windows LF/CRLF warning for the edited entrypoint

Blocked / not run:

- `npm run format` and therefore `npm run verify` stop on pre-existing repo-wide formatting drift outside OT-36-owned files. OT-36 TypeScript files pass scoped Prettier check; the SQL migration is not handled by this repo's Prettier parser.
- Real PostgreSQL two-worker concurrency test was not run because this shell has no `DATABASE_URL`. No production database was used.

## Single-Consumer Cutover Notes

- Current package scripts already target `apps/worker/src/main/index.ts`; no package script was added.
- Do not run old and new code revisions as co-primary workers.
- Future activation should run one sink worker owner against a safe non-production PostgreSQL target, then transfer process ownership in a separate release task.
- 30-minute reminders, schedule exceptions, next-session behavior, provider activation, and real sends remain explicitly unimplemented.
- The missing recurring reminder producer remains the next sequential class-fulfillment lane, not a small deployment setting.

## External Mutations

None. No Railway change, deployment, production database access, provider mutation, email, WhatsApp, Telegram, payment, DNS, member access, webhook, or long-lived worker was run.
