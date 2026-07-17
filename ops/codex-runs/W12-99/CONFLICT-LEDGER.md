# W12-99 Conflict Ledger

Generated: 2026-07-17T15:56:23+03:00

## Summary

Git produced no textual merge conflicts while merging W12-00, W12-07, W12-08, W12-01, W12-02, W12-03, W12-04, W12-05, and W12-06 in the requested order. W12-99 still found shared-file and semantic conflicts that required review.

## Shared Files

| File                                             | Lanes                  | Resolution                                                                                                                       |
| ------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/server/app.ts`                     | W12-03, W12-06         | Accepted merged server composition and verified portal, support, WhatsApp, auth, CRM, and public routes through integration/E2E. |
| `ops/day-one/visible-action-registry.json`       | W12-03, W12-08         | Accepted additive registry coverage and verified action/route gates through unit/E2E coverage.                                   |
| `packages/config/src/index.ts`                   | W12-03, W12-05, W12-06 | Accepted merged config surface; provider secrets remain name-only/default-off.                                                   |
| `packages/domain/src/content/admin-workspace.ts` | W12-04, W12-05         | Accepted merged admin/content workspace behavior; no provider mutation enabled.                                                  |
| `packages/domain/src/index.ts`                   | W12-02, W12-06         | Accepted additive exports and verified typecheck/unit/integration.                                                               |

## Semantic Conflicts

| ID                | Area                          | Finding                                                                                                               | Resolution                                                                                          | Verification                                                                                |
| ----------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| W12-99-MIG-001    | Migration numbering           | W12-02 and W12-05 both introduced prefix `2200`.                                                                      | Renamed W12-05 migration to `2202_w12_05_telegram_operations.sql` and updated W12-05 run artifacts. | Duplicate-prefix check returned no output; integration passed.                              |
| W12-99-PUBLIC-001 | Public privacy/cache contract | Public WhatsApp launcher used browser `sessionStorage`, violating the public bundle no-storage contract.              | Replaced persistence with in-memory `assistantDismissed`.                                           | `tests/integration/accounts/account-lifecycle-web.test.ts` passed; full integration passed. |
| W12-99-TEST-001   | Browser gate reliability      | Support E2E/a11y login helpers waited for `networkidle`, which could return before the login redirect/cookie settled. | Switched helpers to wait for `**/app/support`, matching existing portal helpers.                    | Focused support E2E/a11y passed; full E2E/accessibility passed.                             |

## Scope Exclusions

- W12-09 gamification was not merged and must not be claimed as integrated.
- OPS-13A was the wrong prompt in this thread; it produced no usable preflight for W12-99.
- BNA P1/P2/P3 work was not merged into One Time.
- No real CRM import, real provider acceptance, live sends, live publication, production promotion, or staging deploy was performed by W12-99.
