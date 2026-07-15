# OT-40 Final Report

## Scope

- Task: OT-40 - correct OT-36 School fulfillment behavior and lock the transactional sink-worker contract.
- Repository: `webcraft-media/onetimev2`.
- Base branch: `codex/ot36-delivery-sink-foundation`.
- Authoritative base head inspected read-only: `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae`.
- Worktree: `C:\Users\User\OneTimeOneTime-ot40-worker-contract-correction`.
- Branch: `codex/ot40-school-receipt-worker-correction`.
- Draft PR base: `codex/ot36-delivery-sink-foundation`.

## Upstream Read-Only Finding

Commit `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae` already provided the OT-36 addendum behavior for generic School acknowledgements, Family email eligibility when reminder preference is `none`, archived-contact fail-closed handling, expired `deliver_by` fail-closed handling, sink-only execution, scoped claim leases, and redacted audit metadata.

The remaining OT-40 gaps found by inspecting actual code/tests at that head were:

- Public outbox events still used generic `email_acknowledgement` and `whatsapp_confirmation` names rather than the locked explicit event kinds.
- Lead capture, worker claim SQL, migration `0004`, fixtures, and tests all shared the generic event names.
- Family immediate acknowledgements still resolved a dispatch-time class URL, which OT-40 forbids for this sink lane.
- Worker dispatch did not model or re-check the signup row status before public dispatch.

No duplicate implementation was made for the School generic acknowledgement already present upstream. OT-40 only corrected the remaining contract gaps above.

## Implementation

Changed files:

- `apps/worker/src/delivery/config.ts`
- `apps/worker/src/delivery/repository.ts`
- `packages/contracts/src/delivery/types.ts`
- `packages/db/migrations/0004_delivery_worker_claim_index.sql`
- `packages/domain/src/delivery/eligibility.ts`
- `packages/domain/src/delivery/messages.ts`
- `packages/domain/src/delivery/retry.ts`
- `packages/domain/src/lead/service.ts`
- `tests/integration/delivery/outbox-pipeline.test.ts`
- `tests/integration/delivery/postgres-repository.test.ts`
- `tests/integration/delivery/web-app-independence.test.ts`
- `tests/integration/lead-capture.test.ts`
- `tests/support/delivery/fixtures.ts`
- `tests/unit/delivery/config.test.ts`
- `tests/unit/delivery/eligibility.test.ts`
- `tests/unit/delivery/worker.test.ts`
- `ops/evidence/ot-40/FINAL-REPORT.md`

Contract corrections:

- Added explicit supported public event kinds:
  - `family_signup_email_ack.v1`
  - `family_signup_whatsapp_confirmation.v1`
  - `school_signup_email_ack.v1`
  - `school_signup_whatsapp_receipt.v1`
- Kept protected internal owner alert as a separate `internal_lead_alert` event.
- Updated lead capture to emit audience-specific public event kinds and deterministic delivery keys.
- Updated the worker claim allowlist and migration `0004` partial index predicate to those event kinds.
- Added dispatch-time audience/event mismatch rejection.
- Added dispatch-time signup status re-check; non-`new` signup rows skip with `signup_not_committed`.
- Replaced Family immediate message copy with a generic receipt that mentions the free-class purpose but contains no class URL, class details target, access grant, join action, portal, payment, automated CRM task, or live transport claim.
- Removed immediate delivery use of class-link config aliases.
- Preserved sink-only behavior, synthetic `sink_delivered` completion, `FOR UPDATE SKIP LOCKED`, lease-loss protection, retry/dead-letter handling, non-overlapping loop behavior, and redacted audit/log metadata.

## Event Matrix

- Family email:
  - Preferences `email`, `whatsapp`, `both`, and `none` are eligible exactly once through `family_signup_email_ack.v1`.
  - Covered by `tests/integration/delivery/outbox-pipeline.test.ts` preference matrix and `tests/integration/lead-capture.test.ts` `none` case.
- Family WhatsApp:
  - `family_signup_whatsapp_confirmation.v1` is eligible only for `whatsapp`/`both`, valid E.164 phone, recorded consent, active suppression state, non-archived contact, and committed signup.
  - Covered by delivery eligibility unit tests, sink pipeline tests, and lead-capture WhatsApp producer test.
- School email:
  - Every valid committed School signup gets one generic `school_signup_email_ack.v1`.
  - Message says inquiry was received and team will follow up.
  - Covered by eligibility, lead-capture, and sink pipeline tests.
- School WhatsApp:
  - `school_signup_whatsapp_receipt.v1` is eligible only for `whatsapp`/`both`, valid E.164 phone, recorded consent, active suppression state, non-archived contact, and committed signup.
  - Covered by eligibility, lead-capture, and sink pipeline tests.
- School output exclusions:
  - School public output contains no class link, class-access target, reminder, access, join, portal, payment, or automated CRM task claim.
  - Covered by `tests/integration/delivery/outbox-pipeline.test.ts` and `tests/integration/lead-capture.test.ts`.
- Internal owner alert:
  - Remains separate and protected by owner destination config.
  - Suppressed public rows do not suppress the protected owner alert.

## Commands And Results

Read-only upstream checks:

- `git fetch origin codex/ot36-delivery-sink-foundation` - pass.
- `git rev-parse origin/codex/ot36-delivery-sink-foundation` - `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae`.
- `git rev-parse HEAD` in `OneTimeOneTime-ot36-delivery-sink` - `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae`.
- `npx vitest run --config vitest.unit.config.ts tests/unit/delivery` at upstream - pass, 39 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/delivery tests/integration/lead-capture.test.ts` at upstream - pass, 18 tests.

Worktree/branch:

- `git worktree add -b codex/ot40-school-receipt-worker-correction C:\Users\User\OneTimeOneTime-ot40-worker-contract-correction 61d4755fe279ca47c37e7adbe8d1e6ce8b258dae` - pass.

Focused verification after OT-40 changes:

- `npx vitest run --config vitest.unit.config.ts tests/unit/delivery` - pass, 41 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/delivery tests/integration/lead-capture.test.ts` - pass, 22 tests.
- `npm run typecheck` - pass.
- `npm run lint` - pass.
- `npx prettier --write --ignore-unknown <touched files>` - applied formatting.
- `npx prettier --check --ignore-unknown <touched files>` - pass.
- `git diff --check` - pass; Git reported CRLF conversion warnings only.
- `npm run unit` - pass, 48 tests.
- `npm run integration` - pass, 28 tests.
- `npm run build` - pass.
- `npm run secret:scan` - pass across 105 repo text files.
- Redaction scan with `rg` found only fixture values and negative assertions; no outbox payload, log, evidence, or source path contains a raw class URL/message body/provider credential.

## External Mutations

None.

No deploy, live provider path, production database access, Railway/DNS change, payment/access mutation, BNA runtime change, Telegram/WhatsApp/email send, webhook call, or external messaging action was performed.

## Remaining Blockers

None for the scoped OT-40 sink-worker contract correction.

Real providers, T-30 reminder producer, recurrence, webhooks, Telegram, production DB activation, and fulfillment scheduling remain out of scope for this branch.
