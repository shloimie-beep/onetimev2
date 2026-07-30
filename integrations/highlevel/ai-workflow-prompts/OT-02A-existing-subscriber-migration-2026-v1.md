# OT-02A Existing Subscriber Migration 2026 v1 Prompt

Build in HighLevel Draft state only. Do not publish, send messages, select an audience, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-02A Existing Subscriber Migration 2026 v1
Folder: 10 - Enrollment & Nurture
Exact trigger: registered existing subscriber migration audience entry
message_class: existing_subscriber_migration
sender_key: rabbi_campaign
transport: GHL
Purpose: Three-email existing-subscriber migration sequence. The three reviewed emails below are the current controlled copy and supersede provider-era sender/copy instructions. Use them only in order and do not invent or expand their claims.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender state for this Draft:

- Select One Time Rabbi Campaign Sender Name; it must render exactly `Rabbi Eli Scheller`.
- Select One Time Rabbi Campaign Phase 2 From; it must render exactly `rabbielischeller@onetimeonetime.com`.
- Select One Time Rabbi Reply-To; it must render exactly `rabbielischeller@onetimeonetime.com`.
- The single canonical public identity is `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>` for both From and Reply-To.
- One Time Rabbi Campaign Phase 1 From and the historical `rabbi@onetimeonetime.com` alias remain preserved data but are superseded and must never be selected for canonical public use.
- Until GHL-UI-24 records provider acceptance, keep the workflow Draft and blocked; do not fall back to another identity and do not activate or send.
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- The audience is only an operator-selected adult existing-subscriber migration list. Historic payment, attendance, event registration, portal state, deliverability, and legacy tags never establish migration or marketing authority.
- Tisha event permission is event-purpose only and never permits this message.
- Check suppression and the approved migration authority before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames, or passwords.
- A GHL tag or field is not authorization for One Time portal access.

## Reviewed Email One — `rabbi_new_program_existing_subscriber_migration_v1`

Use this exact subject, preheader, body, signature, and CTA only after the separate audience, publication, and delivery approvals are all present. This copy is not an authorization to send.

- Subject: A new chapter for One Time Mishnayos
- Preheader: A personal note from Rabbi Eli about the One Time program.
- Body:

  > Shalom,
  >
  > I’m grateful to share that One Time Mishnayos is preparing a new program for boys to build clarity, memory, consistency, and a love of Mishnah through live learning from Eretz Yisrael.
  >
  > If you have learned with One Time before, I would be glad for you to see the current program and the controlled pilot: [One Time Home URL].
  >
  > This is an invitation to learn more; it does not change a family’s account, access, or payment status.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: Insert only the registered `One Time Home URL` custom value. Do not substitute a Tisha page, raw Zoom/provider link, price, or unverified application route.
- Compliance: Use the standard GHL unsubscribe treatment for the selected approved migration audience. Do not claim newsletter permission or infer it from customer history.

## Reviewed Email Two — `rabbi_parent_student_experience_existing_subscriber_migration_v1`

Use this exact subject, preheader, body, signature, and CTA only after the separate audience, publication, and delivery approvals are all present. This copy is not an authorization to send.

- Subject: How One Time works for your family
- Preheader: Live Mishnah learning, recordings, review, and progress in one secure family experience.
- Body:

  > Shalom,
  >
  > One Time Mishnayos is designed to help a student learn Mishnah live, return to class recordings for review, and keep building steady progress.
  >
  > A parent can use the family’s secure One Time access to follow the learning experience while each student’s information stays inside the registered family account.
  >
  > You can see how the Parent and Student experience is organized here: [One Time Home URL].
  >
  > Viewing this page does not enroll a student, activate access, or change any account or payment status.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: Insert only the registered `One Time Home URL` custom value with the label `See How One Time Works`.
- Compliance: Use the standard GHL unsubscribe treatment. Do not place Student data in GHL, imply that access is active, or expose recordings, progress, or provider links outside secure family access.

## Reviewed Email Three — `rabbi_controlled_pilot_existing_subscriber_migration_v1`

Use this exact subject, preheader, body, signature, and CTA only after the separate audience, publication, and delivery approvals are all present. This copy is not an authorization to send.

- Subject: An invitation to the One Time controlled pilot
- Preheader: Learn about the current pilot through the secure One Time Home.
- Body:

  > Shalom,
  >
  > We are inviting a small group of families to learn about the controlled pilot for the current One Time Mishnayos program.
  >
  > The pilot is a limited, controlled step for families who want to experience live Mishnah learning and the supporting review tools.
  >
  > To see current pilot information and any available next step, visit: [One Time Home URL].
  >
  > This email does not enroll your family, activate access, reserve a place, or change payment status. Participation is confirmed only through the controlled One Time process.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: Insert only the registered `One Time Home URL` custom value with the label `View the Controlled Pilot`. Do not substitute a direct signup, checkout, Zoom/provider, recording, or application URL.
- Compliance: Use the standard GHL unsubscribe treatment. Do not promise acceptance, infer consent, enroll a contact, or grant payment or access state from this invitation.

Test state:

- Keep the workflow Draft, unpublished, inactive, and unenrolled.
- Preserve the reviewed Email One exactly; do not rewrite it while adding Emails Two and Three to the repository specification.
- Leave cadence values unset until a separate approval supplies them.
- Do not select an audience or send in this lane.
- Do not use any contact until a separate exact authority names one protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
