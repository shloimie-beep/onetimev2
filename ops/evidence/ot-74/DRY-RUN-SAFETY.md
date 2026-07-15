# OT-74 Dry-Run Safety

## Inputs

- CSV parser accepts synthetic normalized CSV strings.
- XLSX-shaped mapper accepts synthetic normalized worksheet row objects.
- No binary spreadsheet reader or file-path ingestion is provided.

## Matching

- Matching uses normalized email and normalized phone only.
- Matching is scoped to the One Time `account_key` and `product_key`.
- Name-only matching is forbidden and produces manual review.
- Email/phone conflicts and ambiguous candidates produce manual review.

## Output

- CLI output contains aggregate counts and reason/segment counts only.
- Router responses omit row outcomes and raw rows.
- Stored row records preserve source row number, sheet label, row fingerprint, identity fingerprint, booleans, disposition, reason codes, and segment codes.
- Raw spreadsheet row contents are not stored by OT-74.

## Segments

- `migration_invite_eligible`
- `active_legacy_user`
- `manual_review`
- `school_follow_up`
- `do_not_contact`

All segment contracts set `sends_allowed: false`.
