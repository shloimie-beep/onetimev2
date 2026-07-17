# W12-05 Telegram Operations Runbook

This runbook is for operator activation after code review. It does not authorize this branch to register a production webhook, mutate a production webhook, send real Telegram messages, or store secrets in Git/chat/evidence.

## Protected Config Entry

1. Enter the Telegram bot token directly in the protected hosting environment or secret manager. Do not paste it into ChatGPT, Codex, GitHub comments, commits, screenshots, shell history captures, or evidence files.
2. Set safe readiness indicators only:
   - `ONE_TIME_TELEGRAM_TOKEN_CONFIGURED=true`
   - `ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED=true`
   - `ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED=true`
   - `ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE=true`
   - `ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED=true` only after the canary chat is allowlisted
3. Keep `ENABLE_REAL_TELEGRAM_TRANSPORT=false` unless a separate canary task explicitly authorizes a real send.
4. Keep exactly one consumer mode enabled. Do not enable webhook and polling together.

## Webhook Registration

Webhook registration is an operator/manual deployment action outside this branch. For staging only, after review and explicit approval:

1. Confirm staging environment, bot identity, webhook secret, and public base URL.
2. Confirm production webhook state will not be changed.
3. Register the staging webhook using the protected token in the provider console or a protected admin shell with command echo disabled.
4. Record only redacted evidence: timestamp, staging environment, bot key, safe fingerprint, and success/failure status.

## Duplicate Consumer Detection

1. Check `telegram_consumer_leases` for active leases by bot key and environment.
2. If a second consumer appears, stop the newer process, preserve lease evidence, and keep webhook/polling mutually exclusive.
3. A Telegram 409 polling conflict must stop the polling adapter rather than retrying forever.

## Token Rotation

1. Revoke or rotate the bot token in Telegram directly.
2. Update protected config only.
3. Reset readiness indicators until the new token, webhook secret, mapping, and canary chat are proven.
4. Do not commit the token or any token-shaped value.

## Bounded Canary

1. Use staging only.
2. Use one allowlisted owner/admin canary chat.
3. Exercise `/status`, `/scope`, `/today`, `/delivery`, and one preview/cancel write.
4. Do not perform broad sends, payment actions, Buffer publication, provider config changes, or production webhook changes.

## Rollback

1. Disable webhook or real transport in protected config.
2. Stop the worker/consumer.
3. Revert to sink response outbox behavior.
4. Leave the bot token in the protected store only if a follow-up canary is planned; otherwise rotate it.
