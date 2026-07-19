# Production Launch Spine Read-Only Route Readback

Generated: 2026-07-19T13:23:06.588Z

Target: https://join.onetimeonetime.com

Status: passed

JSON SHA-256: `fb76363c92af59a4c8a62121b93fb4f229e1a60313f4df6a4b0f8ab14639151a`

| Probe                      | Path                            | Status | HTTP | Latency ms |
| -------------------------- | ------------------------------- | ------ | ---: | ---------: |
| version                    | /version                        | passed |  200 |        710 |
| health                     | /health                         | passed |  200 |        510 |
| ready                      | /ready                          | passed |  200 |        278 |
| public_landing             | /                               | passed |  200 |        231 |
| public_signup              | /signup                         | passed |  200 |        246 |
| login                      | /login                          | passed |  200 |        422 |
| activate                   | /activate                       | passed |  200 |        258 |
| forgot_password            | /forgot-password                | passed |  200 |        230 |
| reset_password             | /reset-password                 | passed |  200 |        251 |
| privacy                    | /privacy                        | passed |  200 |        250 |
| terms                      | /terms                          | passed |  200 |        251 |
| missing_route_404          | /w13-104-missing-route-readonly | passed |  404 |        428 |
| anonymous_dashboard_denial | /app/dashboard                  | passed |  302 |        232 |
| anonymous_crm_denial       | /app/crm                        | passed |  302 |        229 |
| anonymous_parent_denial    | /app/parent                     | passed |  302 |        230 |
| anonymous_student_denial   | /app/student                    | passed |  302 |        250 |

Safety: production_database_writes=0, crm_import_applies=0, emails_sent=0, provider_mutations=0, deployments=0, form_submits=0, setup_or_reset_links_consumed=0, response_bodies_committed=false.
