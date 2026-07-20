# OT-B01 Complete Signup Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.0.0
Folder: 00 - Intake & Data
Purpose: Typed bot action adapter for adult signup.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Triggered only by OT-A1 after adult details are complete.
Required adult fields: contact_name, family_or_school, audience_type, location, timezone, browser_timezone, email, phone when WhatsApp or Both, reminder_preference, reminder_consent, consent_context, idempotency_key, attribution.
Use the protected HighLevel-to-One-Time adapter. If it is missing, block instead of putting complex consent logic into the bot prompt.
Never collect Student details.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
