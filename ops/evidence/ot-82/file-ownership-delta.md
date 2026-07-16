# OT-82 File Ownership Delta

OT82 stayed within the packet ownership model except for these narrow, recorded expansions:

- `tests/ot-52/portal-browser-harness.ts`
- `tests/ot-52/portal-ui.test.ts`

Reason: portal styles moved out of `PortalFeatures.tsx` runtime injection and into `packages/brand-system/src/styles/portal.css`. The OT52 tests imported/read the old runtime style string, so they were updated to inspect the canonical CSS file instead.

- `apps/web/src/server/app.ts`

Reason: authenticated e2e coverage exposed that protected `/app/crm` could reach a 404 from `res.sendFile(path.join(distDir, 'app', 'crm.html'))` while the static `/app/crm.html` artifact existed. The fix is a scoped protected-shell delivery helper used by CRM, owner shell aliases, parent shell, and student shell.
