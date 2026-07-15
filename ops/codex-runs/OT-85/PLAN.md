# OT-85 Plan

1. Resolve OT83 base, create clean worktree, and initialize run artifacts. Done.
2. Inventory repository architecture, services, migrations, tests, and provider state. Done.
3. Implement WhatsApp transport primitives, durable inbox/outbox, typed intent compiler, public facts, consent/suppression, lead flow, provider adapter, bounded processing, and verified account seam using existing conventions. Done.
4. Add migrations and fixture/sink tests covering the OT-85 negative catalog. Done.
5. Run safe local checks and record evidence. Done.
6. Run the canary gate without printing or passing the protected recipient value. Done; waiting for `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164`.
7. Commit, push `codex/ot85-whatsapp-lead-assistant`, and create draft PR. Pending after this artifact update.

Current checkpoint: `WAITING_FOR_WHATSAPP_CANARY_SECRET`.
