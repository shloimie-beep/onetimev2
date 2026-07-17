# OPS-10 Visual Acceptance

Generated: 2026-07-17T08:50:00+03:00

## Current Status

`partial_local_pass_pending_staging`

## Passed Local Browser Gates

- `tests/e2e/support.spec.ts`
- `tests/e2e/crm-core.spec.ts`
- `tests/e2e/ot-35/app-shell-crm.spec.ts`
- `tests/e2e/ot-44/communications-descriptor.spec.ts`
- `tests/e2e/ot-83r-portals.spec.ts`
- `tests/accessibility/support-a11y.spec.ts`
- `tests/accessibility/ot-44/communications-accessibility.spec.ts`

These gates cover support, CRM shell, communications descriptor, parent/student
portal layouts, and accessibility checks in the local test runtime.

## Still Required Before Production

- Staging screenshots after immutable OPS-10 deployment.
- Public landing checks at 360x800, 390x844, 768x1024, 1440x1000.
- 200 percent zoom and keyboard-only smoke.
- Reduced-motion and RTL-safe layout review.
- Production visual smoke after promotion.

## Evidence Policy

Generated local screenshots from the OT-83R test run are left unstaged unless a
later evidence refresh explicitly adopts them.
