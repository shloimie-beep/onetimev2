# v2.1 Bounded Operator Canary

Status: mechanism only. No canary, provider, send, charge, refund, cleanup,
backup, restore, deployment, or legal approval was performed. Real R44 canary
evidence is absent and this gate is not passed.

## Entry gates

The ledger in `scripts/operations/v21/canary-budget/index.ts` accepts only the
separate identity pair `production_operator_canary` / `production`, a live
credential boundary, immutable candidate and authorization digests, and
confirmed operator-owned scope. Current backup/restore, rollback, and external
legal-artifact gates must all already pass. The mechanism never obtains
credentials or performs an effect.

The legal gate cannot be inferred, automated, or replaced with an Admin
checkbox. It needs the five exact externally approved policy artifacts, the
exact manifest, two named approvals, qualified-reviewer credential or firm, and
production render readback. Missing real artifacts keep the canary blocked.

## Locked budgets

| Domain      | Effect                                                           |    Maximum |
| ----------- | ---------------------------------------------------------------- | ---------: |
| One Time    | parent accounts / households / Students                          |  2 / 2 / 6 |
| One Time    | tickets / questions / cross-household reads                      |  4 / 4 / 0 |
| HighLevel   | operator contacts / workflow enrollments                         |      2 / 4 |
| HighLevel   | broad campaign enrollments / Student contacts                    |      0 / 0 |
| Email       | Resend / HighLevel / unrelated recipients                        | 8 / 12 / 0 |
| WhatsApp    | messages / workflow executions                                   |      0 / 0 |
| Zoom        | meetings / registrants / simultaneous sessions                   |  1 / 3 / 3 |
| Zoom        | raw join URLs exposed                                            |          0 |
| Stripe      | checkout sessions / total USD / refunds                          | 1 / 67 / 1 |
| Stripe      | unrelated mutations                                              |          0 |
| Drive       | files ingested / unrelated moves or deletions                    |      1 / 0 |
| Vimeo       | assets uploaded / unrelated assets mutated                       |      1 / 0 |
| Telegram    | operator notifications / customer messages                       |     12 / 0 |
| Destructive | customer deletions / provider-account deletions / broad rewrites |  0 / 0 / 0 |

The ledger must contain exactly one row for every locked effect class, including
an explicit zero row when no effect occurred. Missing or unknown keys, duplicate
rows, invalid counts, attempts or successes over budget, success without an
attempt, and reconciliation beyond or below attempts fail closed. Every attempt
must end in exact provider readback or a reconciled failure; acceptance-unknown
is quarantined.

## Stop and reconcile

Stop immediately and preserve evidence on any unexpected recipient, Student
HighLevel contact, raw provider link, WhatsApp effect, over-budget charge,
duplicate subscription, unexpected refund or deletion, wrong provider account,
candidate/configuration/environment mismatch, migration failure,
backup/restore/rollback gate failure, authorization or consent failure,
missing/mismatched legal artifact, content drift, audience drift, or
acceptance-unknown result.

Containment disables affected effects and unsafe queue claims before cosmetic
recovery. Reconcile attempted, succeeded, and reconciled totals per effect by
exact provider identity. Never retry or broaden scope from a local assumption.

## Evidence handling

Record immutable candidate/authority identity, both environment fields,
operator-owned cohort identifiers, sanitized counts, exact effect keys, stop
decisions, and readback status. Exclude secrets, personal data, raw provider
URLs, child details, and customer content.
