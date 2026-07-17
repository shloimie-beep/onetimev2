# W12-07 — Premium landing correction

## Outcome

Polish the current One Time landing page into a premium, coherent, fast black/yellow experience while preserving exact signup behavior and mobile CTA visibility.

## Base/isolation

Target `webcraft-media/onetimev2`; dynamically select current accepted release source; create clean branch/worktree `codex/w12-07-premium-landing`.

## Required visual/content corrections

1. Inspect the existing landing screenshots/code and the exact approved local retention image at `C:\Users\User\Downloads\WhatsApp Image 2026-07-13 at 14.37.21.jpeg`. Copy it into a semantic public asset path, optimize responsive variants, document provenance, and never silently substitute another image.
2. Remove the duplicated headphones-boy usage. Each outcome uses an intentional distinct asset.
3. Fix sliders so no partially loaded/broken adjacent image is visible. Reserve dimensions, prevent CLS, provide fallback, and pause/disable motion for reduced-motion users.
4. Move “Seen Across the Jewish World” slightly higher and make it a wide centered full-row color carousel. Slides show the image and place name only, with balanced spacing, swipe/keyboard controls, and no cropped second slide artifact.
5. Zoom Rabbi/book and relevant background images out enough to show intended context. Use focal-point/object-position rules per breakpoint.
6. Hero: center the eyebrow as two intentional lines—“Worldwide Mishnah Learning” and “Live from Eretz Yisrael”—without blocking the Rabbi’s face. Place “Give your son a love for learning Torah.” around the upper-middle/roughly 30% composition while maintaining face-safe space.
7. Remove “Live every day” and schedule details from the hero. Put “Live every day at 7:00 p.m. Israel time” in the second/details section.
8. Preserve the thin moving bottom ticker: “Join now — free until Rosh Hashanah” plus the current accurate countdown. Do not reintroduce `$67/month afterward`, `No card today`, or equivalent hero copy.
9. Enlarge the One Time logo; no unnecessary border. Keep `Sign Up Now` visible in the initial mobile viewport. Preserve `Member Login` only if the route works; otherwise use the already approved honest readiness behavior.
10. Upgrade cards with disciplined depth, luminous yellow accents, consistent typography, high contrast, subtle hover/entrance motion, and no flashy performance-heavy effects.
11. Add a plain accessible floating WhatsApp control bottom-right. After a respectful delay, show dismissible assistant copy from canonical config. W12-06 owns conversation/backend; this lane uses capability/offline states and never fakes a working bot.

Use existing brand contracts/tokens where available. Do not fork a second brand system. Keep exact form behavior, analytics/privacy rules, footer, section order except the specified content move, and mobile overflow invariants.

## Proof

Capture full-page and initial-viewport screenshots at 360x800, 390x844, 768x1024, 1440x1000. Test image load failure, slow network, no JS where relevant, reduced motion, keyboard, focus, contrast, 200% zoom, no horizontal overflow, no face/text collision, no broken/partial slide, CTA above fold, LCP/CLS/bundle budgets.

## Continuity/safety

Maintain `ops/codex-runs/W12-07/**`. Own public landing/assets/styles/tests only; document shared brand/build hotspots. No deploy or provider mutation. Commit, push, draft PR.
