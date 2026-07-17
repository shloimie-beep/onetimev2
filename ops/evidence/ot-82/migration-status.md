# OT-82 Migration Status

Status: `implemented`

Implemented:

- Added `packages/brand-system` as the canonical One Time brand package.
- Added manifest/schema, CSS tokens, TypeScript tokens, route branding, static HTML helpers, React primitives, shell exports, canonical CSS modules, and style exceptions.
- Updated public page generation to render through `@onetime/brand-system/static`.
- Updated route CSS files to import canonical CSS from the brand package.
- Removed portal runtime CSS injection and moved portal styles into canonical CSS.
- Updated AppShell to use brand-system React primitives.
- Added `npm run brand:check` and unit tests for token/manifest/route invariants.
- Expanded bundle reporting to include raw/gzip public assets, app CSS, app JS, portal JS, and the self-hosted font.
- Fixed protected app HTML delivery for `/app/crm`, owner shell routes, parent shell, and student shell by serving checked built app HTML content instead of relying on Express `sendFile` for those protected routes.

Narrow ownership expansion:

- `tests/ot-52/portal-browser-harness.ts` and `tests/ot-52/portal-ui.test.ts` now read canonical portal CSS after the runtime style string was removed from `PortalFeatures.tsx`.
- `apps/web/src/server/app.ts` was updated because the full authenticated browser suite exposed a protected `/app/crm` shell delivery failure after the brand migration. The fix is scoped to protected app HTML delivery.

Not changed:

- No BNA assets or routes were introduced.
- No deployment, DNS/Railway, provider, production database, real send, payment, credential, or account/access mutation was performed.
