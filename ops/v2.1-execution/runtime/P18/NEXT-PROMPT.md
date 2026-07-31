MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: STOP

Audit P18's terminal attendance projection callback authority and ordering correction.

Repository: `shloimie-beep/onetimev2`
Branch: `codex/v21-p18-attendance-projection-callback`
Exact correction parent: `e61aaeb384201f267b528e01c780f38cfc0c984d`
Live control verified: `864298e32e693599a804a5b152739de4ae17ee2b`
Final live control revalidation: `70b12ea370e8430bc80c0943231af98a3f5e6265` (P18 READY unchanged)
Claim: `2ed4aaa7-37d2-4862-b9cb-6a85365088fa`
Writer: `codex-p18-callback-correction-2ed4aaa7`
Released EMBEDDED_CLASSROOM lease: `89692d9a-5b1f-47b3-8b41-c96286936deb`
Released at: `2026-07-31T12:09:35Z`
READY digest: `862362d871eec64d5ad47b3399dad9672649cef2fe3cf70ed24432028322e1e7`
Seven-path inventory digest: `e2f0e38565e290e50f801cebe9e05d3a98af98af313bd9c35908538aa304925b`
Source manifest: `1aec3f57732e639247eb99f450f878991e197d0de866d5bbb3e2c1ac5126d340`

Derive the terminal SHA with `git rev-parse HEAD`. Verify it is the sole-parent
child of `e61aaeb384201f267b528e01c780f38cfc0c984d` and the full delta is exactly
the seven authorized paths.

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

Confirm 38 focused assertions, workspace typecheck, focused ESLint/Prettier,
YAML, diff, secret, locked/source manifests, migration-tree, forbidden-delta,
exact-scope, clean-push, and local/tracking/live equality. Effects must be
`0/0/0`. C00 audits; P18 must stop.
