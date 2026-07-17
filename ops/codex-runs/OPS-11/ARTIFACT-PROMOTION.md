# OPS-11 Artifact Promotion

Status: `deterministic_exact_source_rebuild`

Railway did not expose a same-digest skipped-build promotion primitive for this
project through the CLI. OPS-11 therefore used exact-source rebuilds from the
same selected commit and recorded the resulting image digests.

## Selected Runtime Source

- Runtime source SHA:
  `1197673fa409bfc4c649c2683f782e86775caa5e`
- Version metadata: `ops11-1197673`
- Required PR checks on this source: green
- PG16 assurance: green
- PG18 assurance: green
- Staging restaged and smoke-tested before production.

## Staging Final Images

- Web deployment:
  `6e3b45dc-761c-4f4b-a844-f8e4c7aabe6a`
- Web digest:
  `sha256:30285f6adce25a03c2305d6bede808e95e97e96f057fdedd592f338958250d4f`
- Worker deployment:
  `914c18f8-4f59-4234-930a-932dd89790c4`
- Worker digest:
  `sha256:cbd8a55e41bab2229ec5603efcba2262a91c8be773ffb176520db3a43b220a72`

## Production Images

- Web deployment:
  `6f4fa4e4-0f49-4508-96fe-850a5430360e`
- Web digest:
  `sha256:eb6f723aa76ccf7eee8bf00b2b19f3c865873c2c2c7102f66fe775b303e26c71`
- Worker deployment:
  `45c4b4bc-b63f-4c50-84f9-87c72cf36ded`
- Worker digest:
  `sha256:e4446dbc5b531c88b484ac04844503eae18916644159a165f7aa90adea250d43`

The production web and worker digests differ from staging because Railway
rebuilt images independently for separate services/environments. The runtime
application source SHA, package lock, Dockerfile, startup command, migrations,
and build inputs were the same selected source family. The final worker deploy
used the repository worker config and `PROCESS_TYPE=worker`.

## Runtime Start Commands

- Web: `node scripts/railway-start.mjs`
- Worker: `node scripts/railway-start.mjs`
- Worker process type: `worker`

The Dockerfile copies runtime application paths only. OPS-11 evidence files
under `ops/codex-runs/` are not part of the production runtime image.
