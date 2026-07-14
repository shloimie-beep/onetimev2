# OT-60R Integration Manifest

## Base

- `codex/crm-core-v1`: `4ac288968ba24e30a5c3f8c6924f492eedf4338f`

## Planned Inputs

| PR  | Commit                                     | Initial Status | Integration Decision                      |
| --- | ------------------------------------------ | -------------- | ----------------------------------------- |
| #5  | `6ca5e568c328ea116a9413b57ea5920400f8bc14` | Audited        | Applied with semantic merge               |
| #7  | `c1584577780d7b5125bce4fb81d2a454c9e84096` | Audited        | Applied with semantic merge               |
| #11 | `b2c159a060d8aa50ec6feb69f1cae003fd633bf3` | Audited        | Applied as additive unmounted module      |
| #4  | `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae` | Audited        | Applied with range order                  |
| #8  | `571b18f36cdc645f757cc3be6b0519f1af3225f6` | Audited        | Applied as delivery correction            |
| #14 | `76cae19be515ee896f22d0da976082a09d1d25d6` | Audited        | Applied with shared app wiring            |
| #12 | `f4e4fb1dc202f8b17bbf1747c82ae3b0c1c5c899` | Audited        | Pending                                   |
| #15 | `9594c228b9ac3047f42bb9e8c804384cc45a3e40` | Audited        | Pending                                   |
| #13 | `e235af05759f0a97496552c6e8aabed7ba3eee18` | Audited        | Pending                                   |
| #6  | `0ea782d8551c26edd48b08d644b573e19b9835b1` | Audited        | Pending                                   |
| #10 | `9444176dbc55e0c5af048ec1df2ea75ffa8dde33` | Audited        | Evidence-only, defer implementation claim |

## Supersession Inputs

| Input         | Rule                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| PR #3 / OT-34 | Do not merge blindly; compare against canonical PR #2 security model.                                             |
| PR #9 / OT-38 | Do not import alternate migration/model; port only a verified missing HMAC login-CSRF property if PR #2 lacks it. |

Result: PR #3/#9 alternate trains are superseded. Only the verified missing HMAC login-CSRF property from PR #9 was ported.

## Applied Units

| Input                           | Result                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR #5 / OT-35                   | Applied. Resolved `apps/web/src/client/app/crm-entry.tsx` against the canonical PR #2 API model, kept POST `/api/v1/crm/contacts/search`, omitted blank search filters, preserved idempotent contact creates, and kept production auth rate-limit defaults while raising Playwright-only test budgets.                                           |
| PR #7 / OT-39                   | Applied. Kept PR #7 client API extraction, privacy tests, post-paint usability marks, list-cache return behavior, accessibility/performance evidence, and OT-35 supersession sentinels while adapting disabled-search assumptions to canonical POST-body search and body idempotency keys.                                                       |
| PR #11 / OT-42                  | Applied. Accepted contracts, schemas, capability/domain helpers, migration `1000_ot42_crm_module_v1.sql`, injectable CRM router/register hooks, protected client cache, lazy tab loader, and focused unit/integration tests. Did not mount the abstract router into live CRM routes because concrete repository implementations are not present. |
| PR #4 / OT-36 and PR #8 / OT-40 | Applied. Cherry-picked the OT-36 range in order, then OT-40 correction, keeping sink/mock delivery worker semantics, deterministic outbox intents, corrected migration `0004`, and no real provider activation.                                                                                                                                  |
| PR #14 / OT-44                  | Applied. Integrated communications contracts/domain/server/client/tests and additionally wired the shared app with a read-only session resolver plus lazy CRM shell route/contact view while preserving no default Communications prefetch from CRM overview.                                                                                    |
