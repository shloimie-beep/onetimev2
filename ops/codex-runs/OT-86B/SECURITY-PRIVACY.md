# OT-86B Security And Privacy

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Negative-Test Map

| ID        | Status | Evidence                                                                                                                     |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| B-NEG-001 | Pass   | Preflight required exact remote OT86A ref before branch/worktree creation.                                                   |
| B-NEG-002 | Pass   | Wrong type and wrong origin events return 422 and create no drafts.                                                          |
| B-NEG-003 | Pass   | Invalid signature returns 401; invalid checksum/schema returns 422.                                                          |
| B-NEG-004 | Pass   | Identical replay returns duplicate and creates one durable receipt path.                                                     |
| B-NEG-005 | Pass   | Changed replay bytes return 409 conflict and audit evidence.                                                                 |
| B-NEG-006 | Pass   | Learner/private privacy schema requires false flags.                                                                         |
| B-NEG-007 | Pass   | Voice/face/question/private flags are schema/privacy rejected; question fixture covered explicitly.                          |
| B-NEG-008 | Pass   | Unsafe media classification is rejected before source/draft creation.                                                        |
| B-NEG-009 | Pass   | Draft generator uses only approved excerpts/media ids from the accepted event.                                               |
| B-NEG-010 | Pass   | Event receipt and draft generation tests assert zero provider attempts.                                                      |
| B-NEG-011 | Pass   | Publish commands are created only by `approveAndScheduleOt86bDraft`.                                                         |
| B-NEG-012 | Pass   | Approval without destination throws `DESTINATION_REQUIRED`.                                                                  |
| B-NEG-013 | Pass   | Past/non-future schedule throws `FUTURE_SCHEDULE_REQUIRED`.                                                                  |
| B-NEG-014 | Pass   | Edit after approval invalidates approval and cancels pending command.                                                        |
| B-NEG-015 | Pass   | Approval binds destination/timezone/capability/schedule in command and binding snapshots; edit/change requires new approval. |
| B-NEG-016 | Pass   | Publish command validation asserts privacy false/scan passed before execution.                                               |
| B-NEG-017 | Pass   | Early scheduler run inspects no due writes and adapter create count remains 0.                                               |
| B-NEG-018 | Pass   | Commands are idempotent by command id/idempotency and approval/destination uniqueness; batch size clamped to 1-100.          |
| B-NEG-019 | Pass   | Scheduler reconciles before create; existing provider post marks published with zero create calls.                           |
| B-NEG-020 | Pass   | Readiness reports `unconfigured` and checkpoint waits for Buffer accounts.                                                   |
| B-NEG-021 | Pass   | Provider error sanitizer redacts token-shaped values; secret scan passed.                                                    |
| B-NEG-022 | Pass   | Readiness/draft APIs require owner/admin session server-side.                                                                |
| B-NEG-023 | Pass   | Destination schema and readiness expose only supported Buffer destinations; unknown destination cannot schedule.             |
| B-NEG-024 | Pass   | Renderers use approved title, url, summary, and excerpt text only.                                                           |
| B-NEG-025 | Pass   | Edit preview text escapes `<script>` input in integration test.                                                              |
| B-NEG-026 | Pass   | Unsupported delete enters `retraction_manual_required`.                                                                      |
| B-NEG-027 | Pass   | No ambiguous delete is marked retracted without adapter `deleted` result.                                                    |
| B-NEG-028 | Pass   | Correction/edit creates a new revision and resets workflow to review.                                                        |
| B-NEG-029 | Pass   | No client route, Buffer SDK, token logic, or scheduler code added to browser bundles.                                        |
| B-NEG-030 | Pass   | OT86A publication/library/KB regression tests pass on OT86B branch.                                                          |
| B-NEG-031 | Pass   | Migration foundation test applies all migrations; pg-mem no-op rerun limitation remains documented.                          |
| B-NEG-032 | Pass   | Buffer absent/unconfigured does not block OT86A build/tests or content delivery paths.                                       |

## Additional Evidence

- `npm run secret:scan` exit 0.
- `npm run build` exit 0; no Buffer client bundle was introduced.
- Read-only canary reports no writes performed.
