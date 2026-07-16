# Owned file roots and additive migration contract

## Deterministic root discovery

The repository layout is not assumed. Codex must identify roots from repository evidence and write `ops/codex-runs/OT-86A/OWNED-ROOTS.json` with this exact top-level shape:

```json
{
  "packet_id": "OT-86A",
  "repository_root": "/absolute/repository/path",
  "application_roots": {
    "bna": ["repo-relative/path"],
    "one_time": ["repo-relative/path"]
  },
  "shared_server_roots": ["repo-relative/path"],
  "migration_roots": ["repo-relative/path"],
  "always_owned_roots": [
    "contracts/content-pipeline/v1",
    "ops/codex-runs/OT-86A",
    "bin/ot86-vimeo-canary"
  ],
  "conditional_root_files": ["repo-relative/root-file"],
  "evidence": [
    {
      "path": "repo-relative/path",
      "reason": "specific import, route, manifest, deployment, or test evidence"
    }
  ]
}
```

Actual paths must replace the descriptive example values. Discovery is valid only when BNA and One Time are distinguishable by concrete evidence. If the repository contains only one of the products, implement only interfaces that belong in that repository and record the missing product boundary as an integration dependency; do not invent a second application directory.

## Allowed changes

A changed path must be:

- under a declared BNA, One Time, shared server, or migration root;
- under `contracts/content-pipeline/v1/`;
- under `ops/codex-runs/OT-86A/`;
- exactly `bin/ot86-vimeo-canary`; or
- a repo-root lockfile, package manifest, workspace manifest, compiler/linter/test config, environment example, or CI file directly required for the implementation and listed in `conditional_root_files` with evidence.

Changes outside these paths are a hard failure. Existing unrelated formatting churn is not allowed.

## Additive migrations

Migrations must follow the repository's normal ordering and transaction conventions. They may:

- create new tables, indexes, constraints, triggers, enum values, views, or queues;
- add nullable columns or columns with safe server defaults;
- add new foreign keys after compatible data exists;
- backfill in a separate resumable migration or job.

They may not:

- drop or rename existing tables, columns, indexes, constraints, or enum values;
- change the meaning or type of existing columns in place;
- make a populated column non-null without a safe backfill and validation sequence;
- perform provider network calls;
- rewrite approved content bytes;
- depend on OT-86B.

Every migration requires forward validation on an empty database and on a representative pre-OT86 database. Record migration ids, commands, duration, row counts, and rollback strategy in `MIGRATIONS.md`.

## Data ownership boundary

BNA owns ingest, provider operations, transcription/parsing, review, approval, and publication intent. One Time owns the local delivery projection, local entitlement-scoped index, local canonical page routes, and retrieval serving. Shared contracts may be versioned under `contracts/content-pipeline/v1/`; One Time must not import executable BNA operations code at runtime.
