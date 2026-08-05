# One Time Mishnayos — Workflow, Notification, and Copy Catalog

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`  
**Status:** Normative  
**Effective date:** 2026-07-28

## WNC-1. Purpose and authority

This catalog is the canonical communications contract. HighLevel is the adult CRM, campaign-authoring, workflow-execution, website-bot, conversation, and operator-facing billing surface. Resend handles account-security delivery. One Time owns authenticated in-app notices and the product events that trigger communications.

No Student becomes a HighLevel contact. Student email and phone are not collected. Parent/account-owner contact information is used for adult communication.

The active HighLevel registry must use the identifiers and dispositions below. An identifier may never be silently reused for a different business purpose.

## WNC-2. Sender identities

| Sender key | From name | From address | Reply-To | Permitted purposes |
|---|---|---|---|---|
| `rabbi_campaign` | Rabbi Eli Scheller \| One Time Mishnayos | `rabbi@onetimeonetime.com` | `info@onetimeonetime.com` | Migration, reactivation, lead nurture, Parent newsletter, teaching/program messages |
| `office` | One Time Mishnayos | `info@onetimeonetime.com` | `info@onetimeonetime.com` | Billing, access, schedule changes, support, school acknowledgment, neutral operations |
| `security_resend` | One Time Account Security | `info@onetimeonetime.com` | `info@onetimeonetime.com` | Setup, reset, security notice; Resend only |

Sender authentication requires valid SPF, DKIM, DMARC alignment, verified domains, bounce/complaint webhooks, and provider readback before broad send.

## WNC-3. Communication purposes and consent

| Purpose | Required? | Provider | Consent basis | Suppression behavior |
|---|---:|---|---|---|
| Setup, reset, credential/security notice | Yes | Resend | Requested account/security action | Security abuse controls; not marketing unsubscribe |
| Billing, access, cancellation, payment failure | Yes | GHL email | Account/contract service | Deliver unless address is invalid; marketing opt-out does not suppress essential service email |
| Class schedule change/cancellation | Yes | GHL email; in-app | Active service | Deliver to account owner and affected Student in-app |
| Class reminder | Parent-configurable | GHL email; future WhatsApp; Student in-app | Service reminder preference | Respect channel preference, DND, invalid channel, and dedupe |
| Recording available | Parent-configurable | GHL email; future WhatsApp; Student in-app | Service/content preference | Respect category/channel preference |
| Parent newsletter | Optional | GHL email | Explicit newsletter permission | Suppression checked at execution |
| Marketing/nurture/reactivation | Optional | GHL email | Explicit marketing permission | DND, unsubscribe, complaint, hard bounce, invalid address, and suppression block send |
| School acknowledgment | Yes, one message | GHL email | Requested response | No automated school nurture |
| Student question/support update | Yes, in-app | One Time | Authenticated product request | No GHL Student contact or Student outbound email |

Consent and lifecycle are separate. “Active customer” does not imply marketing permission. “Marketing permitted” does not imply product access.

### WNC-3.1 Dormant WhatsApp preference behavior

Until the WhatsApp provider, approved templates, consent gate, sender, webhook, registry, and production canary are all activated, optional Parent reminders use this exact matrix:

| Saved preference | Optional Parent email | WhatsApp provider call | Required UI/status behavior |
|---|---:|---:|---|
| `email` | Yes | No | Show email as active |
| `whatsapp` | Yes, as the temporary launch fallback | No | Persist intent and state plainly that WhatsApp is unavailable |
| `both` | Yes | No | Persist both; state plainly that WhatsApp is unavailable |
| `none` | No | No | Confirm that optional Parent reminders are off |

The dormant-provider fallback never changes essential requested account/security email or essential billing/access email. It never creates a Student contact, claims a WhatsApp delivery, or delays the email branch. Activation of WhatsApp replaces this temporary matrix only after the gates in WNC-9 pass and a new approved registry digest is recorded.

## WNC-4. Canonical workflow registry

| Workflow ID | Canonical name | Launch disposition |
|---|---|---|
| `OT-01` | Public Intake and Family Signup | Active |
| `OT-02A` | Active Legacy Member Invitation | Active after copy/segment approval |
| `OT-02B` | Interested Lead Nurture | Configured, paused until Admin starts |
| `OT-03` | Checkout Started / Abandoned | Active when live billing is enabled |
| `OT-04` | Payment Active / Access Recovery | Active when live billing is enabled |
| `OT-05` | Payment Failed / Grace | Active when live billing is enabled |
| `OT-06` | Subscription Canceled / Ending | Active when live billing is enabled |
| `OT-07` | Parent Portal Invitation Companion | Active |
| `OT-08` | Parent Portal Activated | Active |
| `OT-09` | Parent Class Reminder and Schedule Change | Email active; WhatsApp branch dormant |
| `OT-10` | Recording Available | Email active; WhatsApp branch dormant |
| `OT-11` | Retired — former WhatsApp Lead Qualification | Permanently retired/reserved; must not execute |
| `OT-12` | Adult Support Intake / Technical Escalation | Retained for adult support only |
| `OT-13` | Refund / Chargeback Notice | Active when live billing is enabled |
| `OT-14` | Parent Newsletter | Configured; first broad send requires approval |
| `OT-15` | Former Member Reactivation | Configured; first broad send requires approval |
| `OT-16` | Free-Period Conversion | Configured; activates relative to canonical expiry |
| `OT-B01` | Website Lead-Capture Bot | Active on approved public funnel |

Tisha B’Av assets are archived under an event-template namespace. They may be copied into a future event only through a new identifier, audience, approval fingerprint, and canary. They are not general One Time workflows.

## WNC-5. Workflow execution contract

Every workflow record includes:

- stable ID and provider ID;
- exact trigger and trigger version;
- audience query and current count;
- sender and reply-to;
- template IDs and immutable content digests;
- steps, waits, timezone, and quiet hours;
- consent/suppression gates;
- per-contact dedupe key;
- exit conditions;
- maximum entry count and effect budget;
- pause switch;
- seed/canary identity;
- approved-by actor and approval timestamp;
- provider save/reopen/readback evidence;
- delivery/bounce/complaint/reply statistics;
- registry revision.

Audience, sender, subject, body, CTA, wait, channel, or trigger changes invalidate approval.

Suppression and consent are evaluated again immediately before every send, not only on workflow entry.

For adult messaging, quiet hours are 20:30–08:00 in the household timezone. Security messages and same-day cancellation/provider-failure messages may bypass quiet hours. Normal class reminders are scheduled for 30 minutes before class even when that falls within a configured quiet period because the account owner requested the reminder.

## WNC-6. Workflow definitions

### WNC-6.1 `OT-01` Public Intake and Family Signup

**Family branch**

1. Accept idempotent public signup.
2. Create or safely link one local adult identity and human login from the submitted email and password.
3. Before the canonical free-expiry instant, commit the Parent identity, Family household, and immediate free access without a card. At or after the instant, commit the Parent identity and inactive Family household, then return the GHL-hosted standard-checkout continuation.
4. Match or create one adult GHL contact by verified provider link or normalized email and one household-keyed GHL opportunity/account record.
5. Set the household GHL lifecycle projection to `one_time_family_signup`.
6. Send the GHL welcome companion only after local account and access-state readback.
7. Exit when the accepted branch reaches its durable result; do not send duplicate welcome messages on resubmission.

A fresh public Family signup does not require an emailed setup token because the adult sets a password on the form. The seven-day Resend setup link is reserved for legacy invitation, Admin-created account, ownership-transfer acceptance, or a passwordless account that must be claimed.

An ambiguous GHL match quarantines only the CRM/provider link. It does not roll back or block the local adult login, household, or pre-expiry free access. GHL workflow/sync and paid billing are held until an Admin resolves the contact; security email continues through Resend.

**School branch**

1. Match/create the adult contact.
2. Tag `one_time_school_inquiry`.
3. Create a sales follow-up item for Shloimie.
4. Send one acknowledgment.
5. Stop. Do not enter family access, nurture, billing, or newsletter workflows automatically.

**Family welcome companion — accepted before free expiry**

- Subject: `Welcome to One Time Mishnayos`
- Preheader: `Your Parent account is ready.`
- Body:

> Hi {{contact.first_name}},
>
> Welcome to One Time Mishnayos with Rabbi Eli Scheller.
>
> Your family has free access until September 11, 2026 at 6:00 PM Asia/Jerusalem. There is no card required and no automatic charge.
>
> Sign in with the email and password you chose, then add up to three Student accounts. Each Student will use a separate username and password for class and recordings.
>
> Hatzlacha,  
> Rabbi Eli Scheller  
> One Time Mishnayos

**Family account companion — accepted at or after free expiry**

- Subject: `Continue setting up One Time Mishnayos`
- Preheader: `Complete secure checkout to activate Student access.`
- Body:

> Hi {{contact.first_name}},
>
> Your One Time Family account has been created.
>
> Complete secure checkout for the $67/month Family plan to activate Student creation, live class, and recordings. Your account has not been charged yet.
>
> **Continue to secure checkout**
>
> One Time Mishnayos

**School acknowledgment**

- Subject: `We received your One Time school inquiry`
- Body:

> Hi {{contact.first_name}},
>
> Thank you for your interest in One Time Mishnayos for your school.
>
> We received your information. Shloimie will contact you to discuss pricing, Student seats, and setup.
>
> No account or paid subscription has been created yet.
>
> One Time Mishnayos  
> info@onetimeonetime.com

### WNC-6.2 Resend account setup

- Subject: `Set up your One Time account`
- Link lifetime: seven days.
- Body:

> Hi {{adult.first_name}},
>
> Use the button below to set your One Time password.
>
> **Set up my account**
>
> This link can be used once and expires on {{token.expires_at_local}}. If it expires, request a new link from the sign-in page.
>
> If you did not request this account, you can ignore this email.

The setup URL contains an opaque single-use token, uses the app origin, has no third-party tracking, and never includes a raw provider identifier.

### WNC-6.3 `OT-02A` Active Legacy Member Invitation

Audience is the dated, explicitly approved active legacy segment. No existing password, child profile, consent, payment state, or access is inferred.

| Step | Timing | Subject | CTA |
|---|---:|---|---|
| 1 | Approval launch | `Your new One Time account is ready` | `Create my new account` |
| 2 | 3 days later if not signed up | `A simpler way to join Rabbi Eli’s class` | `Set up One Time` |
| 3 | 7 days later if not signed up | `Your free One Time access is waiting` | `Get free access` |

Exit on signup, suppression, invalid email, or explicit decline.

Step 1 copy:

> Hi {{contact.first_name}},
>
> One Time Mishnayos now has a new Parent and Student application for Rabbi Eli’s live class and recording library.
>
> Your old login will not move automatically. Please create a new Parent account, then add each Student with a separate username and password.
>
> If you sign up before September 11, 2026 at 6:00 PM Asia/Jerusalem, access is free until that time. No card is required and you will not be charged automatically.
>
> **Create my new account**
>
> Hatzlacha,  
> Rabbi Eli Scheller  
> One Time Mishnayos

### WNC-6.4 `OT-02B` Interested Lead Nurture

Audience: explicit opted-in leads only. Start requires Admin action.

| Step | Timing | Subject | Main point |
|---|---:|---|---|
| 1 | Start | `A daily Mishnayos class Students look forward to` | Rabbi, live class, separate Student access |
| 2 | Day 2 | `Live class, review, and recordings in one place` | Parent/Student experience |
| 3 | Day 5 | `Ask Rabbi Eli directly from the Student portal` | Questions and connection |
| 4 | Day 9 | `Free access through Rosh Hashanah` | Free period and no-card rule |

Every message has one CTA: `Start free`.

Exit on family signup, school classification, unsubscribe, suppression, complaint, hard bounce, or sequence completion.

### WNC-6.5 `OT-03` Checkout Started / Abandoned

Trigger: approved live checkout session created for an eligible household.

- Exit immediately on verified payment/subscription activation.
- If incomplete after two hours, send one reminder.
- If incomplete after 24 hours, send a final reminder.
- Do not continue after cancellation, suppression, or a newer checkout replaces the session.
- Never imply that payment succeeded.

Subject: `Finish setting up your One Time membership`

### WNC-6.6 `OT-04` Payment Active / Access Recovery

Trigger: verified billing integration projects `active`.

- Send once per activation episode.
- Confirm $67/month for standard Family plan or display the approved custom School terms.
- Confirm next billing date from provider readback.
- Restore product access idempotently.

Subject: `Your One Time membership is active`

### WNC-6.7 `OT-05` Payment Failed / Grace

| Event | Timing | Subject |
|---|---:|---|
| Grace starts | Immediate | `Action needed: update your One Time payment` |
| Still unresolved | Grace day 3 | `Your One Time payment still needs attention` |
| Final reminder | Grace day 6 | `One day remains in your One Time grace period` |
| Grace expires | At verified expiry | `Student access is paused` |
| Payment recovers | Immediate | `Your One Time access is restored` |

Each failure message links to the provider-hosted billing repair surface. It contains no card data. Parent restricted login remains available after expiry.

### WNC-6.8 `OT-06` Subscription Canceled / Ending

Trigger: verified `cancel_at_period_end`.

- Immediate confirmation states the exact final access date.
- A reminder is sent 24 hours before paid access ends.
- Reactivation cancels the ending sequence.
- No language promises a refund.

Subject: `Your One Time membership will end on {{access.ends_on}}`

### WNC-6.9 `OT-07` Parent Portal Invitation Companion

Trigger: Admin creates/invites a Parent or an approved school account manager.

The security link remains in the Resend message. This GHL companion explains what the Parent can do and never duplicates the token.

Subject: `Your One Time Parent account`

### WNC-6.10 `OT-08` Parent Portal Activated

Trigger: first completed Parent setup.

Subject: `Add your Student accounts`

Body:

> Hi {{contact.first_name}},
>
> Your Parent account is active.
>
> Add up to three Student accounts. Each Student gets a separate username and password for the live class and recording library. If you also want to learn, you may use one of those three Student seats with separate Student credentials.
>
> All active Students are automatically added to the daily 7:00 p.m. Jerusalem-time class.
>
> **Open Parent Dashboard**

### WNC-6.11 `OT-09` Class Reminder and Schedule Change

Default reminder: one Parent message 30 minutes before the occurrence and one Student in-app notice.

Email subject: `One Time class begins in 30 minutes`

Email body:

> Hi {{contact.first_name}},
>
> Rabbi Eli’s One Time Mishnayos class begins in 30 minutes at {{occurrence.parent_local_time}}.
>
> Students joining today: {{household.active_student_names}}.
>
> Each Student should sign in to the Student Portal on their own device and select **Join Class**.
>
> **Open One Time**

Schedule changes and cancellation send immediately. The protected Parent link opens the Parent schedule and never authenticates a Student or contains a Zoom URL.

### WNC-6.12 `OT-10` Recording Available

Trigger: content becomes `published` after Admin approval and provider readback.

Subject: `A new One Time recording is ready`

The Parent message lists the eligible Students and tells them to use their Student login. Student in-app notification deep-links to the protected library item.

### WNC-6.13 `OT-12` Adult Support Intake

Only adult Parent/public support creates or continues a GHL conversation. One Time stores the ticket and safe GHL reference. Student support stays inside One Time.

Adult acknowledgment subject: `We received your One Time support request`

### WNC-6.14 `OT-13` Refund / Chargeback

Refund messages state the verified amount and provider status. Chargeback/dispute messages do not threaten or speculate; they explain current access and give the billing contact.

No workflow independently changes access. Access changes only from the signed billing projection.

### WNC-6.15 `OT-14` Parent Newsletter

- Audience: current account owners with newsletter permission.
- Cadence: weekly, default Thursday at 12:00 household local time.
- Sender: `rabbi_campaign`.
- Required sections: brief Rabbi note, class recap, upcoming schedule, new recording/review, approved question highlight, one CTA.
- No private Student question, full child name, billing detail, or cross-household information.
- Draft and execution occur in GHL.
- One bounded operator-only provider canary through the release-verification harness and explicit Rabbi/Admin approval precede the first broad send; no canary/test action appears in ordinary product navigation.

Default subject: `This week in One Time Mishnayos`

### WNC-6.16 `OT-15` Former Member Reactivation

Audience: former/canceled adults with current marketing permission who are not active Parents.

| Step | Timing | Subject |
|---|---:|---|
| 1 | Approval launch | `See what is new in One Time Mishnayos` |
| 2 | Day 4 | `A separate Student portal for live class and recordings` |
| 3 | Day 9 | `Come back free until September 11` |

Exit on signup, suppression, active membership, school classification, or completion.

### WNC-6.17 `OT-16` Free-Period Conversion

Relative to `2026-09-11T18:00:00+03:00`, or the replacement canonical configuration:

- 14 days before.
- 7 days before.
- 3 days before.
- 1 day before.
- At expiry.

All messages state:

- $67/month standard Family price.
- No card is currently on file unless the Parent voluntarily completed Checkout.
- No automatic charge occurs without completed Checkout.
- Exact access-effective date.
- Billing CTA.

Exit on verified active paid access, explicit cancellation/decline, suppression where legally permitted, or custom School billing terms.

### WNC-6.18 `OT-B01` Website Lead-Capture Bot

The bot:

- operates only on the public One Time funnel;
- identifies itself as the One Time website assistant;
- answers only from approved One Time public knowledge;
- never pretends to be Rabbi Eli or Shloimie;
- collects name, email, `family|school`, timezone, and optional phone;
- offers family signup or records a school inquiry;
- does not qualify leads through WhatsApp;
- does not create Students;
- does not promise school pricing;
- does not grant access;
- escalates uncertain answers to the adult support channel;
- stores the transcript in the adult GHL conversation subject to retention policy.

## WNC-7. Dormant WhatsApp templates

WhatsApp is configuration-gated. These templates may exist in GHL but remain non-executable until provider, sender, templates, consent, webhook, opt-out handling, and a production canary are approved.

| Template ID | Purpose | Exact short copy |
|---|---|---|
| `WA-OT-CLASS-30` | Class reminder | `One Time reminder: Rabbi Eli’s class begins in 30 minutes at {{1}}. Students should sign in on their own devices: {{2}}` |
| `WA-OT-CLASS-CHANGE` | Schedule change | `One Time schedule update: {{1}}. View the current schedule here: {{2}}` |
| `WA-OT-RECORDING` | Recording available | `A new One Time recording is ready. Students can open it from the Student Library: {{1}}` |
| `WA-OT-PAYMENT-GRACE` | Billing service notice | `Your One Time payment needs attention. Student access remains available until {{1}}. Update billing securely: {{2}}` |

Disabled WhatsApp actions resolve as `channel_skipped_not_configured`; they do not fail, delay, or duplicate email.

## WNC-8. In-app notifications

Each in-app notification stores stable ID, recipient and scope, category, source entity/version, exact rendered title/body, safe internal action, created/read/expired/archived timestamps, and dedupe key.

### WNC-8.1 Student notification catalog

| Category | Title/body pattern | Action | Active lifetime |
|---|---|---|---|
| `class_reminder` | **Class begins in 30 minutes** / `Rabbi Eli’s class begins at {{student_local_time}}.` | **Open class** → own occurrence detail | Until occurrence close |
| `class_changed` | **Class schedule updated** / `Your class is now {{student_local_time}}. {{admin_message}}` | **Open schedule** | Until occurrence close |
| `class_canceled` | **Class canceled** / `The class scheduled for {{student_local_time}} was canceled. {{admin_message}}` | **Open schedule** | Until occurrence close |
| `recording_available` | **New recording available** / `{{content_title}} is ready in your library.` | **Watch recording** | Until content is unpublished or archived |
| `question_updated` | **Your question was updated** / `Status: {{student_safe_status}}.` | **Open question** | Until 90 days after terminal resolution |
| `support_updated` | **Support request updated** / `Your request has a new status or reply.` | **Open support request** | Until 90 days after terminal resolution |
| `badge_awarded` | **You earned {{badge_name}}** / `Open Progress to see what you achieved.` | **View progress** | 30 days |
| `announcement` | `{{approved_title}}` / `{{approved_short_body}}` | Optional approved internal route | Configured expiry, never more than 90 days |

`student_safe_status` uses only the canonical Student-visible lifecycle label. Private answer text never appears in a notification body or lock-screen-like browser surface.

### WNC-8.2 Parent notification catalog

Parents may receive household/Student-management, attendance-summary, access/billing, newsletter-archive, and support notices. Every Parent notification deep-links only to a Parent-authorized route. A Parent notice may name the owned Student when operationally required, but never includes private question/support bodies, a recording playback URL, Student credentials, or provider secrets.

### WNC-8.3 State, dedupe, action, and sound

- The dedupe key is exactly `event_type + source_entity_id + recipient_student_or_parent_id + source_version`. Retrying the same source version returns the existing notification and never increments unread count twice.
- A later source version creates or updates the category-defined current notice and marks a superseded action stale; cancellation supersedes the corresponding reminder.
- Active notices appear under **Unread** or **Read** and **All**. **Mark all as read** marks every currently visible active notice and is idempotent.
- At active-lifetime expiry, the notice remains under **All** for 30 additional days with its action disabled and the label **No longer available**. It then becomes archived and disappears from the normal center.
- If authorization changes before expiry, the action is disabled immediately; opening a stale deep link reauthorizes and shows a neutral unavailable state.
- Audible cue is off by default, is a per-Student preference, may play only for a newly created unread notification while the authenticated portal is in the foreground and browser interaction permits audio, and always has a simultaneous visual equivalent.
- There is no background push, PWA notification, email to a Student, or attempt to play sound before user interaction.

## WNC-9. Campaign approval and stop conditions

A broad campaign cannot start unless:

1. Audience count and sample are read back.
2. Suppressed count is read back.
3. Sender/reply-to are correct.
4. Every message renders with real seed data.
5. All links resolve to the correct production origin.
6. Exact content and audience digests are approved.
7. One operator-owned seed receives the message.
8. Unexpected effects equal zero.

Automatically pause a marketing campaign on:

- hard-bounce rate greater than 2%;
- complaint rate at or above 0.1%;
- provider rejection or authentication failure;
- audience count exceeding the approved budget;
- content/audience digest drift;
- wrong sender/reply-to;
- any Student contact;
- any charge, enrollment, deletion, or unrelated workflow effect.

## WNC-10. Communication evidence

Acceptance evidence includes:

- GHL save/reopen readback.
- Exact provider IDs and registry digest.
- Segment query and bounded count.
- Suppression-at-send-time proof.
- Rendered seed message.
- delivery/bounce/complaint outcome.
- link destination verification.
- no Student GHL contact.
- no disabled WhatsApp send.
- pause and safe-resume proof.
- one-per-household and dedupe proof.
