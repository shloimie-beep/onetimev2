# App–GHL Event Bridge Result

- Result: `code_ready_live_canary_not_run`
- Recorded at: `2026-08-09T08:34:08.562Z`
- Repository: `shloimie-beep/onetimev2`
- Integration PR: `#131`
- Integration branch: `codex/one-time-complete-production-launch-20260805`
- Child branch: `codex/ot-p4-app-ghl-bridge-20260809`
- Base SHA: `5154a5764bc778fec9db0f3ebc98ab5901809c24`
- Exact OT-01 workflow ID: `95a6f461-1a04-4260-b379-246fdcc45af7`
- Production runner state: `disabled`

## Delta-only scope

The existing Family-signup transaction, adult-only HighLevel provider adapter, household opportunity upsert, exact OT-01 workflow enrollment, durable dispatch ledger, and signed `access.apply_current_state` action were retained. This lane did not repeat provider inventory, credential classification, architecture review, or a broad test suite.

The unresolved application delta was implemented:

- the runner now accepts only `disabled` or an exact production-operator canary mode;
- canary mode requires an OT-01 proof reference, one run identity, exactly one allowlisted durable Family intent, a one-effect budget, a batch size of one, and the configured HighLevel token;
- claim creation, expired-lease quarantine, and claim selection are all restricted to that exact intent;
- every acceptance-unknown contact, opportunity, or workflow response is quarantined instead of retried;
- accepted provider effects and deferred/uncertain dispositions write sanitized audit evidence;
- the accepted adult contact and household opportunity create the exact durable adult-to-household identity bridge required by `access.apply_current_state`;
- no Student contact or Student provider identity is created;
- verified access actions require exact scope, event/request identity, billing episode, state mapping, hashed provider identity evidence, ordering, nonce, signature, and idempotency checks;
- one ingestion source is claimed per billing episode and accepted signed access events are append-only;
- direct Stripe runtime ingestion remains disabled and unwired. A conflicting pre-claim for the same billing episode fails closed with source-precedence rejection.

## OT-01 dependency evidence

OT-P3 reported a saved Draft workflow and successful reopen readback for the exact workflow ID. The approved subject, preheader, body/signature, and production login link persisted. Exactly one operator-owned seed was enrolled from the workflow test page at `2026-08-09 11:32 IDT`; its history finished with one Email action executed and the workflow ending one second later. After that seed proof, both `Allow re-entry` and `Allow multiple opportunities` were disabled, saved, and verified off on reopen. Final readback verified the Draft workflow in `00 - Intake & Data` with the exact visible name `OT-01 Family Account Confirmation` and the persisted sender `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>`. No repeat seed or broad/live enrollment was enabled. Provider execution identifiers and recipient details are intentionally omitted from this sanitized result.

This evidence permits one bounded operator-owned Family signup canary only. It does not approve general enrollment.

## Focused validation

- TypeScript project type-check: `passed`
- Family runner/provider/repository: `13 passed`
- Signed current-access integration: `13 passed`
- Canary configuration and Family dispatch migration: `7 passed`
- Read-only migration inventory verification: `8 passed`
- Diff whitespace check: `passed`

The focused coverage includes existing-adult matching, exact workflow routing, adult-only identity persistence, strict allowlisting, suppression-preserving provider behavior, ambiguous identity quarantine, explicitly rejected provider retry, acceptance-unknown quarantine, invalid signature, stale timestamp, replay nonce, wrong scope, missing/mismatched identity, exact idempotent replay, active/grace/recovery/cancel-at-period-end/revoked transitions, source conflict, append-only evidence, audit evidence, and no payment-history write.

## Provider and deployment status

P4 made no live GHL UI change, no Railway variable change, no deployment, and no provider call. The runner remains disabled and no Family live-write intent was selected. The controller has authorized the bounded canary stage only after this child PR is reviewed and merged and the exact resulting integration head is deployed by OT-CTRL. Direct deployment of the child branch is prohibited.

No known OT-01 workflow naming, sender-identity, re-entry, or multiple-opportunity setting delta remains in this lane. That final readback does not approve general enrollment.

## Rollback and resumption

At rest, rollback is the unchanged `FAMILY_SIGNUP_GHL_MODE=disabled` default. No production migration has been applied and no provider mutation needs cleanup. After OT-CTRL merges the child PR and deploys the exact integration head, resume from this result, set only the bounded canary proof/run/intent/budget fields, run one worker effect at a time for the single operator-owned Family intent, and prove one local adult identity, one household, immediate free access, one adult GHL contact, one household opportunity, exactly one OT-01 enrollment/email, zero Student GHL contacts, and idempotent replay with no duplicate effects. Immediately restore disabled mode and commit the sanitized canary/cleanup handoff. Any ambiguity or acceptance-unknown response must stop the canary for reconciliation rather than retry.
