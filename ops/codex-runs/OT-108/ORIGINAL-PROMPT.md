# OT-108 — Premium One Time Landing-Page Visual Refresh

## Outcome

Turn the deployed One Time landing page into a polished, high-end, modern Torah-learning product page while preserving its fast public bundle, working signup flow, mobile-above-the-fold CTA, and all existing lead-capture contracts.

This is an exact visual/content correction task, not permission to redesign the product or replace approved copy and photography arbitrarily.

## Canonical source

- Repository: `webcraft-media/onetimev2`
- Exact base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Base branch: `codex/ops03-staging-readiness-repair`
- Create a clean worktree and branch `codex/ot108-premium-landing-refresh`.
- Open a draft PR against `codex/ops03-staging-readiness-repair`.
- No migration.

## First: reconstruct intent from evidence

Before editing, inspect:

- Current landing source and content registry.
- Current live staging page at `https://ot99-web-staging.up.railway.app/`.
- Landing-related commits and screenshots in the repository.
- Every existing landing image asset with dimensions, hash, current use and semantic description.
- Any earlier approved card layout preserved in Git history.

Create an asset-use matrix. Do not identify people; describe only the scene/purpose. Do not substitute unrelated stock imagery when an approved asset is missing.

## Binding corrections

1. The boy-with-headphones image currently appears twice. Use it once, in the single strongest appropriate location. Replace the duplicate use with a different approved, semantically correct asset or a code-native visual treatment.
2. Audit the images used for “Clarity” and “Retention.” The current images appear not to match the previously supplied/approved images. Restore the correct approved assets when they exist in repo history or the asset folder. If they do not exist, record the exact missing asset instead of quietly choosing a random substitute.
3. Restore clear premium cards for the benefit/bullet sections. Cards should have deliberate spacing, a refined dark/glass/ink treatment, yellow accent headings or bullets, and a consistent grid. They must not look like plain text floating over a background.
4. “What he’ll gain” should emphasize outcomes such as clarity, retention, confidence, remembering the learning, and consistent daily progress. Preserve approved copy when it exists; do not invent unsupported program claims.
5. “Seen Across the Jewish World” must be a centered, responsive image slider/carousel:
   - Images display in color, not grayscale.
   - The active image is visually centered.
   - Captions contain only the place name.
   - Remove wording such as “coverage.”
   - Keyboard, touch/swipe, reduced-motion and screen-reader behavior must work.
6. Preserve the thin moving top ticker with “Join now — free until Rosh Hashanah” and its accurate countdown behavior. Do not replace it with a static $67 price line.
7. Remove the small yellow hero pricing sentence and the hero copy about “$67/month afterward” or “No card today.” Pricing may exist later in an appropriate pricing/billing context, but not in this hero line.
8. Preserve the hero structure with “Worldwide Mishnah Learning” and “Live from Eretz Yisrael” as intentionally separated readable lines.
9. Keep “Sign Up Now” visible above the fold at 360×800 and 390×844. A layout change may not push the primary CTA below the initial mobile viewport.
10. Keep Member Login only as a real link to `/login`; never create a dead button or redirect it to signup. OPS-03A owns changes to the login page itself.
11. Make the One Time logo larger and visually confident without restoring the unwanted boxed/bordered treatment.
12. Add premium code-native visual depth: restrained grid/orbit/light effects, scroll-linked section reveals or parallax-like depth only where performant, polished card transitions, and strong hierarchy. Avoid generic template effects, excessive glow, distracting continuous motion, or heavy animation libraries.

## Brand and quality invariants

- Preserve One Time black/yellow identity with restrained ice-blue accents where already approved.
- Reuse the repository design tokens and typography contract.
- Consistent header, CTA, card, radius, shadow, spacing and focus treatment.
- No overlapping text/images at any target viewport.
- No stretched, blurry, incorrectly cropped or excessively zoomed photography.
- Use `object-position`/responsive art direction so key subjects remain visible.
- No duplicate section titles, navigation labels or CTA competition.
- Respect `prefers-reduced-motion`.
- WCAG 2.2 AA contrast and keyboard behavior.
- No horizontal overflow at 320, 360, 390, 768, 1024 or 1440 widths.
- Preserve the isolated public bundle; do not import authenticated CRM/portal code.
- Do not weaken signup behavior, CSRF, analytics/privacy boundaries, metadata or lead idempotency.

## Performance budgets

- Do not introduce a large animation framework.
- Lazy-load below-the-fold photography.
- Use responsive image dimensions and modern formats already supported by the build.
- Prevent cumulative layout shift by reserving media dimensions.
- Preserve or improve the current public JS/CSS budgets and document before/after gzip sizes.
- Test throttled mobile LCP and CLS; do not claim unsupported measurements.

## Verification

Add or update focused tests for:

- Ticker and countdown rendering.
- Above-the-fold CTA visibility at 360×800 and 390×844.
- Unique use of the headphones-boy asset.
- Correct benefit-card semantics.
- Centered color carousel, place-only captions and controls.
- Member Login and Sign Up routes.
- Reduced motion.
- Keyboard/focus behavior.
- Image loading, layout shift and bundle isolation.

Capture full-page and key-section screenshots at 360×800, 390×844, 768×1024 and 1440×1000. Capture the hero, benefit cards, Clarity/Retention cards and Jewish-world carousel separately. Do not include secrets or authenticated data.

## Ownership and exclusions

OT-108 may edit only landing content/assets/styles/components/tests/evidence. It must not edit shared auth routes, account activation, server integration, worker main, provider config, Railway descriptors, CRM, portals, Stripe, Zoom, Telegram, WhatsApp, Vimeo, Buffer or BNA.

Do not deploy, merge or touch production/DNS. Push the branch and open a draft PR.

## Persistent record

Create:

- `ops/codex-runs/OT-108/ORIGINAL-PROMPT.md`
- `ops/codex-runs/OT-108/STATE.json`
- `ops/codex-runs/OT-108/ASSET-USE-MATRIX.md`
- `ops/codex-runs/OT-108/VISUAL-ACCEPTANCE.md`
- `ops/codex-runs/OT-108/RESUME.md`
- `ops/codex-runs/OT-108/FINAL-REPORT.md`

If an approved image is missing, continue every other correction, commit/push the safe work, and record the exact missing asset requirement. Do not stop the entire task and do not fabricate an approval.

Final response: branch, SHA, PR, exact visual changes, asset decisions, test results, screenshots, before/after bundle/performance evidence, missing assets, and confirmation that no deploy/provider/BNA/production mutation occurred.
