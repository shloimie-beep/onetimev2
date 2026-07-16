# OPS-04C Conflict Ledger

## Merge and integration conflicts resolved

| Area                         | Conflict                                                                                                  | Resolution                                                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration IDs                | OPS-03B and multiple leaves introduced `2010_*` migrations.                                               | Kept OPS-03B at `2010`; renumbered OT-101R to `2011`, OT-104R to `2012`, OT-110A to `2013`, and OT-111 to `2014`; updated migration foundation tests and OT-74 migration references.                               |
| Content contract exports     | OT-104R, OT-109, and OT-110A each expanded content exports.                                               | Preserved all exports in `packages/contracts/src/content/index.ts` and `packages/domain/src/index.ts`.                                                                                                             |
| Web app auth/content imports | OPS-03B removed active authenticator flow while OT-110A added admin Content route helpers.                | Kept email assurance helpers and OT-110A route helpers; did not restore active TOTP imports or flows.                                                                                                              |
| Content provider ports       | OT-110A shipped provider-off ports while OT-104R, OT-101R, OT-106, and OT-107 provided runtime readiness. | Added `createOt110aIntegratedProviderPorts(config)` and used it for admin Content routes; all provider statuses remain no-mutation.                                                                                |
| OT-109 content visibility    | OT-109 publisher records lived outside `onetime.content_items`.                                           | Added read-only bridge from `onetime.ot109_sources` into admin source summaries, fixed to `rabbi_sheller_provider` / `one_time_mishnah_class`, and kept bridge-only records out of OT-110A generation eligibility. |
| OT-110A tests                | Original OT-110A API test assumed TOTP owner login.                                                       | Updated to OPS-03B email challenge flow by decrypting the local sink challenge payload in tests.                                                                                                                   |
| Browser auth label           | New `Email code` label made Playwright `getByLabel('Email')` ambiguous.                                   | Changed visible label to `Verification code`; field id/name and client behavior remain unchanged.                                                                                                                  |
| OT-83R e2e labels            | Student route test expected old `Question` / `Submit question` labels.                                    | Updated test to current private-question preview and send flow.                                                                                                                                                    |

## Non-conflicts left untouched

- Generated visual/performance evidence files from local Playwright runs were restored and not committed because OPS-04C owns only the integration branch and `ops/codex-runs/OPS-04C` checkpoint files.
- No BNA files were edited.
- No production, provider, payment, DNS, broad-send, or customer-import mutation was performed.
