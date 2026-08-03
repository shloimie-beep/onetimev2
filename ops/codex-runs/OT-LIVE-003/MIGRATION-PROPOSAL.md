# OT-LIVE-003.02 migration proposal — rejected for now, not allocated

Status: `REJECTED FOR NOW / NOT GRANTED` by C00 at the reconciled safe checkpoint. This document is a proposal only. It does not reserve a number and no SQL file may be created until F02 approves this exact semantic purpose and C00 mirrors that allocation.

Decision evidence: the production deployment fence is terminal/released at control SHA `d51d317c0a97549345ec557f6fabbbbbce309915`, and both source and live censuses end at `2259`. The rejection is semantic, not numeric: the canonical C00 mirror is stale at `next_available_ordinal: 2257`, and the last valid F02 proposal allocates only 2257/2258 and ends at `next_available_ordinal: 2259`. No valid F02 record allocates the OT-LIVE-003 purpose for 2260.

## Fresh census

- Integration base: `cf30a6ca10695fb4e6b9859e7e4aba9c77831b2f`
- Highest migration on the branch at the 2026-08-03 checkpoint: `2259_vimeo_mishnayos_catalog_adoption.sql`
- Requested candidate: `2260_ot_live_003_reply_copilot.sql`
- Allocation authority: F02 under the C00 lease protocol; C00 may mirror only an exact approved allocation without semantic change

## Additive isolated scope

The migration would add only OT-LIVE-003 tables in the existing `onetime` schema. It would not alter existing Telegram/BNA tables, controllers, users, contacts, signup, or provider registries.

1. `onetime.reply_copilot_intents`
   - unique `(location_id, source_message_digest)` ingress fence;
   - route, version, state, prompt/model/voice versions, only hashed provider/chat/user references;
   - encrypted `intent_payload` ciphertext/digest/classification/expiry;
   - optimistic `version`, expiry, and timestamps.
2. `onetime.reply_copilot_actions`
   - token digest primary identity and intent foreign key;
   - expected chat/user hashes plus product/workspace/conversation/source/version/expiry binding;
   - atomic one-time `consumed_at` update.
3. `onetime.reply_copilot_telegram_outbox`
   - unique outbox and idempotency keys;
   - encrypted card payload, route-safe chat hash, bounded attempts;
   - queued/leased/retry/unknown/sent/dead-letter states and reclaim indexes;
   - hashed provider message reference for draft reply binding.
4. `onetime.reply_copilot_ghl_outbox`
   - unique outbox and durable idempotency keys;
   - encrypted same-thread request payload and reply digest;
   - bounded retry/unknown/reconciliation state;
   - hashed returned message/conversation/thread references.
5. `onetime.reply_copilot_voice_examples`
   - one outcome per intent/outcome (`accepted_exact`, `edited`, `rejected`);
   - suggestion/final digests, prompt/model versions, actor hash, approved-for-voice flag;
   - encrypted approved final text and explicit expiry; no inbound body or public-corpus link.
6. `onetime.reply_copilot_audit`
   - append-only redacted outcome/reason metadata; no raw email, Telegram identifier, or reply text.

## Required constraints and indexes

- lowercase 64-character SHA-256 checks for all digests;
- product fixed to `one_time`; allowed location fixed to `pBSnOK2nkdxp6gf9Rg3o`;
- all private payload classifications fixed to `intent_payload`;
- claim indexes on `(state, next_attempt_at, created_at)` and expired-lease reclaim indexes;
- no cascade from intent to audit or voice evidence;
- PostgreSQL append-only guard for audit rows;
- no raw contact, conversation, message, thread, chat, user, email body, reply body, token, or secret outside ciphertext.

## Verification requested after allocation

- fresh and upgrade migration application;
- duplicate source fence;
- atomic callback consumption with wrong-identity non-consumption;
- claim/reclaim and lease-generation compare-and-set;
- encrypted-at-rest assertions and expiry presence;
- `unknown` state plus bounded dead-letter behavior;
- same-thread provider-reference digests;
- append-only audit guard;
- migration ledger/checksum verification.

## Exact allocation request

Submit this unchanged proposal to the F02 allocation lane for the exact path `packages/db/migrations/2260_ot_live_003_reply_copilot.sql`. If F02 assigns a different number or scope, update the proposal and census before creating any migration file. Do not infer a reservation from the collision-free number.

## Rollback

Before merge, remove only the unallocated additive migration and its isolated adapter. After application, use an F02-allocated forward migration; do not drop tables from this lane. Delivery remains safely disabled by all five default-off feature flags throughout.
