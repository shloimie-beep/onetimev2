# OT-112 — Premium product-system audit, component kit, and adoption map

## Mission

Create the concrete visual/product system needed to make the integrated One Time application feel coherent, polished, and intentional across public, owner/admin, parent, and student surfaces. Because auth, Content, provider leaves, and the premium landing are being changed in parallel, do not perform a broad page rewrite in this leaf. Build the shared tokens/components, executable visual contract, route inventory, and exact adoption patches the final conductor can apply after convergence.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Branch: `codex/ot112-premium-product-system`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Inspect PR #47 premium landing head `c64a58ae9a72515fc6135cc2be0f72340c30f49c`, existing OT-19 design contracts/tokens if present, and current staging screenshots. Do not merge PR #47 here.

## Current defects to cover

- Route-brand registry omits auth lifecycle routes, `/app/support`, `/app/communications`, and nested CRM routes.
- Public/authenticated/portal surfaces use separate CSS and inconsistent typography, radii, spacing, card density, footer treatment, and raw colors.
- Evidence screenshots were sometimes captured during `Refreshing`, `Checking session`, `Signed out`, skeleton, or expired-session states rather than usable final state.
- Parent/student pages repeat the page identity in both shell and inner hero.
- Portal mobile actions wrap/crowd; the parent `+` bar, reset/revoke/suspend actions, and long card stacks need a deliberate responsive pattern.
- Helper-not-connected copy appears as a product-facing placeholder.
- Existing UI can look faded/disabled when it is not.

## Frozen landing invariants

Codify these as visual/content tests rather than inventing new copy:

- Preserve the thin moving top banner: `Join now — free until Rosh Hashanah` plus the existing countdown behavior.
- Do not place `$67/month afterward`, `No card today`, or similar pricing copy in the hero.
- The primary `Sign Up Now` CTA is visible above the fold on 360×800 and 390×844.
- Logo is clearly larger, has no unnecessary surrounding border, and header actions do not crowd mobile.
- Member Login is shown only when the real login route works.
- `What you receive` uses polished cards with icons above, clear yellow subheads/bullets, adequate spacing, and no overlapping decorative circle/text.
- Do not repeat the same headphone-boy image.
- Outcomes such as clarity and retention use approved, relevant imagery—not unapproved substitutions.
- The Jewish-world image carousel is centered, in color, and labels only the place; no unnecessary paragraph overlay.
- `Worldwide Mishnah learning` and `Live from Eretz Yisrael` have deliberate line hierarchy.

## Deliverables

1. Complete route/role/state inventory for public, owner/admin, parent, student, error, loading, empty, offline, denied, and session-expired states.
2. One semantic token source for color, type, spacing, radius, shadow, motion, z-index, breakpoints, safe areas, and component density. Preserve approved black/yellow/ice-blue identity and contrast.
3. Feature-neutral components with documented variants: shell header, section tabs, cards, metric tiles, tables/mobile cards, filter scroller, forms, CTA/buttons, status chips, empty/loading/error/denied states, drawers/dialogs, toast/banner, footer, media frame, activity timeline.
4. A deterministic visual fixture/gallery for every component/state without production data.
5. `ROUTE-ADOPTION-MAP.md` showing exact current files/selectors/components to replace after convergence, including duplicate title removal and placeholder-state treatments.
6. Automated bans/gates for unauthorized raw color proliferation, duplicate navigation labels, tiny targets, faded normal text, missing route branding, horizontal overflow, captured pre-usable screenshots, and public/authenticated bundle leakage.
7. Visual regression matrix at 360×800, 390×844, 768×1024, 1440×1000, 200% zoom, RTL, reduced motion, keyboard/focus, long content, and slow/error states.

Use repository-native CSS/components; do not add a heavyweight UI framework merely to appear premium. Premium means clear hierarchy, predictable behavior, strong typography, intentional spacing, fast routes, and complete states—not excessive animation or visual noise.

## Scope/collision rules

Feature-neutral new component/token/test files are owned here. If a shared hotspot must change to make the kit buildable, keep the patch minimal and record it. Do not rewrite auth behavior, Content behavior, portal data logic, provider adapters, worker runtime, migrations, or landing copy. The final conductor owns applying the kit to the converged pages.

## Verification and persistence

Run component/visual/a11y/responsive/performance tests and build/bundle checks. Use fictional fixtures only. Persist `ops/codex-runs/OT-112/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,ROUTE-ADOPTION-MAP.md,RESUME.md,FINAL-REPORT.md}`. Commit/push/open a draft PR with exact screenshots and budgets. Do not deploy or mutate providers/BNA.
