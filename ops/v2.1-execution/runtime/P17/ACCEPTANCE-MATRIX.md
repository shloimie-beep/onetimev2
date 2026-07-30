# P17 Acceptance Matrix

All evidence is provider-free and task-owned. Provider sandbox and production
operator canaries require a separate explicit Zoom effect authority after the
structured steward requests are integrated.

| Case                      | Evidence                                                                                                                                                                                | Result               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `OTV2-CLASSROOM-068-AC01` | Exact occurrence/schedule/roster binding, current eligibility/access/consent decisions, immutable preview, and exact Admin confirmation.                                                | implementation ready |
| `OTV2-CLASSROOM-069-AC01` | Stable normal-class resource identity and exactly one meeting create-or-reuse operation per occurrence version.                                                                         | implementation ready |
| `OTV2-CLASSROOM-070-AC01` | One distinct protected registrant and readback per included Student; no household-shared registrant.                                                                                    | implementation ready |
| `OTV2-CLASSROOM-071-AC01` | P17 exposes only constant authenticated join-state availability with current occurrence/resource/registrant authorization and no raw URL; P18 solely owns grant and bootstrap behavior. | implementation ready |
| `OTV2-CLASSROOM-072-AC01` | Household-grouped Student labels, 30-minute reminder time, and constant Parent app path without Student auth or provider bearer.                                                        | implementation ready |
| `OTV2-CLASSROOM-074-AC01` | Canonical settings and meeting plan require `muteUponEntry: true`.                                                                                                                      | implementation ready |
| `OTV2-CLASSROOM-076-AC01` | P17 independently exposes ready join state for three exact Student registrants; P18 solely owns tablet/device leases, heartbeat, expiry, and reconnect.                                 | implementation ready |
| `OTV2-CLASSROOM-077-AC01` | P17 join availability fails closed for cross-Student, cross-occurrence, cross-account, and cross-product records; P18 solely owns device concurrency.                                   | implementation ready |
| `OTV2-CLASSROOM-079-AC01` | Cleanup accepts only exact disposable-canary digests and explicitly leaves canonical classroom resources/non-canary flow unblocked.                                                     | implementation ready |
| `OTV2-CLASSROOM-188-AC01` | Waiting room, rename, chat, screen share, file transfer, invite, cloud/local/automatic recording are disabled and read back exactly.                                                    | implementation ready |

The worker test additionally proves acceptance-unknown dispatch enters
readback-only quarantine without blind retry. Persistence tests prove
parameterized transactions, rollback, migration-only DDL, the exact five-table
schema contract, and atomic canonical `job_outbox` plus
`provider_operation_binding` persistence.

## Correction proof

The reconciled correction pass adds negative assertions for every recorded
semantic finding:

- roster entries reject enrollment Student or household identity drift;
- provisioning binds the confirmed occurrence version while meeting,
  registrant, and provider-operation identities remain stable across source
  schedule/roster versions;
- join state rejects cross-occurrence, cross-Student, cross-account, or
  cross-product records while all launch-grant, bootstrap, live-session,
  device, Admin reset, and attendance behavior is removed from P17 and remains
  solely P18-owned;
- worker inputs require one exact meeting operation plus one exact, unique
  operation for every registrant;
- meeting and registrant readbacks reject missing, duplicate, extra,
  cross-type, or cross-aggregate evidence;
- duplicate provider results are rejected, meeting failure or unknown stops
  before registrant dispatch, and invalid/missing accepted readback is durably
  quarantined with a safe code;
- disposable-canary cleanup requires exact reconciled registry evidence,
  verifies the canonical provider-resource set digest, and rejects canonical
  targets; and
- server request hashes are recomputed from the canonical command before
  receipt/replay handling;
- the P17 schema declares exactly preparations, roster snapshots, classroom
  resources, Student registrants, and preparation commands; and
- each provider operation atomically reuses the F05 `job_outbox` idempotency
  contract plus the exact F06 `provider_operation_binding`, failing closed on
  any mismatched existing job or binding.

The provider-free correction suite covers the P17 domain, database, server,
and worker files without inspecting or calling Zoom.
