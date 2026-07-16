# OT-111 Final Report

Status: candidate ready for commit.

## Scope Implemented

- Extended legacy audience reconciliation with the independent `new_system_activated` fact.
- Added OT-111 activation campaign contracts for snapshots, approvals, canary/batch queue requests, controls, delivery states, and block reasons.
- Added a counts-only campaign preview service with immutable snapshot hashes and no normal recipient-list exposure.
- Added exact approval matching, canary allowlist checks, WhatsApp disabled-by-default behavior, stale snapshot checks, broad batch blocking, and pause/resume/cancel controls.
- Added a narrow OPS-03B parent activation lifecycle port so activation can use the existing lifecycle token/delivery contract instead of duplicating token generation.
- Added forward migration `2010_ot111_legacy_activation_campaign.sql` for campaign, intent, audit, and `new_system_activated` storage.
- Extended the unmounted audience reconciliation router with protected campaign preview, approval, send-intent, and control endpoints.
- Added a synthetic OT-111 dry-run CLI that prints only counts and hashes.

## Validation

- `npm run typecheck`: PASS.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot74-audience-reconciliation.test.ts tests/unit/ot74-audience-panel.test.ts tests/unit/ot111-legacy-activation-campaign.test.ts`: PASS, 3 files, 10 tests.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot74-audience-repository.test.ts tests/integration/ot74-audience-router.test.ts`: PASS, 2 files, 10 tests.
- `npx tsx scripts/ot111/legacy-activation-campaign-dry-run.ts`: PASS; synthetic counts-only report, no raw recipients.
- `npm run secret:scan`: PASS; 912 repo text files scanned.
- `npm run lint`: PASS.
- `git diff --check`: PASS; only normal Windows line-ending warnings.

## Synthetic Counts

The synthetic OT-111 CLI produced:

- total rows: 6
- matched existing contacts: 1
- manual review rows: 1
- migration invite eligible rows: 1
- school follow-up rows: 1
- do-not-contact rows: 1
- already activated rows: 1
- campaign eligible rows for `active_legacy_family_users`: 1
- already activated exclusions: 1
- manual review exclusions: 1
- suppressed exclusions: 1

## Real Audience And Sends

Real audience import: not performed.

Real canary send: not performed.

Real broad send: not performed.

WhatsApp campaign send: disabled by default and not performed.

Production deployment, DNS changes, live charges, provider mutations, and BNA mutations: not performed.

## Remaining Authorization Needed

Before any real import, canary, or batch:

1. Operator verifies OPS-03B login/activation behavior on the intended environment.
2. Operator supplies an explicit protected audience import source and approves exact source, segment, template revision, channel, batch size, and schedule.
3. Operator explicitly authorizes a protected canary destination.
4. For any batch beyond canary, a protected destination-ingest path must provide exact destinations without logging or exposing raw recipient lists.
5. WhatsApp remains blocked unless verified consent and approved provider configuration are recorded.
