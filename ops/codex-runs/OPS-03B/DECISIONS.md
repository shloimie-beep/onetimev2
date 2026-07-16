# OPS-03B Decisions

## 2026-07-16 Scope

- Use isolated worktree `C:\Users\User\.batch-20260716-worktrees\OPS-03B`.
- Branch from exact base SHA `fb5f5eebc539afc9e93833e9417ee67524d62c36`.
- Reuse OPS-03A lifecycle delivery encryption/key material and guarded Resend transport; do not add another provider.
- Retire active TOTP UX and endpoints while leaving legacy MFA tables/functions dormant for compatibility.
- Do not deploy production, mutate DNS, send broad email, create live charges, or touch BNA code.

## Implementation Decisions

- Added additive migration `2010_ops03b_email_step_up_login` for hashed email login challenges, encrypted challenge delivery outbox rows, and trusted-device records.
- Owner/admin password login now issues a short-lived, single-use email challenge unless a non-revoked trusted-device cookie matches the current user security version.
- Parent/student and other non-owner/admin roles remain password-only.
- Owner/admin activation and password reset no longer create post-activation MFA handoffs; activation sets the password, rotates/creates a session, and logs in directly.
- Legacy MFA API routes return `410 AUTH_METHOD_RETIRED` with a generic retired sign-in response.
- Recent email assurance is required for owner/admin content outcome admission, CRM contact create/update, and trusted-device revocation.
- Trusted-device cookies are HTTP-only, scoped to `/`, and expire after 30 days; security-version changes invalidate trusted devices through stored security version checks.

## Validation Decisions

- Used in-memory encrypted outbox payload decryption only inside integration tests to exercise the email-code path without changing application logging behavior.
- Treated absent protected provider/canary variables as a staging/canary blocker only; all independent local implementation, build, and sink-mode tests were completed.
