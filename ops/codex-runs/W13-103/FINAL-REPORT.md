# W13-103 Final Report

Terminal status: `PRODUCTION_ROLE_ACCESS_READY`.

Public login URL: `https://join.onetimeonetime.com/login`

Private handoff path:
`C:\Users\User\.onetime-w13-103-private\LOGIN-HANDOFF.private.json`

Outcome: production administrator, parent, and student access is usable through
the protected local handoff. Resend remained unavailable/disabled, so no email
was sent and no Rabbi contact occurred.

Runtime: production stayed on healthy web deployment
`9334b362-f00d-4170-9713-ecee0d22b85c`, source
`007e0215d1186ca51163dea3b1c15303bf52a860`. `/version` and `/health` passed.

Backup/restore: fresh production PG18 proof passed on deployment
`7bfb281b-9166-421b-9410-9bf6b5280f36` with dump SHA-256
`0c839090ca962711fc3aac0878ecae9741a510ed19d771e61e8f8280610cc189`.

Production role/access mutation counts:

- Users created: 3
- Households created: 1
- Learners created: 1
- Student access records created: 1
- Lifecycle tokens issued: 7
- Lifecycle tokens consumed by browser acceptance: 3
- Lifecycle tokens superseded/revoked: 1
- Lifecycle outbox rows created: 7
- Auth email challenges created: 1
- Auth email challenge outbox rows created: 1
- Final-reset sessions revoked: 1
- Active sessions after final reset: 0
- Provider sends, CRM imports, live charges, billing mutations, third-party
  contacts, and Rabbi contacts: 0

Acceptance:

- Administrator: browser login via protected email-challenge link passed; CRM
  contacts API returned 200; parent and student routes returned 403.
- Parent: browser activation/login passed; one household, one learner, and one
  student-access state visible; CRM API returned 403.
- Student: browser activation/login passed; dashboard returned 200; CRM and
  parent APIs returned 403.
- Parent controls: suspend, restore, and reset all returned 200; reset ended in
  `reset_requested`; suspend invalidated the active student browser session.
- Mobile 360x800, mobile 390x844, tablet 768x1024, and desktop 1440x1000
  viewports were nonblank for role surfaces.

Task deployments:

- Initial apply: `c9eaf917-a635-42cf-b865-67477a0efb6a`
- Admin login challenge extract: `d1ffa912-af84-49b4-8b22-eee62b9b2578`
- Student apply: `d6516cfe-971a-4d2d-9fb0-69c8403e4fc4`
- Final reset: `503041cb-abf3-46b6-bc41-4e23399fc60a`

Validation:

- `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/w13-103-production-role-access.test.ts`
- `npm run typecheck`
- `npm run secret:scan`
- Production browser acceptance helper
- Production `/version` and `/health` smoke
- One-off task service targeted variable cleanup: 32 deleted, 0 lingering

Committed evidence:

- `ops/codex-runs/W13-103/evidence/backup-restore-summary.json`
- `ops/codex-runs/W13-103/evidence/runtime-health.json`
- `ops/codex-runs/W13-103/evidence/role-browser-acceptance.json`
- `ops/codex-runs/W13-103/evidence/final-reset-task.json`
- `ops/codex-runs/W13-103/evidence/production-role-access-counts.json`
- `ops/codex-runs/W13-103/evidence/task-service-cleanup.json`

This report intentionally contains no emails, usernames, setup/reset URLs,
tokens, passwords, private identifiers, database URLs, or secrets.
