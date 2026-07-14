# OT-51P Privacy And No-Network Proof

## Privacy Controls

- Ingress hashes provider user IDs and chat IDs into opaque refs.
- Username, display name, shared phone, group membership, forwarded content, and
  message possession are never authentication.
- No raw update body is stored.
- No raw message body, contact query, callback payload, token, secret, provider
  URL, real user ID, chat ID, username, phone, email, or contact data is written
  to evidence.
- Audit events store actor/capability/correlation/outcome metadata only.
- `SensitivePayloadCodec` is injected. The deterministic codec is test-only.
- Production activation remains blocked until a reviewed protected codec/key
  source exists.

## No-Network / No-Mutation Proof

- No Telegram SDK dependency was added.
- No code calls Telegram endpoints.
- No `fetch`, arbitrary HTTP client, shell execution, child process, arbitrary
  SQL runner, or file read tool path exists in the Telegram runtime.
- The only transport implementation is `MockBotTransportAdapter`, which stores
  synthetic replies in memory.
- No webhook registration, polling activation, BotFather action, Railway/DNS
  action, production DB access, payment/access mutation, email/WhatsApp send,
  Telegram send, or provider mutation occurred.
