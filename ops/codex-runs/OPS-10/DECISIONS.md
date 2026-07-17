# OPS-10 Decisions

Generated: 2026-07-17T08:50:00+03:00

## DEC-OPS10-001 - Release Branch And Base

Decision: Use a fresh external worktree on
`release/ops10-full-staged-production-launch-20260717T050800Z`, initially based
on `origin/integration/ops08-overnight-final-20260716T230543Z`.

Evidence: OPS-10 scaffold commit `04f0a6d2e974c8ac6e8feabd700becad7e4c2099`;
current candidate head `a058455705a91308ff2311aa1809540c83163abd` before the
migration renumber follow-up.

## DEC-OPS10-002 - OT-107 Student Helper

Decision: Treat OT-107 as semantically satisfied by the candidate instead of
applying stale branch-tail test/report changes.

Evidence: Candidate already contains the student helper module, run folder, and
newer portal/migration assertions. Focused unit and portal e2e gates passed.

## DEC-OPS10-003 - OT-114 CRM Communications

Decision: Merge OT-114 into the OPS-10 candidate and resolve the only source
conflict in `apps/web/src/server/app.ts` by preserving both email step-up login
helpers and CRM/support reply helpers.

Evidence: OT-114 unit, integration, browser e2e, accessibility/performance,
build, brand, typecheck, lint, and targeted formatting passed locally.

## DEC-OPS10-004 - Migration Namespace

Decision: Preserve OPS-03B at `2010_ops03b_email_step_up_login` and rename the
OT-114 branch-local migration to `2016_ot114_crm_communications_support`.

Evidence: `tests/integration/telegram-db-foundation.test.ts` now asserts the
renumbered migration. Focused migration/auth CRM integration tests passed after
the rename.

## DEC-OPS10-005 - Production Database Promotion Policy

Decision: Do not promote production until production backup/restore proof and a
PostgreSQL 16-compatible path are proven. The current production web service is
bound to `Postgres-j9Pi`, whose Railway image is Postgres 18, by redacted
`DATABASE_URL` hash comparison.

Evidence: `INPUTS.json` Railway inventory and `LOCAL-GATES.md` Railway readback.
No raw database URL or credential was stored.

## DEC-OPS10-006 - Provider Canaries

Decision: Keep optional providers disabled or provider-off unless protected
configuration, allowlisted destinations, and bounded canary authority are
available. Do not block core login, CRM, Content, and portals on optional
provider canaries.

Evidence: OPS-10 authorization boundary and provider-canary matrix.
