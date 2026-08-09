# Owner Login and Role Switch Result

- Date: 2026-08-09
- Lane: OT-P0
- Branch: `codex/ot-p0-owner-login-20260809`
- Integration base: `codex/one-time-complete-production-launch-20260805`
- State: IMPLEMENTED LOCALLY; CONTROLLER DEPLOYMENT AND REAL OPERATOR ACCEPTANCE PENDING
- Implementation commit: `c2bcec3dc2e6e59b00f5d91fa3c1bdb3446dbc0d`
- Child pull request: #147 (draft, mergeable)

## Delta boundary

### Already proven

- The production operator scope contains exactly one active canonical adult identity, one active HumanAccount, one active credential, one active Admin membership, one active Parent membership, and one active owned Family household.
- The legacy bridge contains one active Admin row for the same operator. No duplicate identity, account, membership, household, or legacy bridge row was found.
- The deployed authentication source before this repair matched the integration branch for the inspected authentication files.
- The production password login succeeded, the v2.1 session bootstrap succeeded, and `/select-role` rendered. The first role-switch request returned 503, revoked the working session with `role_context_switch`, and the retry returned 401. No Admin or Parent application route was subsequently reached.
- The latest password-reset request was accepted but remained sink-queued; real delivery is owned by the OT-P1 provider lane.

### Operator-changed or separately owned facts

- The canonical operator Admin credential hash and security version remain unchanged. No temporary or canary password was written.
- The Parent membership and owned household were already present before this lane; migration 2274 is therefore expected to be a no-op in the current production projection.
- Draft PR #140 owns the 60-minute reset-token TTL and the cross-domain/signup-routing work. This lane does not duplicate that change.
- Migration ordinals 2272 and 2273 are reserved by other controller lanes. This lane uses 2274.

### Unresolved production delta

1. Integrate and deploy this child branch through the controller.
2. Confirm OT-P1 webhook registration, real delivery, and PR #140 deployment are healthy.
3. Complete the self-addressed reset in the operator-owned mailbox/browser without transmitting the link, token, password, or cookies.
4. Prove in production: reset success; fresh login defaults to Admin; Admin refresh/deep link; Admin to Parent switch; correct household; Parent refresh/deep link; Parent to Admin switch; logout; old-cookie rejection; fresh re-login.
5. After an authenticated Admin session exists, send OT-P2 only a sanitized ready/not-ready signal for its non-mutating Zoom canary.

## Root cause

Role and household switching revoked the current session before creating and reading back its replacement. A transient replacement failure therefore converted a valid login into a permanent 503/401 loop. Dual-role login also selected Parent first and required the separate role selector instead of defaulting to Admin.

## Implemented repair

- Dual-role password login now establishes Admin by default with no household binding.
- Role and household switches establish and verify the replacement first, then revoke the prior session. A failed replacement leaves the current session usable; a failed prior-session revocation triggers best-effort cleanup of the undisclosed replacement.
- Parent accounts with one household bind it directly. Parent accounts with multiple owned households receive a short-lived unbound Parent selection session and must choose an owned household before entering the Parent app.
- The PostgreSQL repository now creates, resolves, and revokes that exact multi-household selector state while preserving scope, membership, owner, security-version, digest, expiry, and access-state checks.
- Correct credentials can recover from malformed/stale v2.1 and legacy cookies; the stale cookies are cleared as the valid replacement session is issued.
- Role-selection UI bootstrap/post failures are retryable. Stale CSRF responses are explicit and recover through a fresh session bootstrap.
- Migration `2274_operator_dual_role_reconciliation.sql` restores the displaced bounded operator membership reconciliation. It never creates an identity, account, credential, Admin membership, or household; it inserts only a missing Parent membership for the exact canonical production operator with one owned active household, using conflict-safe idempotency.

## Focused verification

- v2.1 adult-session runtime: 18 passed.
- PostgreSQL adult-session repository: 13 passed, 3 native-only tests skipped by their existing environment gate.
- Operator dual-role reconciliation migration: 1 passed, including double application and unchanged identity/account/credential/household cardinality.
- Family/Parent HTTP composition: 5 passed, including correct-credential recovery from malformed host and legacy cookies; 1 native-only test skipped by its existing environment gate.
- Reset completion contract: the single-use/session-family invalidation test passed. The 60-minute expiry assertion remains in separately owned draft PR #140.
- TypeScript typecheck: passed.
- Focused lint: passed.
- Diff whitespace validation: passed.
- Repository secret scan: passed.

## Safety and handoff

- No production database write, provider mutation, password change, session-cookie disclosure, reset-token disclosure, or raw link disclosure occurred in this lane.
- No authenticated Admin session exists yet, so OT-P2 is not ready to continue its operator-only Zoom canary.
- Production acceptance must append sanitized request/deployment timestamps and pass/fail outcomes here after deployment. Never record household names, password material, tokens, cookies, reset links, or provider credentials.
