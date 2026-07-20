# One Time Release Unblock Packet

Status: `blocked_waiting_for_external_or_operator_inputs`  
Generated: `2026-07-19T17:32:01.523Z`  
PR: `https://github.com/webcraft-media/onetimev2/pull/92`  
Head at generation: `8a9855cabd95227480bb013bd534786e56c25798`

This packet does not authorize any production action. It consolidates the exact
current gates that must be satisfied before the full One Time release can be
treated as finished.

## Already Accepted

- CRM real data: accepted. Evidence is in `crm-production-apply.json`,
  `crm-production-apply-replay.json`, and `crm-production-reconcile.json`.
- Production signup to CRM: accepted. Evidence is in
  `production-signup-proof.json`.
- Admin/parent/student role baseline: accepted from prior W13-103 proof. No
  fresh setup/reset/admin link was consumed in the CRM import slice.

## Required Unblockers

### GitHub Actions

Status: `blocked_by_github_account_billing_or_spending_limit`

Required action: fix GitHub Billing & plans or increase the spending limit for
the account or organization that owns `webcraft-media/onetimev2`, then rerun all
failed PR #92 checks.

Proof after unblock: all required PR #92 GitHub Actions checks complete
successfully on the live head.

Evidence:

- `ops/codex-runs/RABBI-DAY-ONE-CRM/github-actions-billing-blocker.json`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/GITHUB-ACTIONS-BILLING-BLOCKER.md`

### Campaign Seed

Status: `ready_for_operator_approval`

Required operator approval statement:

```text
APPROVE_ONE_TIME_CAMPAIGN_SEED:6e215ab2d0493f3e4175ca1bfb24d07099293f8da63e02d793e5ba4250246bd5:1357:email:seed-only
```

Required confirmation: `ONE-TIME-CAMPAIGN-SEED-OK`

Exact action after approval: send exactly one seed email to the protected
operator-approved destination. Do not send to the 1,357-person real audience
until separate broad-campaign approval is recorded.

### Production Admin Access Send Or Smoke

Status: `blocked_pending_fresh_exact_action_approval`

Required action: provide a current explicit approval for the protected
production admin/access recipient and action, plus any private W13-103
authorization material needed for a send, link extraction, or authenticated
browser smoke.

This packet does not approve creating or refreshing administrator access,
consuming setup/reset links, or running authenticated CRM browser smokes.

### Launch-Spine Consuming Proof

Status: `blocked_pending_private_inputs_and_exact_authorization`

Required operator approval statement:

```text
APPROVE_ONE_TIME_PRODUCTION_LAUNCH_SPINE_CONSUME:120b0a9129c8937b679cb7016b0be510e855eead26d689561e7781db8988f1e9:7c342640c2ff7bb886e0b79f43ec9f3466283279e7bbfcf3cd65ee39f976e41a:production
```

Required confirmation: `ONE-TIME-PRODUCTION-LAUNCH-SPINE-CONSUME-OK`

Required private files:

- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-CONSUME-PLAN.private.json`
- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-CLEANUP-INSTRUCTIONS.private.json`
- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-OPERATOR-AUTHORIZATION.private.txt`
- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-PRODUCTION-CONFIRMATION.private.txt`
- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-ADMIN-JOURNEY.private.json`
- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-PARENT-JOURNEY.private.json`
- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-STUDENT-JOURNEY.private.json`
- `C:/Users/User/.onetime-w13-104-private/ONE-TIME-LAUNCH-SPINE-SIGNUP-LEAD.private.json`

### Provider Canaries

Status: `blocked_pending_provider_runtime_inputs_and_exact_authorization`

Required operator approval statement:

```text
APPROVE_ONE_TIME_PROVIDER_CANARIES:072c4f00a22a7ca406792b55208b827c16c9dc39e651894ba708dc30777524ac:whatsapp,telegram,zoom,vimeo,openai_helper,bna_support,stripe_test,buffer:production
```

Required confirmation: `ONE-TIME-PROVIDER-CANARIES-OK`

Required private manifest:
`C:/Users/User/.onetime-w13-104-private/CANARY-AUTHORIZATION.private.json`

WhatsApp-specific action: configure Meta WhatsApp production webhook secrets and
verify token, then run the approved canary.

### Protected Diagnostics

Status: `blocked_missing_operations_probe_token`

Required action: provide `OPERATIONS_PROBE_TOKEN` through the protected runtime
path, then rerun the diagnostics proof without printing or committing the token.

## Safety

This packet performed no production deployment, no database write, no form
submit, no setup/reset link consumption, no external send, no provider mutation,
and no broad campaign send. It includes no secrets, private recipients, raw
contact values, setup/reset links, or tokens.
