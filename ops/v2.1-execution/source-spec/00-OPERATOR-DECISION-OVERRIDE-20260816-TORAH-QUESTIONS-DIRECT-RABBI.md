# One Time Operator Decision Override — Torah Questions Route Directly to Rabbi

**Decision ID:** `OT-CTRL-20260816-TORAH-QUESTIONS-DIRECT-RABBI`  
**Decision date:** 2026-08-16  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED OPERATOR REPLACEMENT — SOURCE OF TRUTH**  
**Integration authority:** PR #131 only

## Decision

There is **no HighLevel opportunity pipeline for Torah questions**.

The operator deleted the empty `One Time Torah Questions` pipeline from the One Time HighLevel location. It must not be recreated, migrated, or replaced by another CRM pipeline.

All Torah questions are first-party One Time product records and route directly to Rabbi Eli Scheller inside the One Time application.

## Product flow

```text
Authenticated Student or Parent submits Torah question
→ One Time validates account, role, household, class, and content scope
→ durable private question is created in One Time
→ question appears directly in Rabbi Eli's Admin question queue
→ Rabbi Eli answers from the One Time Admin panel or governed Rabbi Telegram projection
→ answer is stored in One Time
→ submitting Student or Parent receives the scoped answer/notification
```

There is no Shloimie-review stage, assignment pipeline, Rabbi-review pipeline, or GHL opportunity stage between submission and Rabbi visibility.

## CRM boundary

HighLevel owns adult leads, adult marketing, adult conversations, and household lifecycle communication.

HighLevel does **not** own:

- Student Torah questions;
- Parent Torah questions submitted through the product;
- Rabbi answers;
- question moderation state;
- question publication state;
- Student question notifications;
- question assignments or a Torah-question opportunity.

Never create a Student HighLevel contact or a HighLevel opportunity because a Student asked a question.

A Parent may separately reply to a Rabbi email in HighLevel Conversations, but that adult email thread is not the authoritative Torah-question record. Product Torah questions and answers remain in One Time.

## Application state

The application may retain the minimum internal lifecycle required for privacy, answer delivery, publication, audit, and idempotency, such as:

- submitted/unanswered;
- answered privately;
- explicitly approved/published to a class or Family;
- closed/declined.

Those are application record states, not a visible CRM pipeline and not a multi-person assignment process.

The default behavior is direct Rabbi review. The Admin UI should not imply that Shloimie must triage each Torah question first.

## Rabbi Admin experience

Rabbi Eli must be able to:

1. Open a direct unanswered-question queue in the One Time Admin panel.
2. See the exact submitting role: Student or Parent.
3. See only the account, household, Student, class, and content context authorized for the question.
4. Answer privately.
5. Explicitly approve a safe question/answer for Family or class visibility when authorized.
6. Close or decline with an audited reason when needed.
7. Read question history and answer-delivery state.
8. Use the governed Rabbi Telegram bot as a projection of the same One Time question queue, without creating a second source of truth.

The current Admin label `Question moderation` / `Questions requiring Rabbi or Admin review` must be audited against this decision. The primary user-facing concept should be Rabbi Eli's Torah Questions queue, not a generic CRM-style moderation pipeline.

## Privacy

- Questions are private by default.
- A Parent does not automatically see a Student's private question or answer.
- Family/class visibility requires an explicit safe publication/share action.
- One household never sees another household's private question.
- Telegram and Admin views must not expose raw credentials, provider links, or unrelated child data.
- The application audit trail remains durable and idempotent.

## GHL cleanup and drift prevention

Codex and the GHL operator must verify:

1. `One Time Torah Questions` no longer exists in the live GHL location.
2. It had zero opportunities at the last audit; no record migration is expected.
3. No workflow, form, tag, webhook, custom field, dashboard, report, automation, or source registry still references its former pipeline/stage IDs.
4. No future desired-state registry recreates it.
5. Any historical documentation that lists it is marked superseded/historical rather than treated as current desired state.

Former live pipeline ID:

`wabcK1pPBuqj1T4cjpI7`

Former stage IDs:

- `003652bd-73a8-4b8d-9f35-f4c37854fec8`
- `58f3ebc9-c3b8-45cd-a54a-f855722b8d30`
- `9518925f-656f-4d2b-a559-32b42ac8be71`
- `e526a96d-0e87-4835-8be3-e885fe5e9c67`
- `d68b0149-4017-4483-b823-e0de121e3b8b`
- `ec263678-3b92-4b00-9de8-0b68608f9de3`
- `75989802-095c-45ed-9271-4ba6c53cb96b`

These IDs are deletion/drift-audit references only. They must not be reused.

## Current implementation facts to audit

The current application already contains first-party learning-question contracts and an Admin question workspace with private-answer, class-approval/publication, close, and decline actions. Codex must preserve the useful privacy/audit mechanics while aligning routing, labels, permissions, and ownership to this direct-Rabbi decision.

At minimum inspect:

- `packages/contracts/src/learning/index.ts`
- `apps/web/src/client/app/admin/learning/AdminLearningWorkspace.tsx`
- Student/Parent question submission routes and services
- Admin question read/transition APIs
- question notifications and answer delivery
- Rabbi Telegram question projection
- HighLevel registry and workflow references

## Acceptance

Before production acceptance, prove:

1. An authenticated Student submits one question.
2. The question appears directly in Rabbi Eli's Admin queue without Shloimie triage.
3. An authenticated Parent submits one Parent-labeled question and it appears in the same Rabbi-owned application queue with correct role labeling.
4. Rabbi Eli answers from the Admin panel.
5. The correct submitter sees the private answer.
6. Another household cannot read the question or answer.
7. A private Student question is not exposed to the Parent unless explicitly shared/published.
8. An explicit safe publication action works separately from private answering.
9. The Rabbi Telegram projection reads/answers the same authoritative One Time record when that capability is enabled.
10. No GHL contact, opportunity, pipeline record, or workflow enrollment is created for either question.
11. The deleted GHL pipeline and former stage IDs have zero current dependencies.

## Integration boundary

This document records the operator decision. PR #183 must not implement product code or deploy it. The PR #131 controller must ingest this override, assign the bounded application/GHL-drift work to the existing question/Telegram owner where possible, and integrate only through PR #131 with privacy, authorization, audit, browser, and rollback proof.
