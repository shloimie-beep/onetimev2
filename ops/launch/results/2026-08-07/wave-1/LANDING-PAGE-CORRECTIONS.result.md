# Wave 1 — Landing Page Corrections

## Scope completed

- Reordered the landing sequence to Hero, What He'll Gain, Everything He Needs,
  Ready-to-Run class, How It Works, press logos, Rabbi bio, teaching-location
  carousel, and final CTA/footer.
- Matched the hero to the approved classroom creative while keeping live HTML
  headline and CTA text. It now states `Classes start August 16.` and the
  card-free free-access fact plainly.
- Built the requested three-step How It Works flow, including the approved
  parallel-lane independent-student image and deterministic responsive WebP
  derivatives.
- Added the press-logo and teaching-location carousels with autoplay, click,
  swipe, keyboard, hover/focus pause, reduced-motion support, accessible status,
  and no visible arrow, dot, or pause-control clutter.
- Improved the audience section background treatment and the outcome/step
  image cropping and responsive layout.

## CTA behavior decision

Source-of-truth PR #134 leaves the public `Pre-register` versus real Family
account creation phase unresolved. The live `/signup` form still creates a
Family account and immediate free access, so every clickable CTA remains
`Create your Family account`. The requested pre-registration wording is
isolated in landing content and used only as a non-clickable explanatory step;
it must not be promoted to a CTA until the phase decision changes.

## Asset provenance

- The social/OG image is copied from the operator's Downloads original;
  SHA-256 `96db3cc041602d47ef63c568bc1242108c66a216aba13b479ff094e94edcd4bc`.
- The first How It Works image uses the packaged reference fallback;
  SHA-256 `52185ec4c7b7987cef5a003b3694d33af3916e8f178ccf3270c6c5a33477a171`.
- The final Step 3 image is the approved parallel image-lane output;
  SHA-256 `f420735890925430e1c9064cb5b35119cd75a32e864c89b326eafca9e7c99c29`.
- Full dimensions and derivative details are in
  `apps/web/public/assets/how-it-works/PROVENANCE.md`.

## Validation

- `npm run brand:check` — passed.
- `npm run build` — passed.
- Focused landing, accessibility, and public-performance suite — 19 passed.
- No horizontal overflow was detected by the public performance and required
  viewport accessibility checks.

## Visual evidence

- `landing-page-corrections/mobile-360x800.png`
- `landing-page-corrections/mobile-390x844.png`
- `landing-page-corrections/tablet-portrait-768x1024.png`
- `landing-page-corrections/tablet-landscape-1024x768.png`
- `landing-page-corrections/desktop-1440x900.png`

No deployment, DNS, messaging, HighLevel, or other external product mutation
was performed in this lane.
