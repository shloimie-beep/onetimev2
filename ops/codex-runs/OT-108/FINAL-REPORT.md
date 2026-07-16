# OT-108 Final Report

Status: `draft_pr_opened`

Branch: `codex/ot108-premium-landing-refresh`

Draft PR: `https://github.com/webcraft-media/onetimev2/pull/47`

Product commit: `239a29c30836435fe62406a0cf94bacd919a0d09`

Base: exact requested SHA `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`.
`origin/codex/ops03-staging-readiness-repair` had advanced to
`b34eb0bf54c7583fff0ded11551cfbea7c33fc78`; the requested SHA is an ancestor,
and the draft PR is intended to target the requested base branch.

## Implementation

- Refreshed the public landing page with a darker premium black/yellow visual
  system, restrained cyan depth, larger borderless logo, improved hero/card
  polish, and header spacing that preserves mobile CTA access.
- Restored Clarity to `/assets/outcomes/clarity-class.webp`.
- Kept `/assets/students/smiley-kid.png` only in Receive and replaced the
  Retention duplicate with a code-native `Learn / Review / Remember` visual.
- Rebuilt the Jewish-world section as a centered color carousel with place-only
  captions, active slide state, buttons/dots, keyboard support, pointer swipe,
  aria-live status, and reduced-motion behavior.
- Added image dimensions to generated markup for landing media.
- Kept public and authenticated surfaces isolated; no app/CRM bundle request was
  observed on `/`.

## Evidence

- Asset matrix: `ops/codex-runs/OT-108/ASSET-USE-MATRIX.md`
- Visual acceptance: `ops/codex-runs/OT-108/VISUAL-ACCEPTANCE.md`
- Metrics: `ops/evidence/ot-108/visual-metrics.json`
- Screenshots: `ops/evidence/ot-108/screenshots/` with 24 JPEG files covering
  full page, hero, benefits, Clarity, Retention, and gallery at `360x800`,
  `390x844`, `768x1024`, and `1440x1000`.

## Metrics

| Viewport    | Overflow | Student image uses | App bundle requests | Usable ms | LCP ms |    CLS |
| ----------- | -------- | -----------------: | ------------------: | --------: | -----: | -----: |
| `360x800`   | Pass     |                  1 |                   0 |      1130 |    136 | 0.0137 |
| `390x844`   | Pass     |                  1 |                   0 |      1133 |    120 | 0.0118 |
| `768x1024`  | Pass     |                  1 |                   0 |      1198 |    140 | 0.0191 |
| `1440x1000` | Pass     |                  1 |                   0 |      1056 |    140 | 0.0074 |

## Verification

- `npm run build` passed. Public bundle: `public.css` 18.20 kB / 4.82 kB gzip,
  `public.js` 7.19 kB / 2.55 kB gzip. The inherited runtime font-resolution
  warning for `/assets/fonts/dm-serif-display-latin.woff2` remains unchanged.
- `npx vitest run --config vitest.unit.config.ts tests/unit/lead-validation.test.ts`
  passed.
- `PORT=3106 npx playwright test tests/e2e/landing-signup.spec.ts` passed.
- `PORT=3105 npx playwright test tests/accessibility/public-a11y.spec.ts`
  passed.
- `npx playwright test tests/performance/public-performance.spec.ts` passed.
- `npx tsx scripts/check-bundles.ts` passed.
- `PORT=3107 npx playwright test ops/codex-runs/OT-108/visual-evidence.spec.ts`
  passed.
- `npm run brand:check`, `npm run secret:scan`, and `npm run lint` passed.
- Scoped Prettier check for OT-108 files passed. Full `npm run format` remains
  blocked by pre-existing formatting in
  `ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`.

## Missing Assets

No missing approved OT-108 image asset remains. The requested Clarity asset
exists and is used; the previous Toronto asset gap is already resolved in this
base as `apps/web/public/assets/outcomes/accomplishment-toronto-class.jpg`.

## No-Mutation Confirmation

No deploy, DNS, production database, provider record, Stripe, Zoom, Telegram,
WhatsApp, Vimeo, Buffer, member-access, shared-auth, CRM, portal, or BNA product
code mutation was performed.
