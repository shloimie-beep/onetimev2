# OT-60R Remaining Work

1. Commit and push the supersession security port checkpoint.
2. Apply authenticated shell and CRM units in order: PR #5, PR #7, PR #11.
3. Apply delivery and communications units in order: PR #4 feature range, PR #8, PR #14.
4. Apply isolated modules: PR #12, PR #15, PR #13.
5. Port and adapt PostgreSQL assurance from PR #6 to the integrated schema.
6. Preserve PR #10/OT-47 as evidence-only and mark content/library implementation as not implemented/environmental gate.
7. Run required verification locally where possible and record CI/disposable PostgreSQL needs honestly.
8. Update `CANONICAL-CANDIDATE.json` to `candidate` only after final integrated commit and evidence are recorded.
9. Push the final branch and open one draft PR against `codex/crm-core-v1`.

## Standing Prohibitions

- No deployment.
- No production or provider mutation.
- No BNA modification.
- No production database access.
- No messages, provider activation, live Stripe charges, DNS changes, or real user creation.
