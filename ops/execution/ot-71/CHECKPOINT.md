# OT-71R Checkpoint

## Current State

- Repository: `webcraft-media/onetimev2`
- Worktree: `C:\Users\User\OneTimeOneTime-ot71-product-core-train`
- Branch: `codex/ot71-product-core-train`
- Immutable base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Source PR ref: `origin/pr/17`
- Phase: Phase 3 complete
- Status: building

## Completed

- Received and inspected `C:\Users\User\Downloads\OT71-SELF-HEALING-CODEX-PROMPT-PACK.zip`.
- Verified the pack contains the start-here note, manifest, main execution prompt, and SHA256 sums.
- Validated SHA256 values for the three prompt-pack input files.
- Located existing standalone One Time clones with the expected origin.
- Fetched PR #17 to `origin/pr/17`.
- Verified `origin/pr/17` resolves to `dfef7de2035e08f1ee72e0133ccf656fe7a74444`.
- Verified the immutable base object exists locally as a commit.
- Created `C:\Users\User\OneTimeOneTime-ot71-product-core-train` from the exact immutable base.
- Recorded inherited OT-60R metadata drift as accepted and non-blocking.
- Left shared OT-60R registry/control files untouched.
- Committed and pushed the initial execution packet at `de10f7c`.
- Added migration `1100_ot71_class_occurrence_fulfillment.sql` for class series, occurrences, fulfillment intents, attendance marks, access requests, and class reminder sink claim indexing.
- Added DST-aware 19:00 Asia/Jerusalem class occurrence targeting and 18:30 T-30 reminder scheduling.
- Added post-commit class fulfillment scheduling for eligible Family signups while preserving School submissions as lead-only.
- Added provider-neutral class reminder delivery events, sink delivery support, owner/admin class APIs, and portal access adapter hooks with `provider_unavailable` descriptors.
- Verified Phase 1 with focused and full unit/integration tests plus lint, build/typecheck, secret scan, and whitespace checks.
- Added migration `1400_ot71_content_library.sql` for content items, revisions, entitlements, idempotent outcome records, audit events, redaction events, and retention events.
- Added provider-neutral content contracts and domain service for local asynchronous outcome admission, lifecycle states, stale revision/supersession handling, digest-only provider refs, and recursive metadata redaction.
- Added portal content adapter hooks returning only published entitled library/review items with local protected actions.
- Added owner/admin content library list/detail APIs and CSRF-protected local outcome admission; viewer sessions are denied.
- Verified Phase 2 with focused and full unit/integration tests plus typecheck, lint, build, secret scan, and whitespace checks.
- Added migration `1700_ot71_account_lifecycle.sql` for hashed lifecycle tokens, local delivery intents, idempotency records, audit events, session invalidations, learner identity links, and parent/student roles.
- Added account lifecycle contracts for owner/admin invitations, parent activation, student setup/reset, password reset, token completion, delivery summaries, and student state responses.
- Added canonical-auth account lifecycle service for default-off invitations, parent activation, parent-managed student setup/reset/suspend/restore, and password reset.
- Reused existing password hashing, account users, TOTP MFA, sessions, durable rate limits, and session invalidation primitives; no second auth runtime was created.
- Stored no raw token material in lifecycle persistence and kept learner profiles separate from login identities.
- Verified Phase 3 with focused account lifecycle and migration tests plus full typecheck, lint, build, secret scan, whitespace checks, and unit/integration suites.

## Next

1. Start Phase 4 parent and student portal mounting.
2. Preserve household and single-learner access boundaries while wiring portals to canonical auth.
3. Keep live provider activation and all OT-72-owned transports disabled.

## Prohibitions

Do not deploy, mutate providers, use production databases, send messages, charge payments, modify DNS, create real users, expose raw provider URLs, or modify the BNA repository.
