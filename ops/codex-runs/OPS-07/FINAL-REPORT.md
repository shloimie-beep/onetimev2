# OPS-07 Final Report

Status: `gates_ready_with_blocking_findings`

## Outputs

- `ops/codex-runs/OPS-07/ROUTE-MATRIX.json`
- `ops/codex-runs/OPS-07/DAYONE-MATRIX.json`
- `ops/codex-runs/OPS-07/FINDINGS.json`
- `tests/ux/ops07-dayone-route-gates.spec.ts`
- `tests/visual/ops07-visual-matrix.spec.ts`

## Summary

- Route matrix: {"total":6,"pass":3,"fail":3,"blocked_external":0,"deferred_approved":0}
- Day-One matrix: {"total":10,"pass":4,"fail":0,"blocked_external":2,"deferred_approved":4}
- Findings: {"total":3,"blockers":2,"major":1,"minor":0}

## Verification

- `npm ci` passed.
- `npm run build` passed; Vite kept the existing unresolved font URL warning.
- `npx tsx scripts/ux-certify/ops07-build-matrices.ts` passed and regenerated the route, Day-One, finding, and state artifacts.
- Scoped Prettier, ESLint, and TypeScript checks passed for OPS-07 files.
- `npx playwright test tests/ux/ops07-dayone-route-gates.spec.ts` failed by design on an unexpected `403 http://127.0.0.1:3100/app/dashboard` response and matching browser console error; route usability rows still recorded 8 pass / 0 fail in `ops/evidence/ops-07/route-gates.json`.
- `npx playwright test tests/visual/ops07-visual-matrix.spec.ts` passed, recording 10 nonblank/no-overflow screenshots in `ops/evidence/ops-07/screenshots/` and `ops/evidence/ops-07/visual-matrix.json`.

## Findings

- [blocker] CRM normal UI exposes idempotency implementation detail. Evidence: apps/web/src/client/app/crm-entry.tsx:1085. Owner: OPS-08.
- [blocker] App shell can show Signed out/Session expired/Checking session in normal loading identity copy. Evidence: apps/web/src/client/app/shell/AppShell.tsx:97. Owner: OPS-08.
- [major] Harness still carries raw helper-unavailable placeholder copy that OPS-08 must not allow into product UI. Evidence: tests/ot-83/portal-browser-harness.ts:279. Owner: OPS-08.

## Guardrails

- No deployment, provider mutation, send, charge, Buffer publication, DNS action, BNA edit, or production data action was performed by this lane.
- Real staging canaries are separated from UI/domain and sink evidence.
