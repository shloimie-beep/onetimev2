# I36 P10 Full Atomic Claim — Next Prompt

Stop after publishing this metadata-only atomic claim.

Before any P10 source admission or merge:

1. fetch the exact remote control and integration heads;
2. require C00 to have reconciled claim
   `ba9b0d15-c3c4-4f68-89b9-f96eb9626e8d`;
3. require the next expected integration target to equal this pushed
   atomic-claim head;
4. require the same still-valid lease or a newly issued exact
   RELEASE_INTEGRATOR lease;
5. recompute the rebound ready and merge-item payload digests before reading
   the source for admission.

Until then, do not read, merge, or cherry-pick the P10 source, apply a P08 or
P10 steward request, edit product or shared paths, or perform a provider or
external effect.
