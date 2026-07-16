# Required OT-86B negative tests

Map each id to automated tests/evidence in `SECURITY-PRIVACY.md`.

| ID        | Required negative case and expected result                                                             |
| --------- | ------------------------------------------------------------------------------------------------------ |
| B-NEG-001 | OT-86A remote branch absent: no OT-86B branch/worktree/edit is created.                                |
| B-NEG-002 | Event with wrong type or origin is rejected and creates no social source/draft.                        |
| B-NEG-003 | Invalid signature/checksum/schema is rejected before dispatch.                                         |
| B-NEG-004 | Identical event replay creates one inbox/source/draft job.                                             |
| B-NEG-005 | Same event/idempotency id with changed bytes is quarantined and audited.                               |
| B-NEG-006 | Any learner-name flag rejects the event and every downstream action.                                   |
| B-NEG-007 | Learner voice, face, question, and private-data flags independently reject.                            |
| B-NEG-008 | Media classification outside no-people/Rabbi-only/graphics-only rejects.                               |
| B-NEG-009 | Raw transcript, BNA note, sibling record, arbitrary URL, or unknown checksum cannot enter a draft.     |
| B-NEG-010 | Event receipt/draft generation performs zero Buffer write calls.                                       |
| B-NEG-011 | Unapproved draft cannot create a publish command.                                                      |
| B-NEG-012 | Approved draft without destination cannot schedule or publish.                                         |
| B-NEG-013 | Approved draft without future scheduled time cannot publish.                                           |
| B-NEG-014 | Text/media edit after approval invalidates approval and pending command.                               |
| B-NEG-015 | Destination, timezone, capability, or scheduled-time change invalidates approval.                      |
| B-NEG-016 | Privacy scan failure after approval fails closed before provider call.                                 |
| B-NEG-017 | Scheduler receives an early/not-due command and performs no provider write.                            |
| B-NEG-018 | Concurrent scheduler workers create at most one provider post per command/destination.                 |
| B-NEG-019 | Timeout after provider create reconciles before retry and does not duplicate the post.                 |
| B-NEG-020 | Missing/invalid Buffer token or accounts yields readiness/checkpoint, not fake success or dead action. |
| B-NEG-021 | Buffer token embedded in provider exception never appears in log, report, snapshot, telemetry, or UI.  |
| B-NEG-022 | Unauthorized viewer/editor/approver/retry/retraction action is denied server-side.                     |
| B-NEG-023 | Unknown destination type may preview blocked state but cannot schedule.                                |
| B-NEG-024 | Renderer never invents quote/testimony/fact absent from approved event excerpts.                       |
| B-NEG-025 | Active markup/script in event text is escaped and cannot execute in preview.                           |
| B-NEG-026 | Unsupported provider delete yields `retraction_manual_required`, not `retracted`.                      |
| B-NEG-027 | Ambiguous delete timeout is not recorded as confirmed retraction.                                      |
| B-NEG-028 | Correction requires new revision, privacy scan, approval, destination, and schedule.                   |
| B-NEG-029 | Buffer SDK/token code is absent from client bundles.                                                   |
| B-NEG-030 | OT-86A publication/library/KB tests pass with OT-86B worker disabled.                                  |
| B-NEG-031 | Additive migration rerun does not duplicate schema or commands.                                        |
| B-NEG-032 | A disabled/missing social consumer does not block OT-86A outbox or launch.                             |
