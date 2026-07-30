# F03 Handoff

## Identity

- Branch: `codex/v21-f03-adult-student-auth`
- Start SHA: `d8b35b2aaa0dc4b687b6e88192c7eac6222ecdec`
- Implementation SHA before this handoff metadata commit: `56fa990c5d4a6cb7b602b5f68fe0d2402a0ee71e`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `8474eeb85ea4c7991c1a42a798c1c3f6a3cda9f2b9a3b51b7c15617b5817ba27`
- Context digest: `9ccc41a037fe9163800d56e8b34991d46e63399a46f3b6f47c986fa200e2ce5e`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Controller authorization: `398ebf34ec72892d354370af11af297d45302888`
- Claim: `0b100424-7be3-4613-ae07-e7019d140a30`
- Released writer lease: `IDENTITY_AUTH_ACCESS` / `82b0973d-b5b7-4ea6-9618-a5c50d3b14ba`
- Interface contract: `66464e9a769c717dfdfda082bb8a26030da1681d601d6752fb04b10d812db111`

## Completed behavior

- Published exact v2.1 role, password, Argon2id, session, token, rate-limit, CSRF, secure-cookie, safe-return, lifecycle, and cross-domain security contracts under the required auth export roots.
- Implemented exact adult email/password and Student username/password policy without MFA or a routine email challenge.
- Applied role-specific idle/absolute session expiry, credential/session revocation, generic token semantics, and setup/reset single-use expiry and supersession.
- Applied exact Unicode password bounds without composition rules, identity/common/compromised-password hooks, and transparent legacy credential rehash.
- Normalized `owner` and `rabbi` migration-history rows to public `admin` principals.
- Applied immutable request `F01-retired-auth-001` at `56fa990c5d4a6cb7b602b5f68fe0d2402a0ee71e`; the direct database proof confirms a valid owner password returns an Admin principal and creates zero email challenges and zero trusted-device artifacts.

## Remaining work

C00/I36 must validate and integrate the published interface checkpoint, record the applied F01 steward result, notify F01 for acknowledgment, and authorize downstream tasks from the resulting integration head.

## Exact next action

Await C00/I36 interface integration. Resume only under a new exact C00-issued lease for review or integration feedback.

## Coverage

- Requirements: 16 implementation-ready
- Acceptance cases: 22 implementation-ready

## Changed files and migrations

- Runtime: `ops/v2.1-execution/runtime/F03/{TASK-STATE.yaml,HANDOFF.md,NEXT-PROMPT.md,INTERFACE-CHECKPOINT.yaml}`
- Client/server helpers: `apps/web/src/{client/auth/token-fragment.ts,server/features/auth/http-security.ts}`
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

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

Raw password and token values are never persisted by the new interfaces. Tokens are hash-only outside the one-time return value; generic denials avoid enumeration; Student email and HighLevel contact creation are explicitly forbidden. No secrets, child data, provider payloads, or live effects were accessed or introduced.

## Blockers, deviations, and recovery

No blocker. C00 must record the applied immutable steward result before F01 can acknowledge it.
