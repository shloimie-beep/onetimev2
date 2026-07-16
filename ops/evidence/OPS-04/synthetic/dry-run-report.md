# OPS-04 dry-run reconciliation

task_id: OPS-04
batch_key: ops04_batch_688146befabda4df9397be3f
dry_run_hash: dbe5aab056f03c42b7906cd17483973b12ab79ffbe4a622984bae58489139e54
manifest_sha256: 752e49a5585534ca54293b0fe19b97d7ce730195c85176d27cade09cd140f252
mapping_sha256: 8c5d3445188b31a8e95dbea6616492f549ac995f022f75e85ba61ca8d20480ab
database_snapshot_key: ops04_snapshot_5023815dc2bc73b5255fc8db
approval_status: absent
production_import_authorized: false
campaign_send_authorized: false
sends_allowed: false
raw_row_contents_included: false

## Rows
- active_old_app_user_leads: 4
- already_migrated: 1
- blast_candidate: 6
- current_subscriber_read_only: 1
- duplicate_occurrences: 1
- manual_review: 7
- matched: 2
- migration_invitation_eligible: 3
- quarantine: 7
- school_leads_without_entitlement: 1
- suppressed: 1
- total: 18
- unique: 17

## Actions
- add_contact_point: 10
- add_contact_point_owner: 10
- add_tag_assignment: 11
- append_channel_state_event: 10
- append_lead_event: 8
- append_legacy_membership_event: 5
- create_contact: 9
- link_external_identity: 5
- link_source_provenance: 18
- no_op_unchanged: 2
- quarantine_manual_review: 7
- reject_insufficient_identity: 2
- set_migration_projection: 11

## Outreach
- campaigns_authorized: 0
- sends_allowed: 0
- suppressed_channels: 1

equations_balanced: true

OPS-04 dry run and rehearsals never authorize sends.
