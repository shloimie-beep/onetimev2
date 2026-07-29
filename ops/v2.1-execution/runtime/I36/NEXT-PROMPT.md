# I36 P08 Interface Atomic Claim — Next Prompt

Stop after publishing the atomic claim checkpoint.

Before reading or merging the P08 source:

1. fetch `origin/codex/v21-control` and `origin/codex/v21-integration`;
2. require C00 to have reconciled I36 claim
   `a2ae8e13-f123-4190-badc-58269ced4219`;
3. require the expected integration head to equal the exact pushed atomic claim
   head;
4. require an unexpired RELEASE_INTEGRATOR lease whose phase scope authorizes
   P08 interface integration rather than claim-only work;
5. require a rebound merge item whose expected target equals the atomic claim
   head and verify its canonical payload digest;
6. only then perform source ancestry, scope, state/handoff, export-blob,
   canonical contract-digest, implementation-ancestry, and zero-effect
   admission checks.

Until those checks pass, do not read the queued source for admission, merge,
apply a steward request, edit shared registrations, move a candidate, or
perform any external effect.
