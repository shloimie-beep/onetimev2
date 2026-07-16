# OT-89A Task

Owner: Codex

Repository: `https://github.com/webcraft-media/onetimev2.git`

Branch: `codex/ot89a-subscriber-support-producer`

Base: `origin/codex/ot84-telegram-action-gateway` at `f98103ecc3660dbda871a91485656e17580940a8`

Mission: implement the One Time producer half of OT89. The result must be a subscriber-only support form, local durable receipt, private attachment seam, immutable signed support event, asynchronous outbox delivery to BNA, and local cached status projection.

Non-negotiable product rules:

- Only authenticated active One Time subscribers may see or use technical or complaint support.
- Anonymous users, leads, schools without entitlement, expired or canceled users, and non-subscribers must use the existing public WhatsApp lead assistant only.
- The subscriber request path must not synchronously load, embed, call, poll, or wait for BNA or BNA UI.
- BNA is the ticket system of record; One Time owns only subscriber receipt, outbox, private attachment source, audit, and cached public projection.
- Telegram is alert and action transport only, not a database.
- User text and attachment metadata stay inert data and never become shell, SQL, Codex prompt, CLI, URL, callback, or file path input.

Scope exclusions:

- No BNA repository edits.
- No production deploy, production secret/config mutation, DNS, payment, live charge, provider send, or real-user mutation.
- No broad school separation, brand control plane, unrelated refactor, dependency modernization, or BNA cleanup.
