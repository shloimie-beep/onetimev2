# OT-37 PostgreSQL Assurance Report

Generated: 2026-07-14T23:58:43.008Z

Repository: webcraft-media/onetimev2

Base commit: 4ac288968ba24e30a5c3f8c6924f492eedf4338f

Node: v24.18.0

PostgreSQL: PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit

## Migration

- Files discovered: 8
- Ledger matches checksums: true
- Idempotent verification statuses: already_applied:0001_onetime_lead_slice, already_applied:0002_crm_auth_core, already_applied:0003_ot27_security_crm_repair, already_applied:0004_delivery_worker_claim_index, already_applied:1000_ot42_crm_module_v1, already_applied:1300_ot46_billing_foundation, already_applied:1500_ot52_portal_households_learners, already_applied:1600_ot51_telegram_bot_foundation

## Synthetic Scale

- Contacts: 10600
- Signups: 500
- Outbox rows: 500
- Synthetic evidence scan: passed_reserved_domains_only

## Query Plans

| Scenario | Execution ms | Uses index | Uses seq scan | Expected-open count |
|---|---:|---:|---:|---:|
| crm_default_updated_desc | 0.059 | true | false | 0 |
| crm_name_sort | 0.058 | true | false | 0 |
| crm_created_desc | 8.841 | false | true | 2 |
| crm_search_leading_wildcard | 12.494 | true | false | 1 |
| crm_status_filter | 0.066 | true | false | 0 |
| crm_classification_filter | 0.06 | true | false | 0 |
| crm_source_filter | 0.043 | true | false | 0 |
| crm_assigned_user_filter | 0.063 | true | false | 0 |

## Performance

These are DB/API-compatible query timings, not browser or LCP results.

| Scenario | p50 ms | p75 ms | p95 ms |
|---|---:|---:|---:|
| db_list_default | 0.579 | 0.65 | 0.804 |
| db_contact_detail | 0.674 | 0.719 | 1.285 |
| db_search_leading_wildcard | 13.776 | 18.978 | 26.03 |

## Concurrency

| Scenario | Status | Participants |
|---|---|---:|
| simultaneous_idempotency_insert | passed | 6 |
| simultaneous_duplicate_contact_create | passed | 6 |
| skip_locked_worker_claims | passed | 4 |
| durable_throttling_current_base | skipped_current_base | 0 |

## Expected-Open Findings

| ID | Finding |
|---|---|
| DATA-008 | Migration backfill remains unranked for multi-signup contacts. |
| PERF-003 | CRM search and some source/assignee/created sort modes lack matching indexes. |
| PERF-005 | Real PostgreSQL migration and query-plan evidence was absent before OT-37. |
| DURABLE-THROTTLE-MISSING | The current base has process-local throttling and no durable throttle table to exercise. |
| PERF-003 | PERF-003 created_desc sort lacks a matching scoped composite index. |
| PERF-003 | PERF-003 crm_created_desc used a sequential scan at synthetic scale. |
| PERF-003 | PERF-003 leading-wildcard CRM search has no matching expression/trigram index. |
| simultaneous_idempotency_insert | DATA-004 table uniqueness works, but current domain replay path does not compare request_hash. |
| simultaneous_duplicate_contact_create | DATA-005 database uniqueness prevents duplicate rows, but current manual create has no idempotent replay contract. |
| durable_throttling_current_base | DURABLE-THROTTLE-MISSING |

External mutations: production database=false, Railway=false, providers=false, sends=false.
