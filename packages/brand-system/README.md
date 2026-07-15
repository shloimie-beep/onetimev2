# One Time Brand System

The One Time brand system is the canonical local source for product identity, tokens, primitives, shells, route branding, and style ownership.

- Manifest: `packages/brand-system/manifest/one-time-brand.v1.json`
- Schema: `packages/brand-system/manifest/one-time-brand.schema.json`
- Static entrypoint: `@onetime/brand-system/static`
- React entrypoint: `@onetime/brand-system/react`
- Tokens: `@onetime/brand-system/tokens.css` and `packages/brand-system/src/tokens.ts`
- Route registry: `packages/brand-system/src/route-branding.ts`

Public pages must use the static entrypoint and must not import React. Authenticated surfaces may use the React entrypoint. Route code may compose layout and product content, but raw brand values and core UI primitive definitions belong here.
