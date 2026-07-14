# OT-60R Remaining Work

1. Commit and push the initial execution protocol checkpoint.
2. Audit remote PRs and required commits for existence, state, head SHA, merge base, changed files, migrations, checksums, evidence paths, and overlap.
3. Record missing OT-41 corrected-integration, OT-43 feature branch, and OT-60 branch state.
4. Build the PR #3 / PR #9 security supersession matrix against canonical PR #2 base.
5. Apply authenticated shell and CRM units in order: PR #5, PR #7, PR #11.
6. Apply delivery and communications units in order: PR #4 feature range, PR #8, PR #14.
7. Apply isolated modules: PR #12, PR #15, PR #13.
8. Port and adapt PostgreSQL assurance from PR #6 to the integrated schema.
9. Preserve PR #10/OT-47 as evidence-only and mark content/library implementation as not implemented/environmental gate.
10. Run required verification locally where possible and record CI/disposable PostgreSQL needs honestly.
11. Update `CANONICAL-CANDIDATE.json` to `candidate` only after final integrated commit and evidence are recorded.
12. Push the final branch and open one draft PR against `codex/crm-core-v1`.

## Standing Prohibitions

- No deployment.
- No production or provider mutation.
- No BNA modification.
- No production database access.
- No messages, provider activation, live Stripe charges, DNS changes, or real user creation.
