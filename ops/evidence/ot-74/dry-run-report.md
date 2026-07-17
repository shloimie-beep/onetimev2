# OT-74 Synthetic Dry-Run Report

Rows checked: 10000
Unique rows: 9999
Duplicate rows: 1

No real spreadsheets were ingested. No row contents are printed.

```json
{
  "report_kind": "ot74_audience_reconciliation_dry_run",
  "source_batch_key": "synthetic_batch_10000",
  "row_count": 10000,
  "unique_row_count": 9999,
  "duplicate_row_count": 1,
  "status_counts": {
    "matched_existing": 1,
    "new_contact_candidate": 9994,
    "manual_review": 3,
    "duplicate_input": 1,
    "blocked_do_not_contact": 1
  },
  "segment_counts": {
    "migration_invite_eligible": 9994,
    "active_legacy_user": 3335,
    "manual_review": 4,
    "school_follow_up": 1,
    "do_not_contact": 1
  },
  "reason_counts": {
    "duplicate_row_fingerprint": 1,
    "email_match": 2,
    "phone_match": 2,
    "email_phone_conflict": 1,
    "multiple_identity_matches": 0,
    "missing_reconcilable_identity": 1,
    "name_only_match_forbidden": 1,
    "school_follow_up_required": 1,
    "suppression_blocks_contact": 1,
    "archived_contact": 1,
    "invalid_email": 1,
    "invalid_phone": 0,
    "replay_same_batch_row": 0,
    "new_identity_candidate": 9995
  },
  "rollback_plan": {
    "rollback_plan_key": "audrollbackplan_b5396fa0b4cc20868b5d0876",
    "reversible_records": 10000,
    "destructive_contact_deletes": 0,
    "actions": [
      {
        "action": "mark_import_batch_rolled_back",
        "record_count": 1
      },
      {
        "action": "remove_segment_assignments",
        "record_count": 13335
      },
      {
        "action": "clear_reconciliation_links",
        "record_count": 10000
      }
    ]
  },
  "external_mutation_counts": {
    "production_database_writes": 0,
    "messages_sent": 0,
    "provider_mutations": 0,
    "real_spreadsheets_ingested": 0
  }
}
```
