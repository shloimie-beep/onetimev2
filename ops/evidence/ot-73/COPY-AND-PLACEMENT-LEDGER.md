# OT-73 Copy And Placement Ledger

Primary source: `ops/execution/ot-73/CORRECTED-LANDING-ADDENDUM.md`.

Superseded source: `ops/execution/ot-73/ORIGINAL-PROMPT.md` only where it asked
to remove the campaign ticker.

## Confirmed Edits

| Item | Before at base `dfef7de` / partial OT-73 | After corrected OT-73 | Evidence |
| --- | --- | --- | --- |
| Campaign ticker | Base had a ticker below the header; partial OT-73 incorrectly removed it. | Thin yellow moving ticker restored above the sticky header with `JOIN NOW — FREE UNTIL ROSH HASHANAH` plus dynamic countdown from `campaign.deadlineDate` and `campaign.timezone`. | `packages/domain/src/landing/content.ts`, `packages/domain/src/landing/campaign.ts`, `scripts/build-public-pages.ts`, `apps/web/src/client/public/styles.css`, `tests/e2e/landing-signup.spec.ts` |
| Ticker accessibility and motion | Base ticker had no labelled landmark and partial OT-73 had no ticker. | Ticker is inside a labelled `Campaign countdown` region, repeats moving text, and becomes readable static text with `prefers-reduced-motion`. | `scripts/build-public-pages.ts`, `apps/web/src/client/public/styles.css`, `tests/accessibility/public-a11y.spec.ts`, `tests/e2e/landing-signup.spec.ts` |
| Stale pricing paragraph | Corrected addendum says only the separate hero price/date/no-card paragraph should be removed. | No `$67`, monthly price, trial, or `No card today` appears in hero/ticker. | `tests/unit/lead-validation.test.ts`, `tests/e2e/landing-signup.spec.ts` |
| Header and logo | Mobile brand text could be hidden; logo was smaller. | Existing borderless logo is larger, brand title/subtitle remain visible at 360/390, `Member Login` stays `/login`, Sign Up Now stays `/signup`, and hamburger remains visible. | `apps/web/src/client/public/styles.css`, `tests/e2e/landing-signup.spec.ts` |
| Font | No DM Serif Display local asset. | Local DM Serif Display Latin WOFF2 is self-hosted and applied to wordmark/hero/major headings; sans remains for navigation/buttons/body/form text. | `apps/web/public/assets/fonts/`, `apps/web/src/client/public/styles.css`, `ops/evidence/ot-73/DM-SERIF-DISPLAY-PROVENANCE.md` |
| Hero | Hero used one-line kicker. | Kicker renders as `WORLDWIDE MISHNAH LEARNING` and `LIVE FROM ERETZ YISRAEL`; exact heading, schedule, and CTA preserved; no hero offer paragraph. | `packages/domain/src/landing/content.ts`, `scripts/build-public-pages.ts`, `tests/e2e/landing-signup.spec.ts` |
| What You Receive | Circular student crop with yellow ring and older bullet strings. | Section heading, rectangular photo, dark feature panel, centered icon, yellow eyebrow, approved title, and six approved lead/body bullets. | `packages/domain/src/landing/content.ts`, `apps/web/src/client/public/styles.css`, `tests/e2e/landing-signup.spec.ts` |
| What He'll Gain | Three cards with public provisional-copy disclaimer on Accomplishment. | Four balanced result cards with approved intro/copy; Toronto image preserved on Progress; public provisional disclaimer removed. | `packages/domain/src/landing/content.ts`, `tests/unit/lead-validation.test.ts`, `tests/e2e/landing-signup.spec.ts` |
| Who It's For | Older generic audience copy. | Approved heading and four audiences only; no teacher-replacement, absent-rebbe, substitute, or coverage language. | `packages/domain/src/landing/content.ts`, `tests/e2e/landing-signup.spec.ts` |
| Gallery | Slide captions included descriptive sentences. | Gallery is centered, teaching photos remain full color, controls remain accessible, and captions contain place names only. | `scripts/build-public-pages.ts`, `apps/web/src/client/public/styles.css`, `tests/e2e/landing-signup.spec.ts` |
| Footer | Footer had text and links but no logo mark. | Landing and signup share logo, exact line `One Time Mishnayos with Rabbi Eli Scheller.`, and links Home, Sign Up Now, Privacy, Terms, Member Login. | `scripts/build-public-pages.ts`, `apps/web/src/client/public/styles.css`, `tests/e2e/landing-signup.spec.ts` |
| CTA count | Header, hero, and final CTA existed. | Exactly three large landing `/signup` `.button-primary` CTA links remain; ticker is not counted as a large CTA button. | `tests/e2e/landing-signup.spec.ts` |

## Safety

No deployment, production database write, provider mutation, DNS change, send,
payment, real-user creation, or BNA repository modification is part of this task.
