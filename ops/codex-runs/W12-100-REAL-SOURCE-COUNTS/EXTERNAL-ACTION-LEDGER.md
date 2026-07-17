# W12-100 Real-Source Counts-Only External Action Ledger

Generated: 2026-07-17T20:41:35.3579462+03:00

## Read-Only Actions

| Action                              | Scope                                                 | Result                                                                                      |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET `/version`                      | isolated staging URL hash only                        | returned `ops11-1197673` / `1197673fa409bfc4c649c2683f782e86775caa5e`                       |
| GET `/ready`                        | isolated staging URL hash only                        | returned 200; latest migration `2190_ot109_rabbi_content_publisher`                         |
| Local environment presence check    | local shell variable names only                       | `DATABASE_URL` missing; `IMPORT_APPLY_AUTHORIZED` missing                                   |
| Local migration file existence/hash | repository file `2201_w12_01_crm_audience_import.sql` | present locally, SHA-256 `E0DC91A46D7EF1B1FC55F78AE5E0FC234C4F68F2F8F3AB1063395C22E121CDD5` |

## Mutations Not Performed

- No approved source files were opened.
- No source rows were read, printed, or committed.
- No contacts, leads, households, learners, consent records, tags, campaigns,
  outbox messages, or provider events were written.
- No production database connection was present or used.
- No apply authorization was present.
- `IMPORT_APPLY_AUTHORIZED=false`.
