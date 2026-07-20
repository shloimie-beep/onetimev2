# OT-B05 Apply Opt-Out Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.0.0
Folder: 00 - Intake & Data
Purpose: Apply opt-out, DND, suppression and stop bot follow-up.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

When the contact says STOP, unsubscribe, remove me, do not contact me, wrong number, or equivalent, set relevant channel DND, update consent and suppression fields, remove related opt-in tag, add OT | Marketing Suppressed when appropriate, remove from marketing/nurture workflows, and stop bot auto-follow-up.
Send one confirmation only.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
