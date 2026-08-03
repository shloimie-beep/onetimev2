# P21 replay/archive correction — terminal handoff

P21 is `ready_for_review` at the containing commit on
`codex/v21-p21-publication-scope-correction`. This is a source checkpoint, not
candidate readiness, operator acceptance, or production release.

## Authority and scope

- Clean start/local/tracking/live head:
  `3250bb761aa0d6fb84db77f637bc05eb5f1c444d`
- Live control: `0a2e8c390d48da157be35a2f9d06f876a70b5e62`
- Controller authorization:
  `45a6f2f589fc2fffe7c5dbd16c137282c4918185`
- READY digest:
  `ccad2b56eb4b33fc7a35cfc61625dad9d9de14863823d1c0e96242924306fec5`
- Claim: `cbec9b83-9d44-4d00-a797-fed83be43059`
- Writer: `codex-p21-replay-archive-cbec9b83`
- Released CONTENT_PUBLICATION lease:
  `f03e8f5d-10fc-40f1-8720-e39086b4a799`
- Exact eight-path inventory digest:
  `5b93f48fdc9d709b450316ac4423f5077d39a253ca317424263433eb444e6b19`

Control-plane note: the exact listed eight-path set matches READY, but its
stated LF-joined, no-final-newline recomputation is
`d3a605c5bd24812fc87d3795b76f3b1ee92eca60f3a4595434df747d32593829`,
not the control-recorded `5b93f48f…`. No path was added or omitted. The latter
is preserved as the authority value, not claimed as reproduced, and requires
C00/I36 metadata disposition during independent review.

## Corrected behavior

Pre-approval `needs_review -> archived` now uses a command-level scope
derivation discriminator. Only that exact transition, with `approval: null`,
may derive product, runtime tier, verification environment, and source identity
from the locked approved `content_processing_versions` / `content_sources_v21`
join. The repository rejects that derivation mode for every other transition.
Approved and post-approval transitions still require the exact approval
evidence and source binding.

Registration replay now always re-resolves the exact source, locks the
canonical aggregate, and verifies all four immutable ordered bootstrap events.
It then permits a write-free replay when the persisted publication and
canonical states agree at `needs_review` version 4 or at a valid canonical
successor after version 4. Incompatible state, changed source/hash/scope,
missing or changed bootstrap events, and invalid versions still fail closed.

No direct `canonical_aggregate_states` DML was added. Canonical changes remain
event-only and transactionally coupled to publication changes.

## Proof

The five focused files pass with 31 tests, retaining all prior 29 assertions.
The new service proof covers:

- register then archive before approval -> publication archived/version 2,
  canonical archived/version 5, and zero provider-operation or outbox work;
- register, approve, then exact register retry -> no new canonical event;
- exact retry after publication-only version divergence -> no canonical write.

The repository proof covers the exact approved processing/source join,
pre-approval archive derivation, invalid derivation rejection, compatible
successor replay, and publication/canonical version independence.

A disposable native PGlite run applied real migrations 2234, 2245, and 2246.
It reproduced canonical archived/version 5 with five events, zero writes for
both replay cases, and append-only deletion rejection.

Workspace typecheck, focused ESLint, focused Prettier, steward-request schema,
secret scan, static event-only DML, exact scope, diff, and artifact/hash gates
all pass. Implementation artifact digest:
`0e512a204943046e3710a44cdd514f690d54e2665a02c381f36909ab84a95e97`.

## Immutable dependencies and effects

`P21-registration-003` remains byte-identical at raw SHA-256
`0100943c4acb2104fd1e5d755f860a675944ce19b1a0b92188dcac84ac19ed16`.
It remains proposed, unapplied, and pending C00/I36 disposition. No migration,
steward application, shared registration, integration, candidate, provider,
deployment, DNS, send, charge, customer activation, or external effect was
performed. Effects are `0/0/0`.

The P21 branch inherits the earlier migration-2253 bytes; the canonical
downstream integrated migration dependency remains the immutable corrected
raw SHA-256
`b96fae17a3ab9a13444787f7419366b0cd997e7a2754167b3c759d7074ff2c81`.
P21 did not touch either migration lineage.

## Exact next action

C00 or I36 verifies local/tracking/live equality, the exact eight-path delta,
the implementation digest, focused/native/static evidence, and immutable
registration-003. It then integrates the exact terminal head and dispositions
the request, or returns one bounded evidence-backed rejection.
