# OT-108 Visual Acceptance

## Required Viewports

- `360x800`
- `390x844`
- `768x1024`
- `1440x1000`

## Acceptance Checklist

- Thin moving top ticker with `JOIN NOW - FREE UNTIL ROSH HASHANAH` and
  countdown remains present before the deadline and becomes static under
  reduced motion.
- No hero `$67/month afterward`, `No card today`, price-line, trial, or stale
  offer copy appears.
- Hero kicker remains separated into `WORLDWIDE MISHNAH LEARNING` and
  `LIVE FROM ERETZ YISRAEL`.
- Header `Sign Up Now` and hero `Sign Up Now` are visible above the fold at
  `360x800` and `390x844`.
- `Member Login` links to `/login` everywhere it appears.
- Logo is visually larger/confident and remains borderless.
- Receive uses the student/headphones asset once.
- Clarity uses `clarity-class.webp`; Retention does not reuse the student asset.
- Benefit cards have an intentional dark/glass/ink card treatment with
  consistent spacing and yellow accents.
- Jewish-world carousel is centered, color, place-caption-only, keyboard
  operable, swipe capable, reduced-motion aware, and screen-reader friendly.
- No horizontal overflow at `320`, `360`, `390`, `768`, `1024`, or `1440`.
- Public bundle remains isolated from authenticated CRM/app bundles.
- Screenshots must cover full page plus hero, benefit cards,
  Clarity/Retention, and Jewish-world carousel.

## Evidence Paths

- Summary: `ops/evidence/ot-108/VISUAL-EVIDENCE.md`
- Metrics JSON: `ops/evidence/ot-108/visual-metrics.json`
- Screenshots: `ops/evidence/ot-108/screenshots/`
- Capture spec: `ops/codex-runs/OT-108/visual-evidence.spec.ts`

## Captured Results

| Viewport    | Overflow | Student image uses | App bundle requests | Usable ms | LCP ms |    CLS |
| ----------- | -------- | -----------------: | ------------------: | --------: | -----: | -----: |
| `360x800`   | Pass     |                  1 |                   0 |      1130 |    136 | 0.0137 |
| `390x844`   | Pass     |                  1 |                   0 |      1133 |    120 | 0.0118 |
| `768x1024`  | Pass     |                  1 |                   0 |      1198 |    140 | 0.0191 |
| `1440x1000` | Pass     |                  1 |                   0 |      1056 |    140 | 0.0074 |

The capture produced 24 JPEG screenshots: full page plus hero, benefits,
Clarity, Retention, and gallery crops for each required viewport class.

## Verification Notes

- Receive uses `/assets/students/smiley-kid.png` once.
- Clarity uses `/assets/outcomes/clarity-class.webp`.
- Retention renders a code-native `Learn / Review / Remember` visual and does
  not render a duplicate student image.
- The public landing request set includes `public.css` and `public.js`; no
  authenticated `app-crm` bundle requests were observed on `/`.
- The gallery reports active caption `Atlanta, Georgia`, place-only figcaptions,
  active slide state, keyboard controls, swipe handling, and reduced-motion
  support.
