# W12-100 Railway Launch Toolkit

This toolkit is fail-closed by design. It does not infer Railway state from a
linked directory, branch name, or human-readable service name. Every operation
requires explicit immutable identity values:

- Railway project ID
- Railway environment ID
- web service ID
- worker service ID
- database service ID
- exact candidate commit SHA
- expected image digest

Do not use this toolkit to deploy from this W12-100-10 lane. These runbooks are
operator procedures for a later approved staging or production window.

## Files

- `scripts/w12-100/deploy/railway-launch-toolkit.ts`
- `scripts/w12-100/deploy/migration-status.ts`
- `scripts/w12-100/ops/observability-checks.ts`
- `ops/runbooks/w12-100/staging-deploy.md`
- `ops/runbooks/w12-100/staging-rollback.md`
- `ops/runbooks/w12-100/staging-roll-forward.md`
- `ops/runbooks/w12-100/production-promotion.md`
- `ops/runbooks/w12-100/post-deploy-verification.md`
- `ops/runbooks/w12-100/alert-observability.md`

## Manifest Shape

Create the manifest as evidence for the approved window. Do not include secret
values, database URLs, raw provider destinations, private links, or variable
values.

```json
{
  "schema_version": "onetime.w12_100.railway_launch_manifest.v1",
  "lane_id": "W12-100-10",
  "repository": "webcraft-media/onetimev2",
  "target": {
    "environment_kind": "staging",
    "base_url": "https://<staging-host>",
    "railway": {
      "project_id": "<railway-project-id>",
      "environment_id": "<railway-environment-id>",
      "web_service_id": "<railway-web-service-id>",
      "worker_service_id": "<railway-worker-service-id>",
      "database_service_id": "<railway-postgres-service-id>",
      "environment_name": "staging",
      "web_service_name": "one-time-web",
      "worker_service_name": "one-time-worker",
      "database_service_name": "one-time-postgres"
    }
  },
  "candidate": {
    "commit_sha": "<exact-candidate-commit-sha>",
    "expected_image_digest": "sha256:<64 lowercase hex chars>",
    "branch": "integration/w12-final-convergence-20260717T123715Z"
  },
  "predeploy": {
    "expected_version": "<current-protected-runtime-version-before-deploy>",
    "expected_commit_sha": "<current-protected-runtime-commit-before-deploy>"
  },
  "rollback": {
    "predeploy_commit_sha": "<same-current-protected-runtime-commit-before-deploy>",
    "predeploy_image_digest": "sha256:<64 lowercase hex chars>"
  },
  "provider_transports": {
    "email": "disabled",
    "whatsapp": "disabled",
    "telegram": "disabled",
    "payments": "disabled",
    "zoom": "sink",
    "buffer": "not_configured",
    "openai_helper": "disabled"
  },
  "limits": {
    "worker_heartbeat_max_age_ms": 120000,
    "queue_ready_max_count": 50,
    "queue_oldest_ready_max_age_ms": 600000,
    "backup_max_age_minutes": 1440
  }
}
```

## Safety Defaults

- Staging commands reject production-like targets.
- Mutating commands require `--execute` and exact confirmation text.
- Railway command plans are allowlisted and refuse database delete/replace
  paths.
- `railway variable list --json` and `railway variable --kv` are forbidden
  because they can print raw environment values.
- Evidence records deployment IDs, source SHAs, digests, statuses, counts, and
  hashes only.
- Exact runtime identity and provider-readiness evidence come only from
  authenticated `/api/internal/ops/diagnostics`; public `/health`, `/ready`, and
  `/version` expose fixed availability codes.
- Provider transports must remain disabled, sink, mock, off, or not configured.
