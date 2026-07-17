# OT-83R — Complete the Parent and Student Portal Foundation

You are implementing OT-83R. Use `OT-83R` everywhere. This resumes existing OT-83 PR #27; do not create an unrelated replacement from `main` and do not modify BNA.

## Start safely and persist state

Locate the checkout whose origin is `https://github.com/webcraft-media/onetimev2.git`. Fetch remote state. Verify PR #27 and `origin/codex/ot83-household-portals-foundation`; the last audited head was `a02d1d254ae0d17804fb657079a7871567260ea2`, but the fetched remote head is authoritative. Create a new clean worktree from that branch and a continuation branch `codex/ot83r-complete-portals` unless safely updating the original PR branch is clearly preferable. Never reset or overwrite another dirty worktree.

Before product edits persist the complete prompt and runtime inputs under `ops/codex-runs/OT-83R/` as `ORIGINAL-PROMPT.md`, `INPUTS.json`, `STATE.json`, `RESUME.md`, and `LOG.jsonl`. Record the exact OT-83 base and PR. Checkpoint/commit/push useful work if a later dependency or credential is absent; do not merely stop.

## Locked product model

- A household can have at most three active named learners, enforced atomically.
- A learner profile and student login identity are separate objects.
- Each student login resolves directly to exactly one learner and cannot list/select/infer siblings.
- Parents are household/relationship scoped. They may activate, reset, suspend, and rotate learner access but cannot retrieve the current learner secret or enter the student session.
- Parent launch-for-learner is an auditable parent action, not impersonation.
- Parent and learner sessions/cookies are One Time-only and never reuse BNA sessions.
- Rabbi Scheller is a real owner and Shloimie is a real administrator; no super-admin view or “View as Rabbi.”
- Protected routes never expose raw Vimeo/Zoom/provider URLs or credentials.
- Private learner questions are visible only to that learner and authorized One Time staff; not automatically to parents.
- No dead, placeholder, or “Coming Soon” controls are visible.

## Complete the missing V1 scope

Audit the OT-83 partial implementation and preserve correct existing work. Implement the smallest coherent complete V1 portal slice, including:

1. Parent activation/login/session/logout and safe return routes.
2. Household dashboard showing linked learners without leaking unrelated households.
3. Add/activate learner subject to the atomic three-seat limit.
4. Parent reset/suspend/reactivate learner credentials with security-version/session revocation.
5. Separate student activation/login/session/logout resolving to one learner.
6. Parent portal routes for overview, children/access management, next class, library/review sheets, basic progress/attendance, billing-status seam, and subscriber support seam. Only expose a control if its backend path works.
7. Student portal routes for home/next class, protected library/review sheets, learner-only progress/rewards, class-question submission seam, and helper seam against the learner-authorized knowledge base.
8. Protected join/playback action contracts returning opaque app launch actions, never raw provider URLs.
9. Loading, empty, populated, permission denied, session expired, offline/stale-safe, conflict, provider unavailable, and retry states.
10. Route/action registry with capability, handler, confirmation, audit/idempotency, readiness, and positive/negative tests for every visible control.

Use the existing OT-82 brand tokens and authenticated shell: black/yellow, consistent header/footer/navigation/button/form/card behavior, mobile at 360×800 and 390×844, tablet/desktop, RTL-safe logical CSS, keyboard/focus, reduced motion, 200% reflow, and WCAG 2.2 AA. Keep public and authenticated bundles isolated.

## Persistence and API requirements

Use additive migrations and repository patterns. Enforce account/household/relationship/learner boundaries in queries and service authorization, not only in UI filters. Use opaque public IDs, normalized DTOs, no-store private responses, CSRF for mutations, idempotency for activation/reset/question writes, optimistic concurrency where appropriate, audit rows, and secure session rotation/revocation. Avoid persistent client PII caches.

## Verification

Run clean install, formatting for owned files, lint, typecheck, unit/integration/browser/accessibility/performance tests, secret/PII/provider-URL scans, bundle/no-BNA-fanout checks, and `git diff --check`. Add disposable PostgreSQL 16 fresh-install and upgrade-path proof, concurrency tests for the three-learner cap and activation/reset races, and cross-account/household/sibling/role negative tests. Capture evidence at 360×800, 390×844, tablet, and desktop with fictional `.example.test` data only.

No production DB, provider, email/WhatsApp/Telegram send, Stripe charge, Railway/DNS change, real user creation, or deployment is part of OT-83R.

## Finish

Commit/push and open or update a draft PR. Report exact base/head, migrations/checksums, changed files, validation, screenshots, remaining provider seams, external mutations, and whether the portals are now complete enough for OT-99 integration in `ops/codex-runs/OT-83R/FINAL-REPORT.md`. Leave a clean worktree and a self-contained `RESUME.md` for any remaining blocker.

