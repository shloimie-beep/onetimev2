# OT-82 Brand Audit

Status: `complete`

The OT81 base had One Time brand implementation split across public CSS, CRM CSS, portal runtime style injection, and feature-local CSS files. OT82 centralizes the source of truth in `packages/brand-system` with manifest/schema files, CSS and TypeScript tokens, static shell helpers, React primitives, route branding, and canonical route CSS.

Key migrations:

- Public static pages now render through `@onetime/brand-system/static`.
- App shell uses canonical React primitives for logo, header, toolbar, drawer, footer, and shell action buttons.
- Route CSS entrypoints now import package-owned canonical CSS.
- Portal runtime style injection was removed.
- Brand checks validate manifest/token drift, route assignments, ticker allowlist, raw source drift, public React leakage, and generated public bundle constraints.

The campaign ticker is allowlisted only on `/`; signup, login, privacy, terms, and authenticated shell surfaces verify no ticker.
