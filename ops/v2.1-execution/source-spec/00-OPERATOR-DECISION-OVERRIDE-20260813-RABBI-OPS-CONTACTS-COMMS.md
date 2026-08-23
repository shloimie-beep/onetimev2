# One Time Operator Decision Override — Rabbi Operations, Contacts, and Communications

**Decision ID:** `OT-CTRL-20260813-RABBI-OPS-CONTACTS-COMMS`  
**Decision date:** 2026-08-13  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED OPERATOR REPLACEMENT — SOURCE OF TRUTH**

## Rabbi Telegram priority

The Rabbi's private One Time Telegram bot is an initial operational priority.

It must provide a bounded view of:

- private Student questions and Rabbi replies;
- Parent/adult conversations and reply handling;
- sanitized class/live readiness;
- support incidents, especially login/access problems;
- content/Vimeo processing status;
- internal tasks and agent-task status.

The merged Rabbi communications worker is the foundation. One Time remains source of truth.

## Structured support-agent handoff

The Telegram bot may create and track a typed, redacted support/agent task that a local One Time agent on the operator computer consumes.

The approved flow is:

```text
Rabbi reports or selects an issue in Telegram
→ bot creates a scoped support/agent task
→ local workstation agent performs bounded diagnosis
→ safe product action or code branch + tests + draft PR
→ result returns to the task and Telegram
→ PR #131 remains the only production integration/deployment authority
```

Telegram must preserve authorization, redaction, preview/confirm, idempotency, audit, and rollback. It never reveals credentials, private child data, secrets, or raw provider links. Login recovery remains in authenticated product flows; Telegram may report sanitized status, create/assign an incident, link to the authenticated Admin surface, and return the safe next action.

## Contacts boundary

HighLevel owns all adult leads and prospects, including people who have not completed a One Time account.

The One Time application owns actual app identities and product state:

- authorized adults with One Time accounts;
- Family households;
- Students;
- enrollments, access, attendance, questions, content entitlement, and app support state;
- minimum GHL linkage/projection required for reconciliation and workflows.

Do not mirror the complete GHL lead database into One Time as a second CRM. Anonymous visitors remain analytics/attribution only. Students never become GHL contacts.

## Email identities

Use distinct identities:

- operational/account/security: `info@onetimeonetime.com` or the exact approved office sender for the message class;
- Rabbi program/lifecycle: `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>` with Reply-To `rabbielischeller@onetimeonetime.com`.

The Rabbi address has already passed bounded GHL sender, DNS-authentication, inbox-delivery, and reply-round-trip proof. Remaining work is consistent production message routing.

## Launch email scope

The previous `OT-01 only` launch restriction is superseded.

Initial launch may use an adult-only, state-driven Family sequence:

1. account confirmation;
2. Student-setup reminder only when no Student exists;
3. first-learning activation only when a Student exists but has not joined/watched;
4. Rabbi vision/proof after access is clear;
5. progress/support based on actual use;
6. paid continuation only after checkout/billing authority is ready;
7. reactivation only when consent and suppression permit.

Every message rechecks current product, consent, suppression, activation, and paid state immediately before send. No blind generic drip. No Student GHL contacts.

## Parallel lane separation

PR #131 remains the sole integration/deployment authority.

- Zoom lane: protected classroom entry and live-state proof.
- Vimeo/content lane: local intake, processing, private Vimeo, Admin review, and protected playback.
- GHL lane: adult pipeline, attribution, lifecycle workflows, sender/reply routing, and bounded canaries.
- Telegram lane: Rabbi communications, support, and agent-task transport.
- Marketing-media lane: source inventory, clip cutting, Drive derivatives, Rabbi editing packs, and marketing registry only.

No bounded lane merges or deploys independently.

## Required reconciliation

Codex must update the canonical PR #131 decisions, acceptance cases, workflow copy, launch status, Telegram contracts, contact boundary, and focused tests so they agree with this override.

This supersedes conflicting statements that Telegram is outside the launch priority, that OT-01 is the only launch communication, or that the app should mirror all GHL leads.