MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: CONTINUE

Audit and reconcile the exact I36 Family Parent-session composition release
before resuming I36.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Authorized start: `524563f07b3bb8544db989982dc55d4bc86a1999`
Containing control: `90e70b07e5b10a16342e80c4f8b537a8ea21263c`
Authorizing/state-basis control: `1d0fb443cde2ab992215a52f09c35ae56a97458f`
Claim: `2e5c6cef-5e9d-4462-92a4-41510ac24959`
Lease: `1af50c79-1fb7-42b7-96e4-a29d8d8873f5`, released at
`2026-07-30T22:50:00Z` before expiry
READY: `09952344b45d7b9f63419a5e5b167a6d49bbc9f5edb15d90283b81361dbd3257`

The release must contain exactly five paths: `apps/web/src/server/app.ts`, the
new real-composition integration test, and the I36 runtime triplet. Confirm
that one default PostgreSQL v2.1 runtime is shared by central P08 Family
signup and Parent shell middleware; host-cookie presence forbids legacy
fallback; `/app/parent` descendants and `/select-household` use the F03
authorization policy; and denial is fail-closed before shell or data.

Verification passed the one-test real composition suite, five existing
P08/F03/F04 files with 37 passes and three declared native-PostgreSQL skips,
workspace typecheck, changed-file ESLint, focused Prettier, secret scan across
3,110 files, and diff hygiene. Three selected portal/auth failures reproduce
unchanged at exact base `524563f0`: legacy viewer role unavailable, missing
production protected-payload test key, and stale login markup expectation.

Reconcile only `P08-auth-household-002` as applied from the exact release
proof. Keep `P08-config-002` and broad `P08-registration-002` unapplied.
Preserve the explicit limitations: signup state and session creation retain a
retryable post-commit recovery boundary and are not cross-transaction atomic;
legacy Parent API handlers outside the shell routes remain `otcrm_session`
bound pending separate authority.

No F03, F04, P08, migration, control-ledger, provider, registry, candidate,
deployment, DNS, send, billing, or customer state changed. Effects are
`0/0/0`. C00 must audit the pushed head, exact five-path scope, runtime
state/handoff and triplet digests, lease release, tests, unchanged-baseline
reproduction, and clean live remote equality before issuing new exact
authority. Do not continue I36 from this prompt.
