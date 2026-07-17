# OT-51P Inbox, Lease, And Idempotency

## Inbox

- Durable table: `onetime.telegram_update_inbox`.
- Unique dedupe: `(bot_key, update_id)`.
- Claim semantics: queue/retry rows and expired leases can be claimed.
- SQL repository uses `FOR UPDATE SKIP LOCKED` with fallback for pg-mem.
- Completion is generation-safe: stale generation does not complete a newer
  lease.
- Retry uses bounded attempts and next-attempt backoff.
- Dead-letter terminal state writes `onetime.telegram_dead_letters`.

## Consumer Ownership

- Durable table: `onetime.telegram_consumer_leases`.
- Unique active owner per `(bot_key, environment, token_fingerprint_hash)`.
- Expired active lease is marked inactive before reclaim.
- Generation increments on reclaim.

## Command Idempotency

- Confirmed writes generate an idempotency key from bot, environment, update,
  actor, and action digest.
- Duplicate callbacks and retries consume one logical confirmation.
- Fixture adapter stores one result per idempotency key; repeated confirmation
  reports already handled.

## Proof

- Unit worker proof: claim, complete, retry, dead-letter, topology refusal, and
  mock 409 shutdown.
- Integration pg-mem proof: unique mapping, update dedupe, generation-safe
  completion, dead-letter insert, confirmation single-use, and lease
  exclusivity/reclaim.
