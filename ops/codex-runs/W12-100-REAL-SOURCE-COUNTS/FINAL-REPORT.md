# W12-100 Real-Source Counts-Only Acceptance Report

Generated: 2026-07-17T20:41:35.3579462+03:00

Status: `blocked_before_source_processing`

## Summary

The counts-only real-source acceptance was not run because the first staging
prerequisite failed.

- Expected W12-100 SHA:
  `ac02ce9cd4f690d3b305b30ec1eef4e18d48cd5c`
- Observed staging `/version` SHA:
  `1197673fa409bfc4c649c2683f782e86775caa5e`
- Required staging migration: `2201_w12_01_crm_audience_import`
- Observed staging latest migration: `2190_ot109_rabbi_content_publisher`

The local worktree contains the `2201_w12_01_crm_audience_import.sql` migration,
but isolated staging has not applied it. Because exact W12-100 code and
migration 2201 are not present in isolated staging, the approved six-file source
group was not opened and no counts were computed.

## Counts

Acceptance counts are not computed for this blocked run. `COUNTS.json` records
`source_files_processed=0`, all row/category counts as `null`, and all write
counts as `0` so the result cannot be mistaken for a successful zero-row import.

## Safety

- No production database connection was present.
- No apply authorization was present.
- No source contents or row values were printed or committed.
- No contacts, leads, households, learners, consent records, tags, campaigns,
  outbox messages, or provider events were written.
- `IMPORT_APPLY_AUTHORIZED=false`

## Next Action

Deploy exact W12-100 code to isolated staging, apply migrations through
`2201_w12_01_crm_audience_import` or later, verify `/version` and `/ready`, then
rerun counts-only acceptance against the approved six-file source group.
