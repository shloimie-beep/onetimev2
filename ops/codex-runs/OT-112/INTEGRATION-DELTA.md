# OT-112 Integration Delta

## Added

- Complete TypeScript/CSS/manifest token coverage for color, typography, spacing, radius, border, shadow, motion, focus, layers, breakpoints, safe areas, density, and component sizes.
- Template-aware route, role, bundle, and visual-state inventory covering public, auth lifecycle, owner/admin, nested CRM, communications, support, parent, student, classroom launch, redirects, and error routes.
- Feature-neutral primitive exports for section tabs, metric tiles, status chips, mobile cards, state panels, toast/banner, media frame, and activity timeline.
- Deterministic visual fixture gallery and JSON visual matrix under `ops/codex-runs/OT-112/evidence/`.
- Automated gates for route drift, duplicate navigation labels, raw style ownership, low-opacity normal UI, touch target budget, pre-usable screenshot bans, component contract coverage, and public/authenticated bundle separation.
- OT-112 Playwright matrix screenshots under `ops/evidence/ot-112/screenshots/` when `npm run brand:visual` is run.

## Changed

- `npm run brand:check` now validates the larger OT-112 visual/product-system contract in addition to the existing OT-82 brand rules.
- `tests/unit/brand-system/brand-system.test.ts` now verifies missing-route coverage and visual matrix coverage.

## Not Changed

- No broad landing, auth, CRM, portal, Content, provider, migration, worker, deployment, BNA, production data, send, payment, or DNS behavior was modified.
- PR #47 was observed only and remains unmerged in this branch.
