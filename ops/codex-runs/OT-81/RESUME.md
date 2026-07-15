# OT-81 Resume

## Current State

- Status: `READY_FOR_STAGING_AUTH`.
- Run initialized from `origin/codex/ot80-one-shot-final-convergence`.
- Resolved base SHA: `741af0c08ee1d43be4e220b7c6e4c77a2330adc2`.
- Recorded OT80 product anchor: `b753d50ca562c01cfa8619762254e70c90b0105f`.
- PR #23: <https://github.com/webcraft-media/onetimev2/pull/23>.
- Starting strict certification report: `ops/evidence/ot-76/ot80-final-candidate/day-one-certify-report.json`.
- Latest OT81 strict certification report: `ops/evidence/ot-81/certification/day-one-certify-report.json`.
- Latest OT81 result: certified, 13/13 gates passing, zero blockers.
- Staging deployment was not attempted because the local Railway context is production-linked and no isolated staging env/resource names are present.

## Resume Steps

1. Confirm worktree: `C:\Users\User\OneTimeOneTime-ot81-dayone-certification-staging`.
2. Review `FINAL-REPORT.md` and `ops/evidence/ot-81/STAGING-AUTH-CHECKLIST.md`.
3. Provide or link a separate One Time Railway staging project, staging services, and staging PostgreSQL resource. Do not use the current production Railway context.
4. Populate the missing env names listed in the checklist without committing values.
5. Re-run the predeploy gates, `npm run db:verify`, and strict certification.
6. Only after those staging facts pass, deploy the exact branch SHA to isolated staging and run synthetic staging smoke.

## Guardrails

- Do not modify the dirty BNA worktree.
- Do not deploy production, change production DNS, mutate production/legacy contacts, run live Stripe charges, or send broad real messages.
- Do not commit secrets or activation URLs.
- Do not deploy while `railway status` shows project `one-time-production` or environment `production`.
