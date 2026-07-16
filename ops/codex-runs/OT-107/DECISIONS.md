# OT-107 Decisions

## DEC-OT107-001 - Live Provider Canary

Status: Blocked unless protected live AI credentials and explicit canary
approval are available.

Decision: implement the provider-facing helper through a narrow port with a
deterministic sink for tests. Do not run a live AI canary from this task unless
the protected configuration and exact approval path are present.

## DEC-OT107-002 - Retrieval Store

Status: Accepted.

Decision: reuse the repository-native approved-content/session/entitlement
model if it exists. Add only the smallest forward-only migration needed for
governed private-question/status storage or approved-content retrieval gaps.

Result: no new migration was required. The implementation reuses:

- `onetime.portal_student_questions` for governed private questions and status.
- `onetime.ot86_*` published content and retrieval audit tables for bounded
  approved-material retrieval.
- `onetime.content_items` plus `onetime.content_item_entitlements` for
  server-side entitlement narrowing.

## DEC-OT107-003 - Helper Answer Provider

Status: Accepted.

Decision: ship OT-107 with a deterministic provider port that answers only from
the OT86 retrieval response. Future AI provider integration must use the same
port, re-authorize citations against the retrieval set, enforce the same
abstentions, and keep raw prompts/answers out of durable audit storage.
