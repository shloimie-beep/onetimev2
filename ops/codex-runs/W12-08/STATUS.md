# W12-08 Status

## Scope

Productize the admin dashboard, CRM entry, classroom list/detail, and linked detail flows by replacing internal operator wording with human product states while keeping limitations truthful.

## Requirements

| ID         | Requirement                                                                                                                                                                                         | Status | Evidence                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W12-08-001 | Validate ZIP safety and hashes before extraction or edits.                                                                                                                                          | Done   | `PACKET-VALIDATION.md`; copied source files under `packet/`.                                                                                                      |
| W12-08-002 | Create clean isolated worktree and branch from the current accepted release candidate.                                                                                                              | Done   | Worktree `C:\Users\User\.w12-20260717-worktrees\W12-08`; branch `codex/w12-08-admin-classroom-productization`; base `c7d46066517d7a458d189f2c782cc06200f7861c`.   |
| W12-08-003 | Replace customer-visible technical states with product states without fabricating provider readiness.                                                                                               | Done   | Dashboard/class DTOs now use Ready/Processing/Action needed/Not connected/No data yet/Temporarily unavailable; UI copy keeps protected classroom access truthful. |
| W12-08-004 | Move technical endpoints/action registry/provider codes behind owner-only diagnostics.                                                                                                              | Done   | Dashboard normal cards render product copy; source/state/action registry details are under `Diagnostics`.                                                         |
| W12-08-005 | Make dashboard cards meaningful for leads, members, communications, upcoming class, content, support, and billing/provider state.                                                                   | Done   | `packages/domain/src/dashboard/service.ts`; `apps/web/src/client/app/crm-entry.tsx`; focused dashboard integration test.                                          |
| W12-08-006 | Make classroom list/detail usable with protected access, enrolled counts, attendance/progress, content association, review sheets, questions, and failure states; never expose raw Zoom/Vimeo URLs. | Done   | Class summary/detail contracts and service rollups; class list/detail UI; focused class integration test asserts no raw provider URLs.                            |
| W12-08-007 | Normalize mobile/desktop controls and route/action coverage.                                                                                                                                        | Done   | Shared brand CSS state classes/detail grid; static and runtime action registry coverage for class detail/back controls.                                           |
| W12-08-008 | Run focused verification, record final evidence, push, and open draft PR.                                                                                                                           | Done   | Local verification complete; branch pushed; draft PR `https://github.com/webcraft-media/onetimev2/pull/67` opened. No deploy.                                     |

## Verification

- `npm ci` - passed, 0 vulnerabilities.
- `npm run typecheck` - passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/dashboard/owner-dashboard.test.ts tests/integration/classes/class-fulfillment.test.ts` - passed, 2 files / 9 tests.
- `npm run brand:check` - passed; build budget skipped because dist bundle was not present.
- `npm run secret:scan` - passed.
- `npm run lint` - passed.
- `npm run unit` - passed, 37 files / 189 tests.
- `npx prettier --check <touched files>` - passed.
- `npm run format` - existing repository-wide format check still fails on 830 inherited files; touched W12-08 files pass targeted Prettier check.

## External Mutations

- Deployment: not run.
- Production data mutation: not run.
- Provider canaries/sends/imports: not run.
