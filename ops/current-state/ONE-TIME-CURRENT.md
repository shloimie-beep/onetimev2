# One Time Current State

Generated from the operator packet at SHA-256
`08d341bb4f6d9a51ad14824d5e9640feeb65de5db8f774eccf62740297309c53`.
The canonical repository is `shloimie-beep/onetimev2`; the former
`webcraft-media/onetimev2` remote is explicitly excluded.

## Runtime Readback

| Surface            | Source SHA                                          | Latest migration                      | Health | Tisha B'Av                                    |
| ------------------ | --------------------------------------------------- | ------------------------------------- | ------ | --------------------------------------------- |
| Production         | `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`          | `2204_w12_100_real_source_crm_apply`  | Pass   | Not deployed                                  |
| Persistent staging | `944f46b5435d648e6e175c69746ca7a4895ffec4`          | `2209_class_series_scope_unique`      | Pass   | Not integrated                                |
| PR #102 preview    | reported `944f46b5435d648e6e175c69746ca7a4895ffec4` | `2211_tisha_bav_provider_event_scope` | Pass   | `/tisha-bav` and `/tisha-bav/live` return 200 |

The clean integration worktree is
`C:\Users\User\.onetime-worktrees\FULL-APP-STAGING-LIVE` on
`codex/full-app-staging-live` at
`2f62a2af6c42e7f05ed43a82bd5c0a938fcceb38`.

## Current Gate

HighLevel assets and OT-E01 must be read back through the official API before
the single operator-owned event confirmation and the narrow production release.
OT-C01 remains draft with no audience and no sends. The complete full
application remains staging-only.

## Integration Order

1. PR #97 current staging base.
2. PR #101 unique Vimeo autotrim/transcription patch.
3. PR #100 Rabbi Live Console after migration renumbering.
4. PR #102 Tisha B'Av funnel.
5. PR #99/#103 HighLevel foundation and registry deltas not already present.

The authoritative machine-readable record is `ONE-TIME-CURRENT.json`. PR
supersession is tracked separately in `PR-SUPERSESSION-MAP.json`.
