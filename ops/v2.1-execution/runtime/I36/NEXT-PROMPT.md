MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: CONTINUE

Audit and reconcile the exact accepted-source-microbatch-1 terminal runtime
release before resuming I36.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Runtime-final parent: `dd819ae6188a89a38f3339f816afa4b206fd0860`
Authorizing control: `26f29aeb6734948dd8b80ab85a342831defaecc9`
State-basis control: `f2b4a9faefdb5f780c9b620fedb413d408d27a19`
Claim: `870b6724-6099-4aa1-aa65-219efc121daf`
Lease: `4929adfc-2383-4f16-bda9-04287e046333`, released before expiry

Exact admitted merge results:

1. F02 `131413297b7eb6510a1e12d44337e576406cafae`
2. P20/P21 `4c2d9a6c51ac3106d4f9cf8426d4d35f3fca92ee`
3. P08 `e1dce668fb452a4c1892a33ea6d9c37061603aef`

Harness implementation `dd819ae6` adds only the exact four pg-mem signatures
and full-inventory read-only verification. Focused tests passed 78/78. Native
PostgreSQL 16.14 applied, replayed, and verified 84/84 migrations with zero
pending. Effects are `0/0/0`.

C00 must audit the exact pushed terminal head, consume I36 READY, reconcile
the source items and the F02 2253 allocation mirror, and then issue a new exact
READY/lease for the next bounded integration checkpoint. Do not apply central
feature registrations, configuration, provider registries, candidate state,
deployment, or external effects from this prompt.
