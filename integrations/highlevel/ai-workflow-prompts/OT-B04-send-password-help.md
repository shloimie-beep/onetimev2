# OT-B04 Send Password Help Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-B04 Send Password Help
Folder: 30 - Portal Lifecycle
Exact trigger: OT-A1 invokes the typed password-help adapter
message_class: password_reset
sender_key: account_security
transport: Resend
Purpose: Send canonical password-help URL.
Companion delivery: GHL may request the One Time adapter but never stores or sends a reset token.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker:

- One Time Account Sender Name
- One Time Account Preferred From
- One Time Default Reply-To
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Send only the canonical password-help URL: https://join.onetimeonetime.com/forgot-password.
Use this privacy-safe message: If that email is registered for One Time, the password-help page can send a secure reset link.
Do not call /api/one-time/parent-password/request.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
