# One Time Brand System

The One Time brand system is the canonical local source for product identity, tokens, primitives, shells, route branding, and style ownership.

- Manifest: `packages/brand-system/manifest/one-time-brand.v1.json`
- Schema: `packages/brand-system/manifest/one-time-brand.schema.json`
- Static entrypoint: `@onetime/brand-system/static`
- React entrypoint: `@onetime/brand-system/react`
- Tokens: `@onetime/brand-system/tokens.css` and `packages/brand-system/src/tokens.ts`
- Route registry: `packages/brand-system/src/route-branding.ts`
- Visual contract: `packages/brand-system/src/visual-contract.ts`
- Deterministic gallery: `npm run brand:fixtures`

Public pages must use the static entrypoint and must not import React. Authenticated surfaces may use the React entrypoint. Route code may compose layout and product content, but raw brand values and core UI primitive definitions belong here.

## OT-112 Contracts

The TypeScript tokens, manifest tokens, and CSS custom properties cover color, typography, spacing, radius, border, shadow, motion, focus, layers, breakpoints, safe areas, density, and component sizes.

Route branding is template-aware and includes public, auth lifecycle, owner/admin, nested CRM, communications, support, parent, student, classroom launch, redirect, error, loading, empty, offline, denied, and session-expired states.

Feature-neutral primitives include shell header/footer, section tabs, cards, metric tiles, table/mobile cards, filter scroller, forms, CTA buttons, status chips, empty/loading/error/denied/offline/session-expired states, drawers/dialogs, toast/banner, media frame, and activity timeline.

Visual gates live in `scripts/brand-system/check.ts` and `tests/e2e/ot112-visual-contracts.spec.ts`. They enforce raw color ownership, route branding completeness, duplicate navigation-label bans, minimum target sizes, no faded normal text, no horizontal overflow, pre-usable screenshot bans, and public/authenticated bundle separation.
