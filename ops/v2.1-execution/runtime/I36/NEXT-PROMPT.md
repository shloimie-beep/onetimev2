# I36 Integration — Next Prompt

The P08 interface item was withdrawn before source admission. Claim
`a2ae8e13-f123-4190-badc-58269ced4219` and RELEASE_INTEGRATOR lease
`d2df925f-32a0-42e6-8ed5-fd018962f87d` are released with zero effects.

Before any further integration work:

1. fetch `origin/codex/v21-control` and `origin/codex/v21-integration`;
2. require a new exact C00 ready/resume entry and unexpired lease;
3. require its expected integration head to equal the exact pushed release
   checkpoint;
4. verify the canonical ready and merge-item payload digests;
5. only then read a queued source for admission.

Do not merge P08 from the withdrawn item or reuse the released claim.
