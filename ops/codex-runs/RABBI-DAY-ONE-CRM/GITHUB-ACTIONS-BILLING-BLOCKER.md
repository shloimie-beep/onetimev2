# GitHub Actions Billing Blocker

Status: `BLOCKED_BY_GITHUB_ACCOUNT_BILLING_OR_SPENDING_LIMIT`

PR: `https://github.com/webcraft-media/onetimev2/pull/92`  
Inspected head: `f46375cdbfea26700e6d6a181745b2c35705412b`

## Finding

All five PR #92 GitHub Actions checks completed as `failure`, but GitHub did
not start any job steps. The Checks API returned one failure annotation on each
check-run at `.github:1`:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

This is an external GitHub account billing/spending-limit blocker, not an
observed application-code or test failure. The normal job logs are unavailable
because the jobs did not reach runner execution.

## Affected Checks

- `Node 24 verify`: run `29696629628`, job `88218387162`
- `OPS-06 deterministic checks`: run `29696629632`, job `88218387106`
- `PostgreSQL 18 assurance and restore clone`: run `29696629635`, job `88218387170`
- `PostgreSQL 16 assurance harness`: run `29696629630`, job `88218387371`
- `PostgreSQL 16 learner-seat proof`: run `29696629637`, job `88218387142`

## Required Next Action

Fix GitHub Billing & plans or increase the spending limit for the
account/organization that owns `webcraft-media/onetimev2`, then rerun all failed
PR #92 checks. After rerun, inspect normal logs and results before treating the
release as CI-proven.

No workflow bypass, production deployment, database write, send, or provider
mutation was performed for this evidence artifact.
