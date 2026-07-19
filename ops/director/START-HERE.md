# One Time Director Start Here

Generated: 2026-07-19T14:52:52.0505712+03:00

This folder is the canonical director handoff for fresh ChatGPT or Codex
sessions working on `webcraft-media/onetimev2`. It records the current release
state without depending on local chat memory.

## Read Order

1. `AGENTS.md`
2. `ops/director/START-HERE.md`
3. `ops/director/CURRENT-STATE.json`
4. `ops/director/CAPABILITY-MATRIX.json`
5. `ops/director/DEPLOYMENTS.json`
6. `ops/codex-runs/ONE-TIME-FINISH-NOW/FINAL-REPORT.md`
7. `ops/codex-runs/ONE-TIME-FINISH-NOW/RESUME.md`
8. `ops/director/PRODUCT-INVARIANTS.md`
9. `ops/director/DECISION-REGISTER.md`

## Current Truth

- Repository: `webcraft-media/onetimev2`
- Production URL: `https://join.onetimeonetime.com`
- Staging URL: `https://ot99-web-staging.up.railway.app`
- Production and staging `/version` read back:
  `w13-104-public-cls-688fc70`
- Production and staging runtime SHA:
  `688fc70cf64b72bc52f4ea7511d8593750d7ab45`
- Canonical draft PR:
  `https://github.com/webcraft-media/onetimev2/pull/91`
- PR #91 head:
  `e3d3736546f48b3834d6698838befe20884005f1`
- PR #91 required checks were green when inspected on 2026-07-19.
- Production `/health` and `/ready` were ok.
- Staging `/health` and `/ready` were ok.
- Latest migration from `/ready`:
  `2203_w13_100_student_gamification`
- Current release run:
  `ops/codex-runs/ONE-TIME-FINISH-NOW/`
- ONE-TIME-FINISH-NOW remediation PR:
  `https://github.com/webcraft-media/onetimev2/pull/92`
- PR #92 head:
  `504560f77cbceae4675cba49e57f21ab55568467`
- PR #92 checks were green when inspected on 2026-07-19.

## Current Verdict

CORE_RELEASE: BLOCKED_BY_CORE_SAFETY_GATE
ADMIN_ACCESS: ACCEPTED
PARENT_ACCESS: ACCEPTED
STUDENT_ACCESS: ACCEPTED
CRM_REAL_DATA: PREVIEW_READY

The safe core is live, but the full release gate remains blocked by exact
private-input/current-proof blockers: email inputs, CRM import authorization,
provider canary authorization, protected diagnostics token, source-authoritative
rollback proof, and current W13-104 launch-spine proof.

The latest staging rollback exercise lives at
`ops/codex-runs/ONE-TIME-FINISH-NOW/STAGING-ROLLBACK-REPORT.md`. It exercised
source-rebuild rollback and roll-forward, restored staging to W13-104, and kept
production untouched, but it is not accepted as rollback proof because
`/version` stayed W13-104 during the rollback-source deploy.

PR #92 head `504560f77cbceae4675cba49e57f21ab55568467` now implements the next
runtime deployment proof path: `/version` includes non-secret Railway deployment
identity when available, and the launch toolkit validates `/version.deployment`.
This code is CI-green, but it is not a live rollback acceptance until staging is
deployed and rollback/roll-forward is rerun against Railway deployment metadata
and image digests.

## What Not To Do From This Handoff

- Do not print or commit secrets, private manifests, setup/reset links,
  passwords, private email addresses, phone numbers, contact rows, or raw
  message bodies.
- Do not perform broad email, WhatsApp, Telegram, or social sends.
- Do not create live Stripe charges.
- Do not change DNS.
- Do not perform production CRM import apply without the protected manifest.
- Do not run Zoom, Vimeo, Stripe TEST, WhatsApp, Telegram, Buffer, OpenAI
  helper, or BNA support canaries without the protected manifest.
- Do not use the dirty BNA checkout for One Time product edits.

## Fast Orientation

- Use `CURRENT-STATE.json` for release refs, live readback, blockers, and
  safety notes.
- Use `CAPABILITY-MATRIX.json` for the required capability status list.
- Use `DEPLOYMENTS.json` for Railway production/staging deployment IDs.
- Use `ops/codex-runs/ONE-TIME-FINISH-NOW/RESUME.md` for the next exact work.
