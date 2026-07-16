# OPS-08 Cutover Runbook

Status: readiness draft only. Cutover is not authorized.

1. Block until source convergence selects one immutable SHA.
2. Block until isolated staging deploy, health, ready, version, callback, email, and migration gates pass.
3. Preserve join.onetimeonetime.com for at least 180 days after any later approved cutover.
4. Require exact authorization SHA, private DNS/callback/config digests, maintenance window, named monitor, rollback owner, and explicit root-mutation decision.
5. Do not mutate root DNS, launch DNS, email DNS, production providers, sends, payments, or access from this PR.
