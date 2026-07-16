# OT-100 Decisions

## DEC-OT100-001 - Worktree And Base

Use a clean isolated worktree at `C:/Users/User/onetimev2-ot100-whatsapp-public-provider-activation` and branch `codex/ot100-whatsapp-public-provider-activation` from exact base SHA `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`.

Reason: the prompt explicitly requires this branch and a clean isolated worktree.

## DEC-OT100-002 - Default Runtime Mode

Keep real WhatsApp provider execution off unless protected staging configuration, an exact environment fingerprint, an explicit enable flag, an allowlisted canary destination, and a bounded canary budget are present.

Reason: the prompt requires production-shaped but staging-safe behavior, and AGENTS.md forbids sends or provider mutations from this task without protected configuration.

## DEC-OT100-003 - Meta Graph Version

Pin OT-100 Cloud API send behavior to Graph API `v25.0`.

Reason: official Meta Graph API documentation identified `v25.0` as the latest current Graph API version on 2026-07-16.

## DEC-OT100-004 - Free-Form Reply Window

Treat OT-100 public assistant replies as service/non-template messages that may only be sent inside an open 24-hour customer-service window. OT-100 does not add templates, campaigns, or proactive sends.

Reason: official Meta WhatsApp service-message documentation ties free-form non-template replies to the 24-hour customer-service window.

## DEC-OT100-005 - Migration Reservation Used

Use optional additive migration `2100_ot100_whatsapp_provider_activation.sql`.

Reason: existing OT-85 tables could represent queued/sent/sink/retry/dead-letter status and hashed provider refs, but not lease owner/expiry/generation, encrypted provider message IDs, provider retry-after metadata, or status-event dedupe keys.
