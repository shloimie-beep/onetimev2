# I36 P33 Interface Atomic Claim — Next Prompt

Stop after publishing this metadata-only atomic claim.

Before any P33 source admission or merge:

1. fetch the exact remote control and integration heads;
2. require C00 to have reconciled claim
   `d824f937-9896-4110-8b0b-567929ede386`;
3. require the next expected integration target to equal this pushed
   atomic-claim head;
4. require the same still-valid lease or a newly issued exact
   RELEASE_INTEGRATOR lease;
5. recompute the rebound ready and merge-item payload digests before reading
   the source for admission.

Until then, do not read, merge, or cherry-pick the P33 source, apply a steward
request, edit product or shared paths, or perform a provider or external
effect.
