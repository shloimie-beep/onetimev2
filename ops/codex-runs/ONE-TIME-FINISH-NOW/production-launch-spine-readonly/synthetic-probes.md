# OPS-06 Synthetic Probes

Generated: 2026-07-19T15:55:29.845Z

Target: https://join.onetimeonetime.com

Status: blocked

| Probe                                  | Status  | HTTP | Latency ms | Detail                                                                |
| -------------------------------------- | ------- | ---: | ---------: | --------------------------------------------------------------------- |
| public_landing                         | passed  |  200 |        736 | expected=200                                                          |
| public_signup                          | passed  |  200 |        417 | expected=200                                                          |
| auth_lifecycle_login_page              | passed  |  200 |        420 | expected=200                                                          |
| private_session_role_denial            | passed  |  302 |        278 | expected=302/401/403                                                  |
| db_readiness                           | passed  |  200 |        273 | readiness dependency payload present                                  |
| worker_heartbeat_and_queue_diagnostics | blocked |      |            | OPERATIONS_PROBE_TOKEN is required for protected machine diagnostics. |

External mutations: production_database=false, providers=false, sends=false, deployment=false.
