# OT-B02 Send Next Confirmed Class Info Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.0.0
Folder: 40 - Classes & Content
Purpose: Safe next confirmed class info adapter.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Return or send only safe current class information from One Time.
Preferred output: next confirmed class time, timezone, portal URL and whether Join Class is available.
Fallback: I do not have a confirmed class update available right now. Please check the One Time portal or email info@onetimeonetime.com.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
