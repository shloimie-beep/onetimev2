# P29 — Core GHL Lifecycle Workflows OT-01–OT-10 and OT-13 — Locked Context

**Outcome:** Implement the core adult/household lifecycle workflow definitions, triggers, guards, idempotency, suppression, and evidence for OT-01 through OT-10 and OT-13.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `GHL_CORE_WORKFLOWS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `P28, P31`
- Full merge after: `P28, P31`
- Candidate integration partners (non-ordering): `P25, P26`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/worker/src/runners/ghl-workflows/core/**`
- `integrations/highlevel/v21/workflow-fragments/P29-core-lifecycle.yaml`
- `packages/domain/src/communications/workflows/core/**`

Scope notes below explain intent but do not grant additional path authority:

- core lifecycle workflow tests and readback fixtures
- steward request for canonical GHL registry registration

## Deliverables

- OT-01 through OT-10 and OT-13 declarative workflow fragments
- trigger/guard/suppression/idempotency rules
- email-required and WhatsApp-optional channel behavior
- provider readback and drift-detection contract

## Relevant locked decisions (2)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-090 | LOCKED | HighLevel owns adult CRM, campaigns, email workflows, the website lead-capture bot, conversations, consent/suppression projection, and the operator-facing Stripe workflow. |
| DEC-110 | LOCKED | The canonical Parent class reminder is scheduled 30 minutes before start. Email and eventual WhatsApp service reminders go to the single household account owner, not to Students. |

## Acceptance requirements and exact cases (12 requirements)


### OTV2-GHL-123

OT-01 is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-123-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-01 is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-124

OT-02A active migration is configured and ready to launch after copy approval.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-124-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-02A active migration is configured and ready to launch after copy approval.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-125

OT-02B nurture is configured and paused until Admin start.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-125-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-02B nurture is configured and paused until Admin start.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-126

OT-03 checkout abandonment is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-126-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-03 checkout abandonment is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-127

OT-04 payment active is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-127-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-04 payment active is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-128

OT-05 failed payment/grace is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-128-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-05 failed payment/grace is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-129

OT-06 cancellation is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-129-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-06 cancellation is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-130

OT-07 Parent portal companion is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-130-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-07 Parent portal companion is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-131

OT-08 Parent activation is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-131-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-08 Parent activation is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-132

OT-09 class reminders are configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-132-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-09 class reminders are configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-133

OT-10 recording notices are configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-133-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-10 recording notices are configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

### OTV2-GHL-136

OT-13 refund/chargeback is configured and tested.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-136-AC01
  kind: positive
  environment:
  - provider_sandbox
  - production_operator_canary
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - exact registry, sender, audience, consent, and content digests are approved
  steps:
  - save and reopen the workflow
  - read back trigger/actions/waits/exits
  - execute one operator seed
  - change suppression after approval and verify send-time blocking
  - verify effect counters
  expected_results:
  - OT-13 refund/chargeback is configured and tested.
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop immediately on an unauthorized, over-budget, wrong-provider, or acceptance-unknown external
    effect
```

## Embedded normative source sections

These exact source-package sections are embedded so this task does not need to rediscover its workflow/journey/certification contract.

### WNC-6 exact workflow definitions

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
> Your family has free access until September 13, 2026 at 7:24 p.m. Jerusalem time. There is no card required and no automatic charge.
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
> If you sign up before September 13, 2026 at 7:24 p.m. Jerusalem time, access is free until that time. No card is required and you will not be charged automatically.
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
| 3 | Day 9 | `Come back free until September 13` |

Exit on signup, suppression, active membership, school classification, or completion.

### WNC-6.17 `OT-16` Free-Period Conversion

Relative to `2026-09-13T19:24:00+03:00`, or the replacement canonical configuration:

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

## Cross-cutting invariants

- Exact assignable roles are `admin`, `parent`, and `student`.
- Students have username/password credentials and no required email; no Student is a GHL contact.
- A Parent never becomes a learner session; an adult learner uses a separate Student seat.
- One adult identity may own multiple independently billed households; authorization remains household-scoped.
- No preview/demo/test product lane, fictional customer, Class Helper, Buffer/social publisher, public WhatsApp assistant, or active Tisha funnel route.
- GHL is adult CRM/campaign/operator billing workflow; Stripe is financial truth; One Time stores a minimum verified access projection and never mutates financial objects.
- Email must complete launch workflows even while WhatsApp is dormant.
- Zoom and Vimeo bearers/URLs never appear in UI URLs, email, GHL, logs, handoffs, or evidence.
- Production evidence must bind one immutable candidate; each case uses only an environment allowed by its acceptance contract and records exact environment/runtime/deployment/provider identity. The 265 cases are not required to share one environment.
- Automated production-safety verification is required even though demo/test product surfaces are prohibited.
