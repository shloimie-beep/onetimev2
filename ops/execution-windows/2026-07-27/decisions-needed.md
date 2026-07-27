# Self-driving queue decisions and manual handoffs

`BOARD.yaml` remains the only current goal-status map. This file explains
external gates referenced by `dependencies.yaml`; it cannot approve an action.

Workers continue through ordinary repository tasks without asking the operator
to relay completion. A worker may surface only one of these manual handoffs:

- `SIGN IN`
- `APPROVE SEND`
- `APPROVE PRODUCTION`
- `APPROVE DESTRUCTIVE ACTION`
- `PRODUCT DECISION REQUIRED`
- `BLOCKED`

Every handoff must name the lane, queue item, exact blocker, already completed
safe proof, and the single action needed. It must not include a secret,
credential, private destination, customer/Student data, protected provider
identifier, or raw provider payload.

## Current gates

| Lane               | Item      | Handoff                                          | Exact gate                                                                                                                                                                                                                   |
| ------------------ | --------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `02-OT-ZOOM`       | `Q02-002` | `BLOCKED`                                        | PR #125 proves the preserved meeting failed the reviewed identity/scope guard before DELETE. First accept `Q04-ZOOM-001`, then separately authorize one mutation-impossible OAuth/GET classification; do not repeat cleanup. |
| `02-OT-ZOOM`       | `Q02-003` | `BLOCKED` or `PRODUCT DECISION REQUIRED`         | The safe predicate matrix must identify the exact mismatch. Control may assign only the smallest evidence-backed repair; an identity/ownership ambiguity requires an operator decision.                                      |
| `03-OT-GHL`        | `Q03-003` | `PRODUCT DECISION REQUIRED`, then `APPROVE SEND` | Mailbox/routing/Reply-To ownership must be explicit, the repository design must be accepted, and one exact operator-owned seed needs fresh authority.                                                                        |
| `05-OT-HYGIENE`    | `Q05-001` | `BLOCKED`                                        | Supply distinct protected census and encrypted backup roots outside every repository and cloud-served tree.                                                                                                                  |
| `05-OT-HYGIENE`    | `Q05-005` | `APPROVE DESTRUCTIVE ACTION`                     | Board must name every exact PR head approved for comment and closure after preservation proof.                                                                                                                               |
| `06-BNA-CONTROL`   | `Q06-002` | `PRODUCT DECISION REQUIRED`                      | BNA School ownership, tuition truth, repository, protected data, extraction, and cutover timing remain unresolved.                                                                                                           |
| `07-OT-PRODUCTION` | `Q07-001` | `APPROVE PRODUCTION`                             | All release dependencies, immutable candidate, backup/restore/rollback, and a fresh exact production authority are required.                                                                                                 |

## Authentication

Use `SIGN IN` only when an otherwise authorized task cannot proceed because
the exact named account/session requires the operator to authenticate. Do not
request credentials in chat and do not substitute another account.

## Technical blockers

Use `BLOCKED` for a reproducible technical or provider-authority condition that
cannot be resolved safely within the assigned scope. Ordinary test failures,
merge conflicts, stale local state, and retryable implementation defects are
not operator handoffs until the worker exhausts safe in-scope diagnosis and
repair.
