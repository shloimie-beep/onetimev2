# OT-86B acceptance checklist

Every unchecked item is a blocker except the explicit external Buffer-account checkpoint.

## Git, sequencing, and scope

- [ ] OT-86A was resolved from exactly one remote before any OT-86B branch/edit.
- [ ] Branch is `codex/ot86b-buffer-social`, based on the recorded remote OT-86A SHA.
- [ ] Clean dedicated worktree and resumable `RUN.json` were used.
- [ ] Every changed path is allowed by `OWNED-ROOTS.json`.
- [ ] Migrations are additive and validated empty/upgraded.

## Event isolation and privacy

- [ ] Only authenticated `content.approved_for_social` from `ot86a-content-pipeline` is accepted.
- [ ] Durable inbox, checksum, sequence, idempotency, replay, and changed-byte conflict handling exist.
- [ ] Learner name/voice/face/question/private data and unsafe media fail closed.
- [ ] Raw transcripts, BNA notes, sibling records, arbitrary URLs, and unapproved assets cannot enter drafts.
- [ ] OT-86A remains independent when consumer is absent/disabled.

## Drafts, approvals, and schedules

- [ ] Immutable revisions and renderer/source/checksum lineage exist.
- [ ] Platform renderers/previews exist for LinkedIn, Facebook, Instagram, and X.
- [ ] Preview escapes markup and shows capability/limit failures without silent semantic truncation.
- [ ] Human approval binds exact revision/media/destination/capability/schedule/privacy data.
- [ ] Any bound change invalidates approval and pending command.
- [ ] No event/draft/preview path calls Buffer.
- [ ] No publish path bypasses human approval, destination selection, and due scheduled time.

## Buffer and operations

- [ ] Server-only adapter is the sole provider boundary.
- [ ] Read-only canary is implemented and secret-safe.
- [ ] Missing token/org/destination produces honest readiness and `WAITING_FOR_BUFFER_ACCOUNTS` when applicable.
- [ ] Idempotent reconcile-before-retry prevents duplicate posts.
- [ ] Rate limits/transient failures are bounded; auth/config/privacy failures are not blindly retried.
- [ ] Provider ids/results are audited without tokens/private payloads.

## Correction and retraction

- [ ] Correction creates a new revision and new approval/schedule.
- [ ] Scheduled update/cancel occurs only when capability permits.
- [ ] Retraction is confirmed before `retracted`.
- [ ] Unsupported/ambiguous delete enters `retraction_manual_required` with open operator action.

## Engineering gates

- [ ] B-NEG-001 through B-NEG-032 pass.
- [ ] Contract valid/invalid fixtures pass runtime schema validation.
- [ ] Lint, typecheck, build, targeted tests, and OT-86A regressions pass.
- [ ] Performance/query-plan and bundle/server-only boundaries pass.
- [ ] Secret scan passes for diff and run artifacts.
- [ ] All exact reports exist with commands and evidence.
- [ ] Commit, push, and one unmerged stacked PR were created exactly as specified.
