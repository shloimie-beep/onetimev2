MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: STOP

Audit P18's final runtime-only evidence-count correction.

Repository: `shloimie-beep/onetimev2`
Branch: `codex/v21-p18-attendance-projection-callback`
Exact metadata parent: `abc2be5b19f5539a4e3bcea55886f5ff12d5de64`
Containing control: `4105c365a90ecb27fb930077ecaf02a9125edb38`
State basis/acquisition: `3a94de302ae0f7784dd5b5e47e850df4babde74c`
Claim: `1904184a-8dbd-4876-b7bd-3715ed4272c0`
Writer: `codex-p18-evidence-count-1904184a`
Released EMBEDDED_CLASSROOM lease: `8700aa39-5041-4aa8-bf35-398cb86ba6f6`
Released at: `2026-07-31T12:38:56Z`
READY digest: `0fe5cd8ae06a590b61a9081efd60d73569ce4a1ee785f7172f0329c57c791feb`
Three-path inventory digest: `a1faaf0d274b87576b567dcd9aa305184598dd8c7bd9d44dd526fc97cd7b76f8`
Source manifest: `1aec3f57732e639247eb99f450f878991e197d0de866d5bbb3e2c1ac5126d340`

Derive the terminal SHA with `git rev-parse HEAD`. Verify it is the sole-parent
child of `abc2be5b19f5539a4e3bcea55886f5ff12d5de64` and the full delta is exactly
the three authorized P18 runtime paths.

Verify a new attendance event commits only with an exact one-row versioned
projection advance; zero-row projection writes roll back event and callback;
exact replay remains a no-write callback repair; the transaction queries and
binds exact latest stored correction state, reason, Admin, audit, source digest,
and immutable event identity before COMMIT; older, different, hidden, and
unprovable correction authority rolls back without callback; and exact older
correction replay remains idempotent.

Verify domain ordering is explicit UTF-8 byte order and PostgreSQL uses the
identical `convert_to(attendance_event_id, 'UTF8')` order, including adversarial
punctuation and Unicode reversal cases. Preserve contract raw SHA-256
`005669a0fabc71ad0f52cf48037db783fa88a62fc460e6f64b2d22250563dce5`.

Confirm the exact relevant focused evidence total is 35: repository 21, domain
10, and server callback contract 4. Validate only YAML, committed raw hashes,
raw-byte pair/triplet digests, exact three-path scope, ancestry, expected head,
clean push, and local/tracking/live equality. Do not rerun tests, typecheck,
lint, native DB, full suite, or secret scan. Effects must be `0/0/0`. C00
audits; P18 must stop.
