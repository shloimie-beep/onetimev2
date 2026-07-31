MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: PAUSE_FOR_C00_TERMINAL_COMPLETION_AUDIT

Audit the exact pushed I36 Parent auth/client terminal completion. Do not
perform candidate, provider, deployment, or other successor work from this
prompt.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Exact terminal parent: `2e62d79d0122360155dd10da9c2b2c13892eff89`
Containing control: `ce71f41af1c70f689db9b3346ae5dfc643a1344f`
Authority/control basis: `e621f71396b7d0a42eaead5b443eef03fadf84f2`
Claim: `8d8f5bb9-c439-48b6-9c19-b3e8f809a7ee`
Writer: `codex-i36-parent-session-successor-8d8f5bb9`
Shared lease: `49ae7724-b77a-4cc5-81f6-d16b6e1f5457`
Lease issued: `2026-07-31T02:21:40Z`
Lease expiry: `2026-07-31T04:21:40Z`
Lease release: `2026-07-31T03:31:32Z`
Terminal phase:
`parent_session_auth_client_successor_three_file_prettier_correction_and_terminal_validation`

Confirm all four slots—SERVER_COMPOSER, CLIENT_COMPOSER,
IDENTITY_AUTH_ACCESS, and ACCOUNT_HOUSEHOLD_IDENTITY—were released together
before expiry.

The terminal checkpoint must change exactly:

- `apps/web/src/server/app.ts`
- `apps/web/src/server/features/auth/v21-adult-session.test.ts`
- `tests/integration/accounts/v21-family-parent-session-composition.test.ts`
- `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/I36/HANDOFF.md`
- `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`

Confirm the three product/test outputs match the exact raw SHA-256 and Git
blob IDs authorized by control `ce71f41a`, and confirm the other seven
authorized product/test paths are byte-identical to parent `2e62d79d`.

Confirm workspace typecheck; focused auth/repository and pg-mem composition
tests; native PostgreSQL 18.4 lifecycle and six-way concurrent reservation,
exact bucket readback, successful release, and ineligible preservation; real
Chromium Parent reload/logout with zero legacy calls; production client/pages
build; all-ten configured Prettier; all-ten changed-file ESLint; repository
secret scan; YAML/diff/scope/ancestry/immutable gates; and effects `0/0/0`.

Confirm the existing PostgreSQL listener was preserved and not stopped. The
original wrapper/session identifier 51752 was absent at final readback, while
the PostgreSQL listener remained live under PID 8156. Confirm only the exact
owned disposable test schema was cleaned after successful verification.

Confirm the sole parent, exact six-path inventory, runtime digests, normal
push, clean local/tracking/live remote equality, simultaneous slot release,
and zero external effects. Only after C00 reconciles the exact pushed terminal
head may it authorize any candidate or external successor action. Stop.
