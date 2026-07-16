# OT-82 Bundle Report

Final bundle check passed through `npm run performance` and `tsx scripts/check-bundles.ts`.

- Public JS stayed unchanged at `6316` raw bytes / `2226` gzip bytes.
- Public CSS increased from `12801` to `14855` raw bytes to carry canonical tokens and shell styling.
- CRM JS increased from `233126` to `233983` raw bytes after importing canonical primitives.
- App CSS final size is `19036` raw bytes / `4792` gzip bytes.
- Self-hosted DM Serif Display WOFF2 remains `24744` raw bytes.

No public page loads the authenticated CRM bundle, and the brand check enforces that invariant.
