# I36 P08 v2 Interface Atomic Claim — Next Prompt

Stop after publishing this metadata-only atomic claim.

Before any P08 source admission or merge:

1. fetch `origin/codex/v21-control`, `origin/codex/v21-integration`, and the P08
   source branch;
2. require C00 to have reconciled claim
   `2b9e5c96-4e10-45a9-9f59-aa2d7110cdd3`;
3. require the next expected integration head to equal this pushed
   atomic-claim head;
4. require the same still-valid lease or a newly issued exact
   RELEASE_INTEGRATOR lease;
5. verify the rebound ready and merge-item payload digests before reading the
   source for admission.

Until then, do not merge or cherry-pick P08, inspect the source for admission,
apply a steward request, edit product or shared registration paths, move a
candidate, or perform a provider or external effect.
