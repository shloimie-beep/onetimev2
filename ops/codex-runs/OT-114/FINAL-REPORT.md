# OT-114 Final Report

Status: `ready_for_review`.

## Summary

Implemented the One Time CRM communications/support finish-line batch:

- CRM contact detail now surfaces custom tags, truthful system facts, relationships, enrollment/subscription summary, notes, support tickets, tasks, audit/activity, and communications timeline.
- Owner/admin CRM can create tags, assign/remove tags, add notes, archive contacts, and save provider-off single-recipient reply drafts.
- Communications local states now distinguish queued, provider accepted, delivered, failed, bounced, complained, suppressed, draft saved, and unknown without calling sink success delivery.
- Subscriber support now lives inside the authenticated shell with eligibility, list, create, receipt, duplicate, failure, mobile, and a11y handling.
- Signed support events include account/product scope, severity, redacted summary, idempotency hash, and operator triage while avoiding secrets, raw tokens, direct contact details, class links, provider secrets, and full household data.
- BNA consumer contract output is in `ops/codex-runs/OT-114/BNA-SUPPORT-EVENT-CONSUMER-CONTRACT.md`.

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run --config vitest.unit.config.ts tests/unit/communications/communications-contract.test.ts tests/unit/support/ot89a-contract.test.ts tests/unit/support/ot89a-config.test.ts tests/unit/support/ot89a-attachments.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/support/ot89a-subscriber-support.test.ts tests/integration/communications/api.test.ts tests/integration/auth-crm.test.ts`
- `npm run build`
- `npx playwright test tests/e2e/support.spec.ts tests/e2e/crm-core.spec.ts tests/e2e/ot-35/app-shell-crm.spec.ts tests/e2e/ot-44/communications-descriptor.spec.ts`
- `npx playwright test tests/accessibility/support-a11y.spec.ts tests/accessibility/ot-44/communications-accessibility.spec.ts tests/performance/ot-44/communications-performance.spec.ts`
- `npm run lint`
- `npm run secret:scan`
- `npm run brand:check`
- `npx prettier --check --ignore-unknown <OT-114 touched files>`
- `git diff --check`

Blocked:

- `npm run db:verify` failed because `DATABASE_URL` is not configured in this shell.
- Real BNA bridge canary remains blocked by BNA endpoint absence and this lane's no-BNA-edit rule.

## Guardrails

- No BNA source files were edited.
- No deploy was performed.
- No production database, provider send, broad send, DNS, charge, provider mutation, or live account mutation was performed.
- Reply confirmation creates `crm_reply_drafts` plus a sink `crm_single_recipient_reply_draft.v1` outbox event with `external_send_attempted: false`.
- Browser tests verify duplicate support submissions open the original receipt and network/file/server errors are accessible.
