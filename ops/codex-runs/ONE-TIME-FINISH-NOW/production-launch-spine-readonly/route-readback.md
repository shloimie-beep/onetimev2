# Production Launch Spine Read-Only Route Readback

Generated: 2026-07-19T15:56:29.135Z

Target: https://join.onetimeonetime.com

Status: passed

JSON SHA-256: `120b0a9129c8937b679cb7016b0be510e855eead26d689561e7781db8988f1e9`

| Probe                      | Path                                        | Status | HTTP | Latency ms |
| -------------------------- | ------------------------------------------- | ------ | ---: | ---------: |
| version                    | /version                                    | passed |  200 |        563 |
| health                     | /health                                     | passed |  200 |        493 |
| ready                      | /ready                                      | passed |  200 |        294 |
| public_landing             | /                                           | passed |  200 |        231 |
| public_signup              | /signup                                     | passed |  200 |        260 |
| login                      | /login                                      | passed |  200 |        424 |
| activate                   | /activate                                   | passed |  200 |        236 |
| forgot_password            | /forgot-password                            | passed |  200 |        231 |
| reset_password             | /reset-password                             | passed |  200 |        230 |
| privacy                    | /privacy                                    | passed |  200 |        250 |
| terms                      | /terms                                      | passed |  200 |        273 |
| missing_route_404          | /one-time-finish-now-missing-route-readonly | passed |  404 |        428 |
| anonymous_dashboard_denial | /app/dashboard                              | passed |  302 |        254 |
| anonymous_crm_denial       | /app/crm                                    | passed |  302 |        226 |
| anonymous_parent_denial    | /app/parent                                 | passed |  302 |        229 |
| anonymous_student_denial   | /app/student                                | passed |  302 |        259 |

Safety: production_database_writes=0, crm_import_applies=0, emails_sent=0, provider_mutations=0, deployments=0, form_submits=0, setup_or_reset_links_consumed=0, response_bodies_committed=false.
