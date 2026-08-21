# Change: Canonical Parent and Student portal shell with Android navigation

## Why

The current protected portal mixes legacy section navigation with role-specific
surfaces. Its W12-03 synthetic access grant also expires before the current test
window, so a correctly authenticated Parent can reach a paused access shell rather
than a role-bound dashboard.

## What changes

- Define one role-aware Parent/Student shell grammar, canonical category hierarchy,
  horizontal contextual navigation, and mobile drawer behavior.
- Resolve the authenticated role and portal readiness before mounting protected
  content, exposing a deterministic role-bound loading, ready, or error state.
- Keep Parent learning separate from household management and keep Student scope,
  Billing, and technical-support boundaries explicit.
- Keep the normal Library migration state truthful while preserving isolated W12
  synthetic materials.
- Make the isolated W12 fixture's complimentary access valid for the W12 acceptance
  window so the real seeded dashboard response is reachable.

## Impact

- Affected capabilities: `ui-shell`, `parent-experience`, `student-experience`,
  `identity-access`, `content-media`, and `billing-access`.
- Affected runtime: authenticated client shell, route composition, portal test
  fixture, and focused portal coverage.
- Provider, billing, deployment, or production-data mutation: none.
