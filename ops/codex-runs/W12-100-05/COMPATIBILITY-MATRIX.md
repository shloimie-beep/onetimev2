# W12-100-05 Compatibility Matrix

Generated: 2026-07-17T15:01:14.404Z

Evidence is limited to hashes, counts, statuses, timings, and synthetic fixture behavior. Production mutations and external actions are zero.

| Capability                             | PG16               | PG18               | Evidence                                                                    | Stop condition                                          |
| -------------------------------------- | ------------------ | ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| transition_static_plan                 | blocked: no target | blocked: no target | migration inventory, target path/order checksum inputs                      | see report stop_conditions                              |
| postgres16_disposable_rehearsal        | blocked: no target | blocked: no target | No disposable PostgreSQL 16 target was configured in this environment.      | see report stop_conditions                              |
| postgres18_disposable_rehearsal        | blocked: no target | blocked: no target | No disposable PostgreSQL 18 target was configured in this environment.      | see report stop_conditions                              |
| clean_database_migration               | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | see report stop_conditions                              |
| upgrade_from_2190                      | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | see report stop_conditions                              |
| checksum_verification                  | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | checksum_mismatch                                       |
| repeat_idempotence                     | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | non_idempotent_result                                   |
| transactional_failure                  | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | see report stop_conditions                              |
| constraint_compatibility               | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | data_incompatibility/startup_or_rolling_incompatibility |
| telegram_existing_row_compatibility    | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | data_incompatibility/startup_or_rolling_incompatibility |
| foreign_key_ordering                   | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | see report stop_conditions                              |
| index_creation_behavior                | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | see report stop_conditions                              |
| lock_acquisition_blocking              | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | lock_timeout_or_blocking_risk                           |
| app_startup_before_after               | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | data_incompatibility/startup_or_rolling_incompatibility |
| rolling_web_worker_compatibility       | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | data_incompatibility/startup_or_rolling_incompatibility |
| backup_restore_clone                   | blocked: no target | blocked: no target | No disposable PostgreSQL target evidence was available in this environment. | see report stop_conditions                              |
| forward_corrective_migration_procedure | blocked: no target | blocked: no target | FORWARD-ROLLBACK-PLAN.md, STAGING-MIGRATION-RUNBOOK.md                      | see report stop_conditions                              |
