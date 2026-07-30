# F03 Handoff

## Identity

- Branch: `codex/v21-f03-adult-student-auth`
- Start SHA: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Correction base: `8634b2ab15df624576a88b31182ebdc68553ff74`
- Correction implementation SHA before this handoff metadata commit: `ac53a1afa05069566e9efe1c73bd1738639c9a27`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `8474eeb85ea4c7991c1a42a798c1c3f6a3cda9f2b9a3b51b7c15617b5817ba27`
- Context digest: `9ccc41a037fe9163800d56e8b34991d46e63399a46f3b6f47c986fa200e2ce5e`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Controller authorization: `c44656d40769b28f2d55e6e1041d716175129f4a`
- READY payload: `04208bf0d5d926b5f08387688ffacf4818336feef7636b6dcf651c01c3a945f1`
- Claim: `01368f45-d6ea-4816-b70f-4b21ac418a83`
- Released writer lease: `IDENTITY_AUTH_ACCESS` / `343a0e56-33ee-4227-b4ee-d373d1d3f3a9`
- Interface contract: `66464e9a769c717dfdfda082bb8a26030da1681d601d6752fb04b10d812db111`
- Correction artifact digest: `0f78ec6c9d4455d9bffdb7824a1af7b67c78b71cfde38ed96ea3a1132e773350`

## Completed behavior

- Published exact v2.1 role, password, Argon2id, session, token, rate-limit, CSRF, secure-cookie, safe-return, lifecycle, and cross-domain security contracts under the required auth export roots.
- Implemented exact adult email/password and Student username/password policy without MFA or a routine email challenge.
- Applied role-specific idle/absolute session expiry, credential/session revocation, generic token semantics, and setup/reset single-use expiry and supersession.
- Applied exact Unicode password bounds without composition rules, identity/common/compromised-password hooks, and transparent legacy credential rehash.
- Normalized `owner` and `rabbi` migration-history rows to public `admin` principals.
- Applied immutable request `F01-retired-auth-001` at `56fa990c5d4a6cb7b602b5f68fe0d2402a0ee71e`; the direct database proof confirms a valid owner password returns an Admin principal and creates zero email challenges and zero trusted-device artifacts.
- Added the neutral injectable `createV21AdultSessionRuntime` and PostgreSQL factory backed only by F04's stable `V21AdultSessionRepository` and `createPostgresV21AdultSessionRepository` symbols.
- Issuance generates independent 32-byte session, access, refresh, and CSRF material, persists only the exact domain-separated lowercase SHA-256 digests, and exposes raw material only within a strict versioned HMAC-authenticated browser envelope.
- The runtime resolves only `__Host-onetime-session`, rechecks the exact adult/account/Parent/household/runtime/environment/security/access/deadline binding through F04, and reports establishment only after the same middleware resolver reads the issued cookie.
- Failed or unknown-outcome create/readback attempts trigger best-effort exact-session revocation and return no browser or CSRF token.
- Exact-session HMAC CSRF verification and the canonical segment-safe inactive-Parent route allowlist are exported without changing P08, central composition, configuration, migrations, or providers.

## Remaining work

C00 must independently review and integrate the correction. P08 composition and I36 installation of the same resolver in active Parent middleware remain separate gated work.

## Exact next action

Validate remote correction ancestry, five-path scope, artifact digest, focused proof, released lease, and zero effects; then admit it before issuing P08 composition.

## Coverage

- Requirements: 16 implementation-ready
- Acceptance cases: 22 implementation-ready

## Changed files and migrations

- Correction runtime: `ops/v2.1-execution/runtime/F03/{TASK-STATE.yaml,HANDOFF.md,NEXT-PROMPT.md}`
- Correction product pair: `apps/web/src/server/features/auth/{v21-adult-session.ts,v21-adult-session.test.ts}`
- Historical runtime/interface: `ops/v2.1-execution/runtime/F03/INTERFACE-CHECKPOINT.yaml`
- Historical client/server helpers: `apps/web/src/{client/auth/token-fragment.ts,server/features/auth/http-security.ts}`
- Contract: `packages/contracts/src/identity/auth/index.ts`
- Domain: `packages/domain/src/auth/{index.ts,policy.ts,rate-limits.ts,service.ts,sessions.ts,tokens.ts,v21-auth.contract.test.ts}`
- Migrations: none

## Verification

- TypeScript typecheck and focused ESLint pass.
- Twenty-three F03 contract/steward tests and four existing current-access integration tests pass.
- The direct F01 steward proof passes with zero challenge/trusted-device rows.
- Formatting and `git diff --check` pass.
- Nine exact interface artifacts recompute to contract digest `66464e9a769c717dfdfda082bb8a26030da1681d601d6752fb04b10d812db111`.
- The canonical applied steward-result payload recomputes to `f557eacfce20aace5ea74ec926e09c949f7d80e660ac44021b445476d5f53f6e`.
- Seven new runtime tests pass, and the combined F03/F04/P08 focused run passes 44 tests with one native-only F04 test skipped.
- Workspace typecheck, focused ESLint/Prettier, diff hygiene, YAML parsing, and the secret scan across 3106 repository text files pass.
- The two exact correction artifacts recompute to `0f78ec6c9d4455d9bffdb7824a1af7b67c78b71cfde38ed96ea3a1132e773350`.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

Raw password and token values are never persisted by the new interfaces. Raw access/refresh material exists only in the signed HttpOnly browser envelope; repositories, failures, logs, receipts, URLs, and runtime evidence contain only digests or safe metadata. No secrets, child data, provider payloads, or live effects were accessed or introduced.

## Blockers, deviations, and recovery

No task-local blocker. This source checkpoint does not claim P08 composition, central middleware activation, candidate acceptance, or release.
