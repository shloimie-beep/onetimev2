# HighLevel Workflow UI Checklist

Build these workflows in the HighLevel UI. Do not record a workflow ID in
`workflows.yaml` until the workflow is published and verified in the UI.

Common rules for every workflow:

- Location: the One Time HighLevel sub-account recorded in `workflows.yaml`.
- Version label: `one-time-hybrid-v1-2026-07-20`.
- Suppression: exit or skip marketing sends when `OT | Marketing Suppressed` is present or the relevant channel opt-in tag/field is absent.
- Student data: do not add student names, emails, usernames, passwords, progress, questions, or class attendance to HighLevel.
- One Time access: never unlock portal access from a HighLevel tag alone.
- Test contact: use the operator-owned test contact from the private credential files when provided.
- Outbound webhook: use the shared secret from `outbound-webhook-secret.txt`; send only minimized payloads matching `workflows.yaml`.

## OT-01 New Lead Intake

- Trigger: API enrollment after One Time public signup contact upsert succeeds.
- Filters: contact has `OT | Lead`; source tag is `OT | Signup Website` or `OT | Signup WhatsApp`.
- Required fields: One Time Parent ID, One Time Signup Source, One Time Customer Status.
- Tags: add `OT | Lead`, `OT | Prelaunch`; retain opt-in tags; never remove suppression tags.
- Messages/actions: send parent-facing acknowledgement or internal follow-up task as configured in GHL; no class link.
- Outbound webhook: none required for initial lead capture.
- Failure path: if enrollment fails, leave One Time local signup success intact and retry from HighLevel outbox.
- Expected ID field: `HIGHLEVEL_WORKFLOW_NEW_LEAD_ID`.

## OT-02 Prelaunch Nurture

- Trigger: tag added `OT | Prelaunch` or API enrollment from OT-01.
- Filters: before `2026-09-13T23:59:00+03:00`; email opt-in or WhatsApp opt-in present; not suppressed.
- Required fields: One Time Customer Status, One Time Signup Source.
- Tags: keep `OT | Prelaunch`; do not add `OT | Active`.
- Messages/actions: send prelaunch education and checkout-waitlist sequence; no card collection before launch.
- Outbound webhook: none.
- Failure path: stop sequence on suppression, cancellation, active payment, or manual review.
- Expected ID field: record in `workflows.yaml` when created.

## OT-03 Checkout Started / Abandoned

- Trigger: GHL checkout started event or manual pipeline move to Checkout Started.
- Filters: parent/lead contact only; not suppressed; no active payment event already processed.
- Required fields: One Time Parent ID, One Time Customer Status.
- Tags: add `OT | Checkout Started`; remove only stale checkout tags, not all tags.
- Messages/actions: send checkout reminder sequence only after paid-launch rules allow it.
- Outbound webhook: optional `checkout.started` style business event only after One Time endpoint is registered.
- Failure path: stop on payment active, cancellation, suppression, or manual review.
- Expected ID field: record in `workflows.yaml` when created.

## OT-04 Payment Active

- Trigger: GHL Stripe subscription active or payment succeeded condition.
- Filters: contact has One Time Parent ID or deterministic GHL contact link.
- Required fields: One Time Customer Status, One Time Access Status.
- Tags: add `OT | Active`; remove `OT | Grace`, `OT | Canceled`, `OT | Former` when appropriate.
- Messages/actions: parent-facing payment confirmation only; activation email remains One Time/Resend.
- Outbound webhook: `subscription.active` or `payment.succeeded` with provider event ID, contact ID, subscription ID, occurred_at, current_period_end.
- Failure path: if webhook fails, retry in GHL; One Time entitlement changes only after valid webhook/inbox processing.
- Expected ID field: `HIGHLEVEL_WORKFLOW_PAYMENT_ACTIVE_ID`.

## OT-05 Payment Failed / Seven-Day Grace

- Trigger: GHL Stripe payment failed condition.
- Filters: known One Time parent contact; not full refund or chargeback.
- Required fields: One Time Grace Until, One Time Access Status.
- Tags: add `OT | Grace`; keep `OT | Active` only if needed for current-period visibility; do not unlock access from tags.
- Messages/actions: parent-facing payment retry reminders for seven days.
- Outbound webhook: `payment.failed` with provider event ID, contact ID, subscription ID, occurred_at.
- Failure path: retry webhook; stop reminders on payment recovered, cancellation, chargeback, suppression, or manual review.
- Expected ID field: `HIGHLEVEL_WORKFLOW_PAYMENT_FAILED_ID`.

## OT-06 Subscription Canceled

- Trigger: GHL Stripe subscription canceled condition.
- Filters: known One Time parent contact.
- Required fields: One Time Customer Status, One Time Access Status, One Time Last Sync.
- Tags: add `OT | Canceled`; later add `OT | Former` after current period end.
- Messages/actions: cancellation confirmation; do not immediately revoke unless full refund or chargeback.
- Outbound webhook: `subscription.canceled` with provider event ID, contact ID, subscription ID, occurred_at, current_period_end.
- Failure path: retry webhook; escalate when current_period_end is missing.
- Expected ID field: `HIGHLEVEL_WORKFLOW_CANCELED_ID`.

## OT-07 Parent Portal Invitation

- Trigger: One Time emits portal invitation event to HighLevel outbox.
- Filters: parent contact only; active, grace, or complimentary local entitlement.
- Required fields: One Time Portal Status, One Time Access Status.
- Tags: add `OT | Portal Invited`.
- Messages/actions: business visibility reminder only. Security-critical activation email is sent by One Time through Resend.
- Outbound webhook: none.
- Failure path: do not send credentials or reset links through HighLevel.
- Expected ID field: record in `workflows.yaml` when created.

## OT-08 Parent Portal Activated

- Trigger: One Time emits portal activated event to HighLevel outbox.
- Filters: parent contact only.
- Required fields: One Time Portal Status, One Time Last Sync.
- Tags: add `OT | Portal Active`; retain `OT | Portal Invited`.
- Messages/actions: optional parent welcome/follow-up.
- Outbound webhook: none.
- Failure path: do not mutate One Time auth state from HighLevel.
- Expected ID field: record in `workflows.yaml` when created.

## OT-09 Class Reminder

- Trigger: One Time emits class reminder event to HighLevel outbox, or scheduled GHL workflow for parent reminders.
- Filters: parent contact only; relevant channel opt-in present; not suppressed; local access active, grace, or complimentary.
- Required fields: One Time Access Status, One Time Grace Until when in grace.
- Tags: use `OT | Email Opt-In` and `OT | WhatsApp Opt-In` for routing.
- Messages/actions: parent-facing 7:00 PM class reminder.
- Outbound webhook: none.
- Failure path: skip if suppressed or no valid opt-in; no student direct messaging.
- Expected ID field: record in `workflows.yaml` when created.

## OT-10 New Recording Available

- Trigger: One Time emits new recording available event to HighLevel outbox.
- Filters: parent contact only; local access active, grace, or complimentary; not suppressed.
- Required fields: One Time Access Status, One Time Last Sync.
- Tags: no special required tag beyond opt-in/suppression tags.
- Messages/actions: parent-facing portal notice only; do not expose raw Vimeo credentials or private recording links.
- Outbound webhook: none.
- Failure path: skip if suppressed or no valid opt-in.
- Expected ID field: record in `workflows.yaml` when created.
