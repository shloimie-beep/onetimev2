# OT-60R Remaining Work

1. Run required verification locally where possible and record CI/disposable PostgreSQL needs honestly.
2. Update `CANONICAL-CANDIDATE.json` to `candidate` only after final integrated commit and evidence are recorded.
3. Push the final branch and open one draft PR against `codex/crm-core-v1`.

## Standing Prohibitions

- No deployment.
- No production or provider mutation.
- No BNA modification.
- No production database access.
- No messages, provider activation, live Stripe charges, DNS changes, or real user creation.
