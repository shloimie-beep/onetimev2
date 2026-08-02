# OT-02A Existing Subscriber Migration 2026 v1 Prompt

Build in HighLevel Draft state only. Do not publish, send messages, select an audience, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-02A Existing Subscriber Migration 2026 v1
Folder: 10 - Enrollment & Nurture
Exact trigger: registered existing subscriber migration audience entry
message_class: existing_subscriber_migration
sender_key: rabbi_campaign
transport: GHL
Purpose: Three-email informational, restart, and Family-account activation sequence for an approved adult existing-subscriber migration audience.

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
- The historical `rabbi@onetimeonetime.com` alias must never be selected for canonical public use.
- Until GHL-UI-24 records provider acceptance, keep the workflow Draft and blocked; do not fall back to another identity, activate, enroll, or send.
- Do not type or guess sender display-name, From, Reply-To, or provider text.

Required boundaries:

- Use only registered One Time fields, tags, and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags.
- The audience is only an operator-selected adult existing-subscriber migration list with documented migration authority. Payment, attendance, event registration, portal state, deliverability, and legacy tags never establish that authority.
- Event-specific permission never permits this sequence.
- Check migration authority and every suppression state before each email.
- Exit on signup, decline, invalid address, unsubscribe, DND, complaint, hard bounce, suppression, or sequence completion.
- Do not create Student contacts, human tasks, or Human Handoff actions.
- Do not expose provider links, tokens, payment-card data, internal IDs, usernames, or passwords.

## Reviewed Email One - `ghl.legacy_member_migration.step_1.v1`

- Subject: A new zman for One Time Mishnayos
- Preheader: A personal update from Rabbi Eli about what is beginning in Elul.
- Body:

  > Shalom {{contact.first_name}},
  >
  > I'm grateful to share that One Time Mishnayos is beginning a new zman in Elul.
  >
  > The program is built to help boys gain clarity, memory, consistency, and a love of Mishnah through steady learning from Eretz Yisrael.
  >
  > Because your family learned with One Time before, I wanted you to know what is coming and give you a simple way to see the current program.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: `See What's New` using only the registered `One Time Home URL` custom value.

## Reviewed Email Two - `ghl.legacy_member_migration.step_2.v1`

- Subject: A steady way to begin Mishnah again
- Preheader: Live learning, on-demand review, and a clear routine for the new zman.
- Body:

  > Shalom {{contact.first_name}},
  >
  > As the new zman approaches, this is a good time to help your son begin again with a steady Mishnah routine.
  >
  > One Time combines live learning with an on-demand recording library, so a Student can return to a class, review, and keep building progress. A parent manages the secure Family account while each Student uses separate access.
  >
  > I would be glad to have your family learning with us again.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: `See How One Time Works` using only the registered `One Time Home URL` custom value.

## Reviewed Email Three - `ghl.legacy_member_migration.step_3.v1`

- Subject: Activate your new One Time Family account
- Preheader: Restart with immediate free access and room for up to three Student seats.
- Body:

  > Shalom {{contact.first_name}},
  >
  > If your family would like to restart with One Time, the next step is to activate your durable Family account through the secure One Time signup.
  >
  > Your family can begin with immediate free access and add up to three Student seats for live learning and the on-demand recording library. No card is required, and there is no automatic charge.
  >
  > Account activation happens only through the secure One Time process; this email does not create Student accounts or change payment status.
  >
  > With bracha,
  > Rabbi Eli Scheller
  > One Time Mishnayos

- CTA: `Activate My Family Account` using only the registered `One Time Signup URL` custom value.

Use the standard GHL unsubscribe treatment on all three emails. This copy is not authorization to send.

Test state:

- Keep the workflow Draft, unpublished, inactive, and unenrolled.
- Keep cadence values unset until separate approval supplies them.
- Do not select an audience or send.
- Use no contact until separate authority names one protected operator-owned test contact.
- Keep the publish toggle off until explicit separate approval.
