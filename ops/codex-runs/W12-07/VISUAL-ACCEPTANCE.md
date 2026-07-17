# W12-07 Visual Acceptance

## Required Assertions

- Hero eyebrow appears as two centered lines: `WORLDWIDE MISHNAH LEARNING` and `LIVE FROM ERETZ YISRAEL`.
- Hero does not render the schedule line or stale pricing copy.
- `Live every day at 7:00 p.m. Israel time.` appears in the second/details section.
- `Sign Up Now` remains visible in the first mobile viewport at `360x800` and `390x844`.
- Bottom ticker remains thin, moving by default, reduced-motion readable, and contains `JOIN NOW - FREE UNTIL ROSH HASHANAH` plus countdown.
- Retention card uses the exact approved local image through responsive WebP variants.
- Headphones/student image appears once.
- Jewish-world carousel appears above the Who/Rabbi sections, centered, wide, color, place-name-only, keyboard/touch controllable, and shows no cropped adjacent slide artifact.
- Gallery image failure produces a visible fallback instead of a broken image.
- Floating WhatsApp control is accessible, bottom-right, dismissible, and clearly offline/readiness-scoped.
- Public landing remains static/minimal and does not load authenticated CRM/portal bundles.

## Evidence Paths

Generated and passing:

- `ops/evidence/w12-07/visual-metrics.json`
- `ops/evidence/w12-07/visual-metrics.md`
- `ops/evidence/w12-07/screenshots/`

Responsive screenshot set:

- `mobile-360` at `360x800`
- `mobile-390` at `390x844`
- `tablet` at `768x1024`
- `desktop` at `1440x1000`

Visual metrics summary:

- Horizontal overflow: pass on all four viewports.
- Hero CTA above fold: pass on all four viewports.
- Retention image count: `1` on all four viewports.
- Student/headphones image count: `1` on all four viewports.
- Authenticated app bundle requests from public landing: `0` on all four viewports.
- Bottom ticker locked to viewport bottom: pass on all four viewports.
- Gallery viewport overflow: `hidden` on all four viewports.
- No-JS usability: pass.
- 200% text zoom/reflow overflow: pass.

## No-Deploy Rule

This lane must stop at pushed branch and draft PR. No deployment, DNS, provider mutation, production database mutation, real send, payment/access change, credential change, or merge is allowed in W12-07.
