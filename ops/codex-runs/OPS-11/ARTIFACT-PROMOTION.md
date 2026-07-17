# OPS-11 Artifact Promotion

Status: `pending`

Preferred proof order:

1. Same private OCI image digest deployed to staging and production.
2. Railway skipped-build or cached-image promotion reporting the same digest.
3. Deterministic exact-source application-payload equivalence.

OPS-10 staging images:

- Web deployment: `d06dc5a5-41cf-4b41-b337-ebe4425bc371`
- Web digest:
  `sha256:56f600b00111537e352cf43b5bb67c2d04d99594b49b268facc91af4066ba33a`
- Worker deployment: `21e2cdd2-a441-4225-a98e-6243c08c4da0`
- Worker digest:
  `sha256:12af9a6eb4f17696689a59f3943fbfc473ba9411a3d9c3104a1c64bb7a2693f0`
- Staged app/source SHA:
  `d13e9cd3117091e97ef973408d8742a13d1a9479`

## Required Equivalence Manifest

If same-digest promotion is unavailable, compare canonical hashes for:

- built server and worker entrypoints;
- static asset manifest and files;
- package lock;
- migration files and checksums;
- runtime start commands;
- dependency/toolchain versions;
- build inputs and source SHA.

Unexplained payload differences block production.
