# OT-E01 Tisha B'Av 2026 Registration and Reminders Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-E01 Tisha B'Av 2026 Registration and Reminders
Folder: 45 - Events / 2026 / Tisha B'Av 2026
Exact trigger: Tisha B'Av 2026 registration or approved reminder milestone is recorded
message_class: event_registration_confirmation
sender_key: brand
transport: GHL
Purpose: Registered Tisha B'Av 2026 registration and reminder workflow.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker:

- One Time Brand Sender Name
- One Time Brand From
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

Use event_code tisha-bav-2026 and the canonical Tisha B'Av registration/reminder state.
Use brand unless an approved Rabbi-authored prompt version explicitly maps the step to rabbi_campaign.
Do not duplicate event tags or custom values.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
