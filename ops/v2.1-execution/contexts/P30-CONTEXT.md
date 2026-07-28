# P30 — Newsletter, Reactivation, and OT-16 Conversion — Locked Context

**Outcome:** Implement Parent newsletter, former-member reactivation, and OT-16 conversion definitions with exact audience, suppression, approval, and School exclusion.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `GHL_CAMPAIGNS`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `P28, P31`
- Full merge after: `P28, P31`
- Candidate integration partners (non-ordering): `P09, P25, P26, P29`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/worker/src/runners/ghl-workflows/campaigns/**`
- `integrations/highlevel/v21/workflow-fragments/P30-campaigns.yaml`
- `packages/domain/src/communications/workflows/campaigns/**`

Scope notes below explain intent but do not grant additional path authority:

- newsletter/reactivation/conversion tests and readback fixtures
- steward request for canonical GHL registry registration

## Deliverables

- newsletter workflow
- former-member reactivation workflow
- OT-16 conversion workflow
- approval/suppression/audience and no-School-nurture controls

## Relevant locked decisions (1)

| Decision | Status | Exact decision |
|---|---|---|
| DEC-100 | LOCKED | Existing OT-11/OT-12 workflow identifier collisions must be reconciled through a registry migration; identifiers may never be silently reused for different purposes. |

## Acceptance requirements and exact cases (3 requirements)


### OTV2-GHL-134

OT-14 Parent Newsletter is configured, seed-tested, and held for first broad-send approval.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-134-AC01
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
  - OT-14 Parent Newsletter is configured, seed-tested, and held for first broad-send approval.
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

### OTV2-GHL-135

OT-15 Former Member Reactivation is configured and ready after exact copy and segment approval.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119`
- Source references: `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md, 09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-135-AC01
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
  - OT-15 Former Member Reactivation is configured and ready after exact copy and segment approval.
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

### OTV2-GHL-225

OT-16 Free-Period Conversion is configured with 14-day, 7-day, 3-day, 1-day, and expiry notices, exact price/date/no-auto-charge copy, send-time suppression, and exit on verified paid access or custom School terms.

- Area: `GHL`
- Priority: `launch_blocker`
- Release gate: `true`
- Owner domain: `communications`
- Semantic acceptance dependencies: `OTV2-FOUNDATION-001, OTV2-GHL-119, OTV2-BILLING-101, OTV2-BILLING-104, OTV2-BILLING-224, OTV2-GHL-137, OTV2-SCHOOL-200`
- Source references: `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`

Exact acceptance case data:

```yaml
- case_id: OTV2-GHL-225-SCHEDULE
  kind: time_boundary
  environment:
  - provider_sandbox
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - the saved and reopened OT-16 registry matches the approved workflow and content digests
  - an eligible free Family contact has exact $67 USD price and 2026-09-13 19:24 Asia/Jerusalem expiry fields
  - the email sender is accepted, WhatsApp sending is dormant, and provider event counters start at zero
  steps:
  - run the eligible seed at exactly 14 days before expiry and read back the delivered message and next wait
  - repeat with isolated eligible seeds at exactly 7 days, 3 days, 1 day, and expiry
  - at every checkpoint read back audience, sender, recipient, content digest, price, expiry date/time, CTA, and
    effect count
  - re-evaluate each checkpoint once to prove dedupe and confirm every dormant WhatsApp action is safely skipped
  expected_results:
  - exactly one approved email is delivered at each of the five checkpoints
  - every notice states the exact price, expiry date/time, and that no automatic charge occurs without Checkout
  - no duplicate email, WhatsApp message, Student contact, or unintended enrollment is created
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-GHL-225-PAID-EXIT
  kind: exit_condition
  environment:
  - provider_sandbox
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - the saved and reopened OT-16 registry matches the approved workflow and content digests
  - an eligible free Family contact has exact $67 USD price and 2026-09-13 19:24 Asia/Jerusalem expiry fields
  - the email sender is accepted, WhatsApp sending is dormant, and provider event counters start at zero
  steps:
  - deliver one eligible pre-expiry seed notice
  - apply a verified paid-access event and read back the active access projection
  - advance through every remaining OT-16 checkpoint
  - read back workflow membership, exit reason, and message-effect counters
  expected_results:
  - verified paid access exits OT-16 before every later notice
  - no later conversion email or WhatsApp attempt occurs
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-GHL-225-SCHOOL-EXIT
  kind: audience_boundary
  environment:
  - provider_sandbox
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - the saved and reopened OT-16 registry matches the approved workflow and content digests
  - an eligible free Family contact has exact $67 USD price and 2026-09-13 19:24 Asia/Jerusalem expiry fields
  - the email sender is accepted, WhatsApp sending is dormant, and provider event counters start at zero
  steps:
  - apply approved custom School terms to the operator-owned adult contact
  - attempt enrollment at each of the five OT-16 checkpoints
  - read back audience evaluation, exclusion/exit reason, and effect counters
  expected_results:
  - custom School terms exclude or exit the contact before any Family conversion notice
  - zero OT-16 email or WhatsApp effects occur for the School contact
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
- case_id: OTV2-GHL-225-SUPPRESSION
  kind: suppression_boundary
  environment:
  - provider_sandbox
  actors:
  - admin
  fixtures:
  - admin_shloimie
  - parent_operator_canary
  preconditions:
  - the saved and reopened OT-16 registry matches the approved workflow and content digests
  - an eligible free Family contact has exact $67 USD price and 2026-09-13 19:24 Asia/Jerusalem expiry fields
  - the email sender is accepted, WhatsApp sending is dormant, and provider event counters start at zero
  steps:
  - approve an otherwise eligible checkpoint
  - apply unsubscribe, DND, complaint, hard-bounce, or invalid-address suppression before execution
  - execute the checkpoint and read back the send-time gate, skip reason, and effect counters
  expected_results:
  - send-time suppression blocks delivery even when the contact was eligible at approval time
  - the workflow records a truthful skip reason and creates no email or WhatsApp effect
  forbidden_effects:
  - Student contact
  - wrong sender
  - broad unapproved enrollment
  - disabled WhatsApp send
  - audience/content drift
  evidence_profile: ghl_workflow
  cleanup: remove unintended seed enrollment and preserve approved delivery evidence
  stop_condition: stop on unauthorized, wrong-provider, over-budget, or acceptance-unknown effect
```

## Embedded normative source sections

These exact source-package sections are embedded so this task does not need to rediscover its workflow/journey/certification contract.

### WNC-6.15–6.17 exact newsletter/reactivation/conversion definitions

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
