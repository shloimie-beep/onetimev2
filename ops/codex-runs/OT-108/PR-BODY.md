## Summary

- Refreshes the One Time public landing page with a premium black/yellow visual
  treatment, larger borderless logo, polished hero/cards, and improved mobile
  header spacing.
- Restores the approved Clarity asset, keeps the student image only in Receive,
  and replaces the duplicate Retention image with a code-native memory-review
  visual.
- Rebuilds the Jewish-world section as a centered color carousel with
  place-only captions, active state, keyboard controls, pointer swipe,
  screen-reader status, and reduced-motion behavior.

## Evidence

- Asset matrix: `ops/codex-runs/OT-108/ASSET-USE-MATRIX.md`
- Visual acceptance: `ops/codex-runs/OT-108/VISUAL-ACCEPTANCE.md`
- Metrics: `ops/evidence/ot-108/visual-metrics.json`
- Screenshots: `ops/evidence/ot-108/screenshots/`

## Verification

- `npm run build`
- `npx vitest run --config vitest.unit.config.ts tests/unit/lead-validation.test.ts`
- `PORT=3106 npx playwright test tests/e2e/landing-signup.spec.ts`
- `PORT=3105 npx playwright test tests/accessibility/public-a11y.spec.ts`
- `npx playwright test tests/performance/public-performance.spec.ts`
- `npx tsx scripts/check-bundles.ts`
- `PORT=3107 npx playwright test ops/codex-runs/OT-108/visual-evidence.spec.ts`
- `npm run brand:check`
- `npm run secret:scan`
- `npm run lint`
- Scoped Prettier check for OT-108 files

Full `npm run format` is still blocked by pre-existing formatting in
`ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`.

## Guardrails

No deploy, DNS, production database, provider, Stripe, Zoom, Telegram, WhatsApp,
Vimeo, Buffer, member-access, shared-auth, CRM, portal, or BNA product code
mutation was performed.
