# OT-81 Resume

## Current State

- Run initialized from `origin/codex/ot80-one-shot-final-convergence`.
- Resolved base SHA: `741af0c08ee1d43be4e220b7c6e4c77a2330adc2`.
- Recorded OT80 product anchor: `b753d50ca562c01cfa8619762254e70c90b0105f`.
- PR #23: <https://github.com/webcraft-media/onetimev2/pull/23>.
- Starting strict certification report: `ops/evidence/ot-76/ot80-final-candidate/day-one-certify-report.json`.

## Resume Steps

1. Confirm worktree: `C:\Users\User\OneTimeOneTime-ot81-dayone-certification-staging`.
2. Inspect the required OT80 certification, release, blocker, and OT75 evidence paths listed in `INPUTS.json`.
3. Run the existing strict Day-One certification harness to reproduce the ten starting blockers.
4. Close each blocker with code, tests, and machine-readable evidence, or record an explicit permitted Day-One scope decision.
5. Re-run strict certification until it passes or only external staging-account facts remain.
6. Only after strict local/CI certification passes, attempt isolated staging if credentials/resources are available.

## Guardrails

- Do not modify the dirty BNA worktree.
- Do not deploy production, change production DNS, mutate production/legacy contacts, run live Stripe charges, or send broad real messages.
- Do not commit secrets or activation URLs.
