# ONE-TIME-FINISH-NOW Staging Runtime Proof Report

Generated: 2026-07-19T12:21:14Z

Status: `accepted_for_pr92_staging_candidate`

## What Ran

- Deployed PR #92 head `ee9929008fc0068b3dcf9b86d11e7c21d1331c93` to
  staging web and worker.
- Verified staging `/version` exposed non-secret Railway deployment identity.
- Rolled staging back to W13-104 source
  `688fc70cf64b72bc52f4ea7511d8593750d7ab45`.
- Verified rollback `/version`, `/health`, `/ready`, `/`, `/signup`, `/login`,
  `/activate`, and `/forgot-password`.
- Rolled staging forward to PR #92 head.
- Verified final staging `/version.deployment.deployment_id` matched the
  serving Railway web deployment.

## Deployment Identities

Initial PR #92 staging deploy:

- Web: `e067ebfb-e8c5-42ca-bb71-01432a6e3e9a`
- Worker: `d19e7000-da9d-47bc-a57a-3a673aa15c6c`

Rollback to W13-104:

- Web: `d892a8fa-92a1-4b73-aa38-b4b0ad063894`
- Worker: `a296f5ec-b069-4fb2-ac8a-c0d7568f04a7`
- Web image digest:
  `sha256:4f8a8e76f62ad24318f87ba496cdbf79a122d8b66905a34969304d96b7bee5d5`
- Worker image digest:
  `sha256:da62398c2a4163393558935c30656f09936fb433a0db00b2deb52a026f35154a`

Final roll-forward to PR #92:

- Web: `c464ea23-649b-4c8d-b4af-0d10c5ce3022`
- Worker: `17f1970a-ec19-4fa8-8152-573b47f470ab`
- Web image digest:
  `sha256:25d58d4a0661393a3d3d81e172dde87b610d8b97437162969615646e5c943234`
- Worker image digest:
  `sha256:b213c58070b8d40b612351c5748bdf82e72b655014f8cc83e35a1ab0501a616d`

Final staging `/version.deployment`:

- `deployment_id`: `c464ea23-649b-4c8d-b4af-0d10c5ce3022`
- `snapshot_id`: `14354877-0df6-45e1-806a-47dbcf53b61c`
- `project_id`: `7c8eee26-7a6a-4684-826d-9f4377d67d46`
- `environment_id`: `11edf8a2-0160-45b4-a039-b15b4beb4c10`
- `service_id`: `9fb6d9f4-4f50-4df6-868b-c18a9b83d2f2`
- `git_commit_sha`: `null`

## Acceptance

Rollback is accepted for the PR #92 staging candidate. The rollback target was
the predeploy W13-104 runtime, so rollback `/version.commit_sha` matched
`688fc70cf64b72bc52f4ea7511d8593750d7ab45`, the rollback image digests matched
the known W13-104 staging images, and all smoke routes passed. Roll-forward then
returned staging to PR #92, with `/version.deployment.deployment_id` matching
the serving Railway web deployment and all smoke routes passing.

Railway did not populate `RAILWAY_GIT_COMMIT_SHA` for these CLI source deploys.
The PR #92 source binding therefore relies on the exact detached deploy
worktrees, deployment CLI messages, Railway deployment IDs, image digests, and
the runtime `/version.deployment` readback.

## External Effects

- Staging deployments: 6
- Production deployments: 0
- Production database writes: 0
- CRM import applies: 0
- Provider mutations: 0
- External sends: 0
- Live Stripe charges: 0
- DNS changes: 0

## Evidence

- `staging-runtime-proof/SUMMARY.json`
- `staging-runtime-proof/pre-deploy-http.json`
- `staging-runtime-proof/post-deploy-http.json`
- `staging-runtime-proof/rollback-http.json`
- `staging-runtime-proof/roll-forward-http.json`
- `staging-runtime-proof/post-deploy-deployments.web.json`
- `staging-runtime-proof/post-deploy-deployments.worker.json`
- `staging-runtime-proof/rollback-deployments.web.json`
- `staging-runtime-proof/rollback-deployments.worker.json`
- `staging-runtime-proof/roll-forward-deployments.web.json`
- `staging-runtime-proof/roll-forward-deployments.worker.json`
- `staging-runtime-proof/final-deployments.web.json`
- `staging-runtime-proof/final-deployments.worker.json`
- `staging-runtime-proof/final-production-deployments.web.json`
- `staging-runtime-proof/final-production-deployments.worker.json`
