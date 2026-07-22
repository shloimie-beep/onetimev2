# OT-LAUNCH-01 HighLevel Application Contracts

## Scope

- Base: `codex/full-app-staging-live` at `a09a38c4323c328ce038592fc328e323e22b2d45`
- GHL evidence: PR #107 at `deda8f9b04dbafcc36363628a14b6fecc94fd854`
- Location: `pBSnOK2nkdxp6gf9Rg3o`
- Provider mode: default-off
- External HighLevel calls: 0
- Messages sent: 0
- Student contacts created: 0
- Persistent staging changed: no

## Implemented Contracts

Outbound `1.0.0` adult-only events use the shared `onetime.outbox_events` table:

- `adult.signup.submitted`
- `parent.portal.invitation_requested`
- `parent.portal.activated`
- `class.reminder.requested`
- `recording.available`

Inbound `1.0.0` OT-A1 actions use authenticated, scoped, rate-limited, deduplicated POST requests to `/internal/highlevel/v1/actions`:

- `bot.complete_signup`
- `bot.next_confirmed_class_info`
- `bot.member_login`
- `bot.password_help`
- `bot.apply_opt_out`

Password help delegates token creation and delivery to One Time/Resend and returns no token. Opt-out applies One Time suppression before any later eligible event and authorizes no acknowledgement while the registry conflict remains unresolved.

## Provider Decision

Outbound projection uses HighLevel contact upsert followed by add-tags with canonical field IDs and tag names. It does not call or invent a direct workflow-run endpoint. Inbound actions use HighLevel's supported Custom Webhook action with protected static authentication headers, exact account/product/location scope, replay receipts, and fail-closed authorization.

Primary sources:

- https://marketplace.gohighlevel.com/docs/ghl/contacts/contacts/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/add-tags/index.html
- https://help.gohighlevel.com/support/solutions/articles/155000002482-workflow-trigger-contact-tag
- https://help.gohighlevel.com/support/solutions/articles/155000002673
- https://help.gohighlevel.com/support/solutions/articles/155000003305/

## Migration Decision

- Added `2216_highlevel_application_contracts.sql`.
- SHA-256: `d93ddefa8045b1a8021df3da678528b41e631c9c2ef65f93dbd8370fa03687f7`.
- `2216` extends the existing shared outbox channel constraint and adds only new inbound action receipts plus the cached channel-DND projection.
- Open-PR migration audit found `2214_learning_delivery_content_factory.sql` on PR #104, confirmed `2215` reserved for Experience Preview, and found no other `2216`.
- Canonical `2205_highlevel_business_projection.sql` was inspected from commit `c5f3d33432a57b72346496c44bcf652edc9d7db8`, Git blob `cf65084399fe8f84986f62451a34c9e606403107`, SHA-256 `3135ccd5942c649dd1133f1709806bdb77de016cfd3e78f55f04ec86cb7001fd`.
- `2205` was not restored because this accepted design requires none of its parent/entitlement projections and restoring its dedicated `highlevel_outbox_events` table would violate the no-parallel-queue boundary.
- Historical media migrations `2209` and `2210` were not replayed or modified.

## Concurrency And Replay

Real PostgreSQL uses one atomic CTE claim with exact account, product and `channel = 'highlevel'` predicates, `FOR UPDATE OF outbox SKIP LOCKED`, a 60-second processing lease, and lease-expiry reclaim. A two-dispatcher focused assertion proves one claim and one adapter call in the in-memory harness. The exact PostgreSQL SQL contract is also asserted.

This machine had no `DATABASE_URL`, Docker, or `psql`, so the real-PostgreSQL concurrent execution remains an explicit pre-merge CI gap. No production or persistent-staging database was used.

## Verification

- HighLevel unit contract tests: passed
- HighLevel integration, security, replay and two-worker claim tests: passed
- Focused lead capture and class fulfillment regressions: passed
- Focused account lifecycle, content library, delivery repository and web/worker independence regressions: passed
- Typecheck: passed before final verification
- All tests used fake/sink adapters; external calls and sends remained zero

## Convergence

Shared composition edits are intentionally limited to config fields, contract/domain exports, the web route mount, and one worker batch call. The persistent-staging conductor should deploy this PR in an isolated PR Environment, apply migration `2216`, configure protected HighLevel action credentials, verify provider mode remains off until controlled authorization, and then hand jobs `GHL-UI-14` through `GHL-UI-23` to the same authenticated GHL Agent Mode session.

Exact remaining dependency: deploy this PR to an isolated PR Environment with protected HighLevel configuration, run the real-PostgreSQL claim assertion, then execute the ten operator-owned controlled GHL jobs with zero broad sends.
