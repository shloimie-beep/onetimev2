MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

P20 is in an atomic runtime-triplet-only collision-correction claim on branch
`codex/v21-p20-media-processing`.

The claim has parent
`3d75b57e91c12ab3e0cad78b1a6a63497838f46f` and is authorized by containing
control `2cb1cb46f37c3178217745876e0f09d694bbebf9`, state-based control
`9d343f5b5990e0d5c38b2dc53f660b7377e2d64b`, canonical READY
`ba07246d1f3ed1d91828512ed588feca1f0b647928b2afb8b0e132aef3ae86ea`,
claim `e8c768e8-f603-4d0c-a45b-34b5cd7ea92c`, and CONTENT_PROCESSING lease
`24d0fa6f-30ac-4fc0-af2a-2b495d826063` through
`2026-07-30T07:30:12Z`.

This first push changes only:

- `ops/v2.1-execution/runtime/P20/HANDOFF.md`
- `ops/v2.1-execution/runtime/P20/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P20/TASK-STATE.yaml`

C00 next action:

1. Verify the claim is the sole child of `3d75b57e`.
2. Verify its delta is exactly the P20 runtime triplet.
3. Recompute its state/handoff and runtime-triplet digests.
4. Reconcile the claim in control before authorizing any source correction.

After reconciliation, P20 may change only the five source paths and implement
the exact approved-for-publication composite projection described in the
canonical READY entry. Migration 2246 is already applied; no migration or
steward-request edit is authorized. P21 stays withheld. P20 must not continue
past lease expiry or perform any provider/external effect.
