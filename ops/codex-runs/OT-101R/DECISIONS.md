# OT-101R Decisions

- Use the existing OT-84 ingress, inbox, confirmation, identity, audit, and worker foundation instead of creating a parallel bot subsystem.
- Keep Telegram replies redacted and scope-anchored to `accountKey/productKey`; no handles, raw Telegram IDs, email lists, phone lists, provider URLs, provider IDs, tokens, or secrets are exposed.
- Change all Telegram writes to preview plus explicit confirmation, including deterministic slash commands.
- Implement safe local mutations only where the existing One Time application tables support scoped, reversible, idempotent updates. High-impact provider operations stay web-only.
- Treat social approvals as secure web deep links from Telegram in V1; Telegram does not schedule Buffer posts or publish directly.
- Keep real Telegram sending off by default. Runtime registration may accept a protected Bot API transport, but sink/outbox mode remains the default for tests and staging without protected secrets.
- Live canary remains blocked unless protected staging bot token, webhook secret, and exact allowlisted Telegram identity mapping are present.
