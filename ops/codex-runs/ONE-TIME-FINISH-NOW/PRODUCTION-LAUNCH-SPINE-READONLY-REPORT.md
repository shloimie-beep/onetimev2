# Production Launch Spine Read-Only Report

Generated: 2026-07-19T16:25:01.2183177+03:00

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
  `25e296346076b7d4d7444b2ead1174f87d49012628e6cd206b8a2ed8ecb4e3cc`
- Status: `blocked`
- Passed: landing, signup, login, anonymous private CRM denial, DB readiness.
- Blocked: protected worker diagnostics because `OPERATIONS_PROBE_TOKEN` is not
  configured in this session.

Wider route readback:

- JSON SHA-256:
  `fb76363c92af59a4c8a62121b93fb4f229e1a60313f4df6a4b0f8ab14639151a`
- Status: `passed`
- 16 of 16 GET-only route checks passed.
- Covered `/version`, `/health`, `/ready`, `/`, `/signup`, `/login`,
  `/activate`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, a
  known missing route, and anonymous denial for `/app/dashboard`, `/app/crm`,
  `/app/parent`, and `/app/student`.

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
