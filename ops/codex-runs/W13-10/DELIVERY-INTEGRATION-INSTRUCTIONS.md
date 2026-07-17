# Delivery Integration Instructions

W13-90 must route provider-specific email, WhatsApp, Telegram, Zoom, Vimeo, Buffer, Stripe, helper, and BNA bridge activation through the W13-10 activation policy or an explicitly reviewed adapter with the same blocker semantics.

Required adapter behavior:

- No silent sink success after a provider failure.
- Preserve idempotency keys across retries.
- Check suppression, STOP, unsubscribe, hard bounce, complaint, and missing channel consent before adapter invocation.
- Log only blocker codes, provider mode, budget counters, opaque references, and fingerprints.
