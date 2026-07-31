MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: PAUSE_PENDING_FRESH_CLAIM

Verify the exact pushed I36 renewal checkpoint before resuming work.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Authorized start: `a5a2ad94b77eaf596930609d4d5abe4fa672439b`
Implementation checkpoint: `5285a71e34fdb5fe7701a05aac0f31e2950360bc`
Containing control: `50ebdcdb345bf13bd76d9af013c25855bc369836`
State-basis control: `90e70b07e5b10a16342e80c4f8b537a8ea21263c`
READY: `9da7b8a521b2ff8f4da4cd502c3903fceb8b7f4fcce938cdf24a3ec7051656b2`
Historical claim: `ef14f276-f6a2-45a5-b35d-d45d37572ca5`
Historical writer: `codex-i36-parent-session-successor-ef14f276`
Historical lease: `21315060-463e-49a8-a246-20057483ec20`, released at
`2026-07-31T00:54:34Z` before its `2026-07-31T01:18:02Z` expiry

This is a renewal checkpoint, not a terminal release. It contains exactly ten
authorized product/test paths and the I36 runtime triplet. Bounded validation
passed workspace typecheck, twelve adult-session unit tests, focused Prettier,
and diff hygiene. Terminal native PostgreSQL, browser, build, lint, and secret
validation remain pending.

C00 must reproduce the remote checkpoint and exact 13-path scope, then issue a
fresh claim and new lease against that exact pushed head. Only after that may
I36 resume:

1. finish and prove linearizable pre-Argon login reservations;
2. finish and prove invalid-versus-unavailable session propagation without
   clearing valid cookies on repository outage;
3. prove invalid CSRF preserves retryable browser credentials and verified
   logout clears only after exact revocation;
4. propagate unverified password-upgrade cleanup as recovery-required;
5. complete and read back redacted v2 logout audit evidence; and
6. run the real Parent bundle through reload/logout and prove zero legacy
   session, dashboard, contact, or shell calls.

Then run native PostgreSQL and all changed-area terminal validation, update the
runtime triplet honestly, release the fresh lease, and push. Effects are
`0/0/0`. Do not resume from this prompt without a fresh C00 claim and new
lease.
