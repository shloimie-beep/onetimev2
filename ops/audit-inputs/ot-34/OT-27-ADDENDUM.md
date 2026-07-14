# OT-34 Urgent Addendum — Intake OT-27 Before Finalizing

Paste this into the active OT-34 Codex window. It supplements, and where broader, overrides the original OT-34 prompt.

```text
OT-34 FOLLOW-UP — OT-27 INTAKE

The independent OT-27 review has now returned. It reviewed PR #2 at d63557e.
Current PR #2 head a73458d added the OT-24 foundation merge/CI/evidence but did not
repair the underlying auth/CRM/lead code, so OT-27's code findings still apply.
Do not stop or restart the task; incorporate these requirements in the existing
OT-34 branch.

ADDITIONAL OWNED FILES
- apps/web/src/server/rate-limit.ts
- packages/observability/src/index.ts, only to remove unsafe unauthenticated timing
  disclosure and preserve safe internal observability
- new focused tests/evidence necessary for the items below

REQUIRED ADDITIONS

1. Remove unauthenticated timing oracle
   - Do not return login/Argon2/database phase timings in Server-Timing or another
     caller-visible header.
   - Keep internal aggregate observability without email/IP/token/PII.

2. Harden BOTH login and public-lead throttling
   - Shared atomic durable budgets cover IP, identifier, account/product, and global
     spray behavior.
   - `/api/leads` aliases share one budget.
   - Configure trusted proxy hops explicitly; never trust arbitrary forwarded headers.
   - Bound storage and expiry; prove behavior across two application instances.

3. Complete session invalidation
   - Add user-wide/session-family revocation.
   - Password, role, status, or security-policy change invalidates prior sessions.
   - Bind session validity to a credential/security version or equivalent invariant.
   - Either enforce stored UA/IP context under a documented tolerant policy or remove
     the misleading unused fields; do not claim protection from data not checked.

4. Apply private no-store controls broadly
   - Login HTML, CRM list/detail/create/edit success and error JSON, session and CSRF
     responses use `Cache-Control: no-store, private` and disable validators.

5. Fix return_to redirect parsing
   - Reject backslashes, control characters, scheme-relative paths, other origins, and
     normalization tricks.
   - Parse against the configured One Time origin and return only a canonical same-origin
     pathname/search/hash.

6. Replace mutable-email identity semantics
   - New contacts use an immutable random internal contact key, never a hash derived
     from mutable email.
   - Use the existing random UUID row ID or another random opaque ID for CRM URLs/API
     contact_id; keep legacy contact_key values only as internal compatibility keys.
   - Email change must not prevent a later legitimate new contact from using the old
     address.
   - Preserve existing contact/outbox/signup references through an additive migration
     and compatibility lookup; never rewrite historical keys destructively.

7. Manual create idempotency and concurrency
   - Require an explicit idempotency key/request hash for manual CRM create.
   - Same key/same payload replays; same key/different payload conflicts.
   - Concurrent duplicates resolve deterministically through database constraints,
     not precheck-then-insert races.

8. Deterministic migration repair
   - Do not edit 0001 or 0002.
   - Migration 0003 must deterministically correct the 0002 multi-signup backfill using
     an explicitly ordered authoritative row and add required invariants/indexes.
   - Verify on real PostgreSQL-compatible behavior with multi-signup, duplicate, archived,
     and cross-account fixtures; pg-mem alone is insufficient evidence.

9. CRM contract completion needed for safe core
   - Validate CRM response DTOs, not only request DTOs.
   - Provide a bounded same-account/product assignee-discovery contract; never accept
     guessed raw user keys as the normal UI mechanism.
   - Add capability semantics for owner/admin/crm_agent/viewer and full role-negative,
     direct-detail, PATCH, archive, assignment, and cross-account/product tests.
   - Validate manual CRM timezones as real IANA zones.

10. Keep search PII out of URLs
    - Add a CSRF-protected authenticated POST search/list command or opaque filter token
      so names/emails/phones are not placed in query strings/history/proxy logs.
    - Preserve bounded pagination and a non-PII canonical route.
    - OT-35 will consume this endpoint during integration; document the exact contract.

11. Query/index and session-write discipline
    - Add production-relevant indexes for supported filters/sorts/search or narrow the
      supported query contract honestly.
    - Do not update `last_seen_at` on every authenticated read; use a bounded write
      cadence without weakening expiry/revocation.
    - Capture representative PostgreSQL EXPLAIN/latency evidence with synthetic scale,
      zero N+1, and bounded query counts.

12. Evidence and negative matrix
    - Consume all P0 cases in NEGATIVE-TEST-MATRIX.md.
    - Include concurrent idempotency/throttle tests, direct cross-tenant detail/PATCH,
      session-family invalidation, redirect attacks, no-store errors, and response-schema
      validation.
    - Failure traces/screenshots must use synthetic data and pass a PII scan.

MFA DECISION — OVERRIDES THE EARLIER STAGING-ONLY DOWNGRADE
- `mfa_capable` never satisfies MFA.
- Implement a complete authenticator-app TOTP lifecycle for owner/admin in OT-34:
  encrypted secret at rest, separately provisioned hashed/expiring one-time enrollment
  token, limited pre-auth state, proof before activation, challenge on every privileged
  login, replay protection, rate limits, hashed one-time recovery codes, revoke/replace,
  session assurance method/time, session-family revocation, and audit.
- Owner/admin password success alone never creates a full session.
- No superficial flag/renaming may be reported as fixing SEC-001.
- Never expose real factor secrets, OTPs, enrollment tokens, recovery codes, or otpauth
  URIs in logs, screenshots, evidence, or source.

MERGE STATUS
- OT-27 says DO NOT MERGE the current checkpoint.
- Your branch must remain a draft stacked PR. Do not merge PR #1, PR #2, or your branch.
```
