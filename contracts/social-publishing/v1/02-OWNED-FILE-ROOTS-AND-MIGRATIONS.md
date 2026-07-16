# Owned file roots and additive migration contract

Write `ops/codex-runs/OT-86B/OWNED-ROOTS.json` with actual paths using:

```json
{
  "packet_id": "OT-86B",
  "repository_root": "/absolute/repository/path",
  "application_roots": {
    "social_admin_server": ["repo-relative/path"],
    "social_admin_ui": ["repo-relative/path"]
  },
  "shared_event_data_audit_roots": ["repo-relative/path"],
  "migration_roots": ["repo-relative/path"],
  "always_owned_roots": [
    "contracts/social-publishing/v1",
    "ops/codex-runs/OT-86B",
    "bin/ot86-buffer-canary"
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

The descriptive example values are replaced by discovered runtime paths. If no social-admin surface exists, add the smallest repository-native module inside the application that already owns BNA/operator content workflows; do not create a parallel application.

Allowed changes are limited to declared roots, `contracts/social-publishing/v1/`, `ops/codex-runs/OT-86B/`, exactly `bin/ot86-buffer-canary`, and directly required root manifests/lockfiles/configs listed with evidence. Do not edit One Time student retrieval, OT-86A publish semantics, unrelated marketing systems, or global UI code without a direct import requirement.

Migrations are additive: new social source, event inbox, draft/revision, approval, destination binding, publish command/attempt, provider result, audit, correction, and retraction records may be added. Existing tables/columns may not be dropped, renamed, retyped, or repurposed. Backfills are resumable and provider-free. Validate empty and upgraded databases and record ids, timing, and rollback/disable strategy.
