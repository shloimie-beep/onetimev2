# HighLevel Workflow Control Report

> Generated from the canonical Git registry plus committed sanitized GHL readbacks. Do not edit this report by hand.

GitHub desired state: **canonical**. Observed GHL readback: 2026-07-22T09:09:54.117Z.

Summary: 19 canonical workflows; 1 ACTIVE_TESTED; 10 DRAFT_SHELL; 8 SAVED_REOPENED; 0 DRIFTED; 0 unknown.

Organized folders prove location only. They do not prove triggers, actions, activation, enrollment, delivery, or canary success.

## Canonical folder order

- 00 — 00 - Intake & Data
- 10 — 10 - Enrollment & Nurture
- 20 — 20 - Billing & Access
- 30 — 30 - Portal Lifecycle
- 40 — 40 - Learning Operations (Classes, Content)
- 45 — 45 - Events (2026 / Tisha B'Av 2026)
- 50 — 50 - Support
- 60 — 60 - Bot Actions
- 90 — 90 - Internal Operations
- 99 — 99 - Deprecated

Folder readback: **MATCHED**.

## Workflow control

|   # | Key    | Folder                               | Desired        | Observed       | GHL ID                               | Configuration proof                         | Canary                                                                                          | Blocker / drift                                                                               |
| --: | ------ | ------------------------------------ | -------------- | -------------- | ------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
|   1 | OT-01  | 00 - Intake & Data                   | DRAFT_SHELL    | DRAFT_SHELL    | 95a6f461-1a04-4260-b379-246fdcc45af7 | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: deployed adult signup event dispatcher is absent.                 |
|   2 | OT-02A | 10 - Enrollment & Nurture            | SAVED_REOPENED | SAVED_REOPENED | 368d47ca-c6d2-4545-acb0-664f98bac8f2 | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Approved migration audience, cadence, and controlled-test authorization are absent.           |
|   3 | OT-02B | 10 - Enrollment & Nurture            | SAVED_REOPENED | SAVED_REOPENED | a7038e32-79d2-4d2d-b103-5722ab0abcfc | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Approved nurture audience, cadence, content, and controlled-test authorization are absent.    |
|   4 | OT-03  | 20 - Billing & Access                | SAVED_REOPENED | SAVED_REOPENED | b5c3e702-a7e6-415d-9ffc-fa2b0027a27f | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Checkout event, abandonment window, and payment-provider acceptance are not configured.       |
|   5 | OT-04  | 20 - Billing & Access                | SAVED_REOPENED | SAVED_REOPENED | dd1e90ea-f9bd-4c3b-97de-2230f119f38b | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Payment-active projection and protected adapter acceptance are not configured.                |
|   6 | OT-05  | 20 - Billing & Access                | SAVED_REOPENED | SAVED_REOPENED | 8c7a0a37-6747-492f-99f6-1a1fb90518de | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Payment-failure projection, approved grace timing, and provider acceptance are absent.        |
|   7 | OT-06  | 20 - Billing & Access                | SAVED_REOPENED | SAVED_REOPENED | 7421cd97-a61b-4434-b7f3-163b8cc7237c | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Cancellation projection and protected adapter acceptance are not configured.                  |
|   8 | OT-13  | 20 - Billing & Access                | SAVED_REOPENED | SAVED_REOPENED | 9459a4a1-c5fa-4912-920e-e30c86f1fbe9 | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Refund/chargeback projection and protected adapter acceptance are not configured.             |
|   9 | OT-07  | 30 - Portal Lifecycle                | DRAFT_SHELL    | DRAFT_SHELL    | fb48c3bf-7154-44c9-825e-88afb5bb7942 | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: access-confirmation companion event is absent.                    |
|  10 | OT-08  | 30 - Portal Lifecycle                | DRAFT_SHELL    | DRAFT_SHELL    | eeca2efb-41be-40a7-bbc4-ee6fe8760dd9 | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: parent-activation projection is absent.                           |
|  11 | OT-09  | 40 - Learning Operations / Classes   | DRAFT_SHELL    | DRAFT_SHELL    | bc8af9fc-22d5-4b4f-b71a-121eeff87f5b | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: confirmed-class reminder event projection is absent.              |
|  12 | OT-10  | 40 - Learning Operations / Content   | DRAFT_SHELL    | DRAFT_SHELL    | 1bca5210-a3b9-496b-b3cd-48c60c0e33ca | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: recording.available producer and GHL dispatcher are absent.       |
|  13 | OT-E01 | 45 - Events / 2026 / Tisha B'Av 2026 | ACTIVE_TESTED  | ACTIVE_TESTED  | a34ea513-4612-4f53-8bd8-49e89e6610f9 | Configured and controlled-tested            | passed: Bounded operator-owned controlled execution and replay/idempotency proof passed.        | None                                                                                          |
|  14 | OT-C01 | 45 - Events / 2026 / Tisha B'Av 2026 | SAVED_REOPENED | SAVED_REOPENED | f28d8b8a-c26a-4a4f-a9f2-d2a8e94af1ae | Saved/reopened Draft; operation not claimed | not_run: Draft preserved; no contact enrolled and no send authorized.                           | Campaign audience and send authorization are absent; observed sends and enrollments are zero. |
|  15 | OT-B01 | 60 - Bot Actions                     | DRAFT_SHELL    | DRAFT_SHELL    | 1c1c0bcd-6185-492e-819f-3b7c749d4c23 | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: typed complete-signup adapter is absent.                          |
|  16 | OT-B02 | 60 - Bot Actions                     | DRAFT_SHELL    | DRAFT_SHELL    | cc766d32-0a47-47b5-818c-de45fefa83a7 | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: typed next-class adapter is absent.                               |
|  17 | OT-B03 | 60 - Bot Actions                     | DRAFT_SHELL    | DRAFT_SHELL    | 8ff00774-82fd-42d7-992b-4e9aca0a5091 | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: typed member-login companion adapter is absent.                   |
|  18 | OT-B04 | 60 - Bot Actions                     | DRAFT_SHELL    | DRAFT_SHELL    | 9f96c105-a298-4b5d-a5e5-8c573624d242 | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: typed password-help companion adapter is absent.                  |
|  19 | OT-B05 | 60 - Bot Actions                     | DRAFT_SHELL    | DRAFT_SHELL    | badd7521-913c-43b8-9b7a-1c1ccedac63c | No trigger/actions read back                | not_run: No executable trigger or critical action exists; controlled execution is not possible. | DRAFT_BLOCKED_APP_CONTRACT: typed opt-out adapter and suppression mapping are absent.         |

Read-only browser evidence additionally records OT-07 and OT-08 as Draft with 0 total enrolled and 0 active. OT-C01 remains Draft/not sent. OT-E01 is the sole ACTIVE_TESTED workflow.

## Exact desired trigger/action source

The exact ordered trigger and action arrays, last readback, canary result, blocker, and evidence for every workflow are stored in `workflow-registry.yaml`; this report intentionally stays concise.

## Unknown workflows

- None in the committed readback.

## Closed loop and approvals

Required loop: reviewed_git_job → permitted_browser_change → save → navigate_away_or_reload → reopen_and_read_back → bounded_safe_canary → sanitized_result_committed → drift_validator_compares_observation_to_registry.

Approval-gated: activation, broad_send, payment, destructive_action. Agent jobs default to no activation, no broad send, no payment, and no destructive action.

Drift repair in this registry revision replaced stale folder names, blank IDs for live Draft assets, and the ambiguous workflow `deprecationState` field with separate asset lifecycle and observed control status. Future mismatches are emitted as DRIFTED and fail the validator.
