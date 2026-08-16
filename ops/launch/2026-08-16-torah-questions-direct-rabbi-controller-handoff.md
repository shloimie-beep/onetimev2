# One Time — Direct Rabbi Torah-Question Controller Handoff

**Date:** 2026-08-16  
**Status:** Current operator handoff  
**Product integration authority:** PR #131 only  
**Decision source:** PR #183

## Required reading

Read this file from PR #183 / branch `chatgpt/one-checkbox-and-launch-marketing-v2-20260813`:

`ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260816-TORAH-QUESTIONS-DIRECT-RABBI.md`

## Required outcome

- Do not recreate the deleted GHL `One Time Torah Questions` pipeline.
- All Student and Parent Torah questions are authoritative One Time application records.
- Questions route directly to Rabbi Eli Scheller's Admin question queue.
- No Shloimie-review/assignment pipeline is required before Rabbi visibility.
- Rabbi answers from the app Admin panel and, when enabled, from the governed Telegram projection of the same record.
- No Student contact or question opportunity is created in GHL.

## Important interpretation

`No pipeline/stages` means no GHL opportunity pipeline and no multi-person CRM assignment process.

The application may preserve the minimal internal state needed to distinguish unanswered, privately answered, explicitly published/shared, and closed/declined records. Preserve privacy, audit, idempotency, and safe publication mechanics.

## Existing code to reconcile

The current Admin application already renders a `Question moderation` workspace with a table captioned `Questions requiring Rabbi or Admin review` and actions for private answer, class approval/publication, close, and decline.

Audit and align:

- direct Rabbi ownership and queue labels;
- Student and Parent submission routes;
- private answer delivery;
- Parent/Student visibility;
- safe Family/class publication;
- Telegram projection;
- GHL drift/dependency removal.

Known starting files:

- `packages/contracts/src/learning/index.ts`
- `apps/web/src/client/app/admin/learning/AdminLearningWorkspace.tsx`
- `apps/web/src/client/app/portal-entry.tsx`
- Admin learning/question APIs and repositories
- Telegram Rabbi communications/operations code
- `integrations/highlevel/registry/workflow-registry.yaml`

## GHL deletion/drift audit

The operator deleted the empty pipeline:

- name: `One Time Torah Questions`
- former pipeline ID: `wabcK1pPBuqj1T4cjpI7`

Verify zero current references to the former pipeline and stage IDs in live GHL, registry desired state, workflow definitions, dashboards, reports, forms, webhooks, and code. Do not reuse the IDs.

## Acceptance

Prove an operator-owned Student question and Parent-labeled question each appear directly for Rabbi Eli, can be answered in the app, remain private to the correct account/household, and create zero GHL contacts/opportunities/workflow enrollments.

## Controller action

Before opening a new worker:

1. inspect current PR #131 workers;
2. identify the existing question/Admin-learning or Rabbi Telegram owner;
3. append this decision to that worker when scope overlaps;
4. otherwise create one bounded current-head worker;
5. return ownership, exact delta, tests, and blockers before implementation.
