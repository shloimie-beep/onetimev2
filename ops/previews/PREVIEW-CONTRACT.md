# Preview Contract

Every app-visible pull request in `shloimie-beep/onetimev2` must have an isolated Railway PR Environment URL before the UI task is complete.

## Required Rule

- Each app-visible PR gets an isolated Railway PR Environment.
- Each PR description contains a `Preview URL:` field.
- The preview uses fictional, demo, or copied isolated staging data.
- Production credentials and production data are never copied into PR environments.
- The PR environment is deleted when the pull request closes.
- Shared persistent staging is controlled by one convergence conductor only.
- Feature branches never overwrite shared staging.
- A UI task is not complete without a clickable preview.
- Backend-only lanes may use a health or readiness preview URL.
- Preview failures are reported as one exact blocker.
- GitHub Actions must not be the only preview mechanism while the account has a billing or spending-limit runner blocker.
- Railway's GitHub integration owns PR Environment creation.

## Railway Baseline

PR Environments must be enabled on the existing One Time Railway staging project with the base environment set to the isolated `staging` environment, not production.

```text
project_id: 7c8eee26-7a6a-4684-826d-9f4377d67d46
base_environment: staging
base_environment_id: 11edf8a2-0160-45b4-a039-b15b4beb4c10
web_service_id: 9fb6d9f4-4f50-4df6-868b-c18a9b83d2f2
worker_service_id: 76e7fdc2-99b9-4a82-ba55-5dff3723398f
web_base_domain: ot99-web-staging.up.railway.app
```

## PR Body Field

Every app-visible PR body must include exactly one of these forms:

```text
Preview URL: https://...
Preview URL: BLOCKED(RAILWAY_PR_ENVIRONMENTS_NOT_ENABLED_OR_SOURCE_NOT_CONNECTED)
```

`BLOCKED(...)` is temporary and must be replaced with a live Railway URL after PR Environments are enabled and Railway creates the environment.

## Data Mode

Allowed preview database modes:

- `fixture_demo_database`
- `copied_isolated_staging_database`
- `backend_health_only`

Disallowed preview database modes:

- `production_database`
- `production_clone_with_live_credentials`
- `shared_persistent_staging_overwritten_by_feature_branch`

## Verification Commands

```bash
npm run preview:discover
npm run preview:check
```

`preview:discover` refreshes `ops/previews/current.json` from GitHub and Railway CLI evidence when available.
`preview:check` verifies that the preview registry and current handoff report either live URLs or one exact blocker.
