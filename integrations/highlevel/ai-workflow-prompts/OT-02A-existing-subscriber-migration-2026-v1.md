# OT-02A Existing Subscriber Migration 2026 v1 Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.0.0
Folder: 10 - Nurture & Sales
Purpose: Three-email existing-subscriber migration sequence.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Run only for existing subscribers in the 2026 migration segment.
Use the three-email migration sequence only; do not mix it with the public lead-capture bot.
Do not hardcode price or dates. Read offer and price custom values.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
