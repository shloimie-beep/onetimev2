# Production Launch Spine Read-Only Report

Generated: 2026-07-19T15:56:47.640Z

Target: `https://join.onetimeonetime.com`

Status: `READ_ONLY_PASSED_FULL_LAUNCH_SPINE_STILL_BLOCKED`

## What Ran

Two current production read-only checks were run without cookies, setup/reset
links, form submits, provider calls, or production writes.

1. OPS-06 synthetic probes:
   `ops/codex-runs/ONE-TIME-FINISH-NOW/production-launch-spine-readonly/synthetic-probes.json`
2. Wider GET-only route readback:
   `ops/codex-runs/ONE-TIME-FINISH-NOW/production-launch-spine-readonly/route-readback.json`

## Results

OPS-06 synthetic probes:

- JSON SHA-256:
  `7c342640c2ff7bb886e0b79f43ec9f3466283279e7bbfcf3cd65ee39f976e41a`
- Status: `blocked`
- Passed: landing, signup, login, anonymous private CRM denial, DB readiness.
- Blocked: protected worker diagnostics because `OPERATIONS_PROBE_TOKEN` is not
  configured in this session.

Wider route readback:

- JSON SHA-256:
  `120b0a9129c8937b679cb7016b0be510e855eead26d689561e7781db8988f1e9`
- Status: `passed`
- 16 of 16 GET-only route checks passed.
- Covered `/version`, `/health`, `/ready`, `/`, `/signup`, `/login`,
  `/activate`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, a
  known missing route, and anonymous denial for `/app/dashboard`, `/app/crm`,
  `/app/parent`, and `/app/student`.
- `/version` read back `rabbi-day-one-crm-ed77a04` /
  `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`.

## Non-Consuming Role Baseline

The accepted role baseline remains W13-103:

- `ops/codex-runs/W13-103/ROLE-ACCEPTANCE.json`
- `ops/codex-runs/W13-103/evidence/role-browser-acceptance.json`
- `ops/codex-runs/W13-103/evidence/production-role-access-counts.json`

Those sanitized files record administrator, parent, and student browser
acceptance and role isolation without publishing setup/reset URLs, passwords,
private email addresses, phone numbers, or raw token values.

## Safety

The read-only proof performed:

- Production database writes: 0
- CRM import applies: 0
- Emails sent: 0
- Provider mutations: 0
- Deployments: 0
- Form submits: 0
- Setup/reset links consumed: 0
- Response bodies committed: false, except sanitized `/version` and `/ready`
  fields in `route-readback.json`

## Remaining Launch-Spine Blocker

Full launch-spine acceptance remains blocked. This report does not prove a
current consuming administrator, parent, or student browser run, and it does not
submit a production signup lead.

To close the full launch-spine gate, a future run still needs exact protected
authorization and cleanup instructions for any consuming setup/reset-link
browser journey or production signup submit.
