# OT-02A Existing Subscriber Migration 2026 v1 Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-02A Existing Subscriber Migration 2026 v1
Folder: 10 - Nurture & Sales
Exact trigger: registered existing subscriber migration audience entry
message_class: existing_subscriber_migration
sender_key: rabbi_campaign
transport: GHL
Purpose: Three-email existing-subscriber migration sequence.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker:

- One Time Rabbi Campaign Sender Name
- One Time Rabbi Campaign Phase 1 From
- One Time Rabbi Campaign Phase 2 From
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

Run only for existing subscribers in the 2026 migration segment.
Use the three-email migration sequence only; do not mix it with the public lead-capture bot.
Do not hardcode price or dates. Read offer and price custom values.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
