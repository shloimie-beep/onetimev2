# ONE-TIME-FINISH-NOW Staging Rollback Report

Generated: 2026-07-19T14:09:28+03:00

Status: `partial_not_accepted_version_endpoint_not_source_authoritative`

## What Ran

- Staging web rollback source deploy:
  `fb17f301-0442-45a8-ae81-77e8a932ee63`
- Staging worker rollback source deploy:
  `cf5d7d66-478a-4582-afb1-c5a474effff0`
- Staging web roll-forward deploy:
  `e32187d8-a32b-401d-ae8a-37d87af1a203`
- Staging worker roll-forward deploy:
  `9f49ae76-3daf-4813-b01d-20e11867564a`

Rollback source:
`007e0215d1186ca51163dea3b1c15303bf52a860`.

Roll-forward source:
`688fc70cf64b72bc52f4ea7511d8593750d7ab45`.

## Result

The staging source-rebuild rollback and roll-forward path was exercised, and
staging was restored to W13-104. The roll-forward smoke passed `/version`,
`/health`, `/ready`, `/`, `/signup`, `/login`, `/activate`, and
`/forgot-password`.

The rollback gate is still not accepted because `/version` remained W13-104
during the rollback-source deploy. The current app reports `APP_VERSION` and
`COMMIT_SHA` from runtime environment values, so `/version` does not
independently prove the deployed source after a source-rebuild rollback unless
the environment values are also updated or another source-authoritative runtime
signal is added.

## External Effects

- Staging deployments: 4
- Production deployments: 0
- Production database writes: 0
- CRM import applies: 0
- Provider mutations: 0
- External sends: 0
- Live Stripe charges: 0
- DNS changes: 0

## Evidence

- `staging-rollback/SUMMARY.json`
- `staging-rollback/pre-rollback-http.json`
- `staging-rollback/rollback-deploy.web.output.txt`
- `staging-rollback/rollback-deploy.worker.output.txt`
- `staging-rollback/rollback-http.json`
- `staging-rollback/roll-forward-deploy.web.output.txt`
- `staging-rollback/roll-forward-deploy.worker.output.txt`
- `staging-rollback/final-deployments.web.json`
- `staging-rollback/final-deployments.worker.json`
- `staging-rollback/roll-forward-http.json`
- `staging-rollback/roll-forward-route-statuses.curl.json`
- `staging-rollback/final-railway-status.json`
- `staging-rollback/post-rehearsal-production-readonly.json`
