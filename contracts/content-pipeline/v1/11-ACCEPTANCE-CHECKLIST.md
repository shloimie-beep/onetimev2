# OT-86A acceptance checklist

Every unchecked item is a release blocker unless it is the explicit Vimeo external-readiness checkpoint.

## Git and scope

- [ ] The unique remote base `codex/ot83-household-portals-foundation` was resolved and recorded.
- [ ] Work occurred only on `codex/ot86a-vimeo-content-kb` in the clean dedicated worktree.
- [ ] `OWNED-ROOTS.json` exists and every changed path is allowed.
- [ ] No destructive Git command or unrelated formatting churn occurred.
- [ ] All migrations are additive and validated on empty and upgraded databases.

## Content control plane

- [ ] Durable provenance, checksums, attempts, retries, revision history, and audit exist.
- [ ] All ten required states and only allowed transitions are enforced centrally.
- [ ] Duplicate source/provider/job/version/delivery/index work is prevented by constraints and tests.
- [ ] Approved versions are immutable; correction creates and links a new version.
- [ ] Prompt/studio/transcription internals remain BNA/admin-only.
- [ ] Rabbi-facing One Time surfaces show delivery status/result without admin internals.

## Vimeo

- [ ] A server-only provider adapter is the sole Vimeo boundary.
- [ ] Webhook verification, receipt persistence, replay handling, and poller convergence are tested.
- [ ] Manual approved Vimeo reference is a real audited fallback and not a fake upload success.
- [ ] Missing configuration produces honest readiness UI and `READY_FOR_VIMEO_CANARY` when applicable.
- [ ] `bin/ot86-vimeo-canary --mode read-only` is implemented and secret-safe.
- [ ] Secret scanning and hostile provider-error tests show no credential leakage.

## Publication and One Time independence

- [ ] Manifest and social-event schemas are committed under `contracts/content-pipeline/v1/` and runtime validated.
- [ ] HMAC signature, timestamp, body checksum, delivery id, sequence, and idempotency are enforced.
- [ ] One Time durably stores an inbox receipt before `202`.
- [ ] Publish/correct/revoke/retire are async, transactional, idempotent, and audited.
- [ ] One Time stores local published metadata, sections, artifacts, and search documents.
- [ ] Published pages and retrieval work while BNA network access is blocked.
- [ ] OT-86A launch and publication do not require OT-86B.

## Student helper

- [ ] Authorization and entitlement resolution occur before search.
- [ ] Corpus contains only current published KB-eligible Rabbi content.
- [ ] Cross-tenant, unentitled, sibling/private, arbitrary-web, and learner-data tests fail closed.
- [ ] Every supported answer has active section citations and a local deep link.
- [ ] Unsupported or contradictory requests abstain.
- [ ] Injection text cannot alter rules, tools, authz, corpus, or citations.
- [ ] No general persistent learner memory or default raw-question storage exists.
- [ ] Correction/revocation/deletion propagation and in-flight recheck are tested.

## Engineering gates

- [ ] Targeted unit/integration tests pass.
- [ ] Contract valid/invalid fixtures pass schema validation.
- [ ] Lint, typecheck, build, and migration checks pass for every changed application.
- [ ] Performance and bundle boundaries pass or the stricter existing budget passes.
- [ ] Static dependency checks prove no One Time runtime BNA UI/ops coupling.
- [ ] All exact reports exist with commands and exit codes.
- [ ] Commit, push, and one unmerged PR were created as specified.
