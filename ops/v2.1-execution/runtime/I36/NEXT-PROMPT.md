# I36 P08 v2 Interface Release — Next Prompt

Stop after publishing this metadata-only release checkpoint.

C00 must reconcile:

- P08 source `e15a7af6cde557ff7f0fbbd55c12244780ca2321`;
- two-parent merge result `c389287c20e4813106cc9af67f01fd2a91a48f3b`;
- the pushed I36 metadata-only release head;
- released claim `2b9e5c96-4e10-45a9-9f59-aa2d7110cdd3`;
- released RELEASE_INTEGRATOR lease
  `1975bc3e-446f-473a-9872-92dd927fdc48`;
- zero steward actions and zero external effects.

Before any further integration:

1. fetch the exact remote control and integration heads;
2. require a new C00-issued authorization whose expected target equals the
   pushed I36 release head;
3. require a new exact claim and unexpired RELEASE_INTEGRATOR lease;
4. recompute all rebound queue digests and independently verify source scope;
5. publish an atomic claim before reading a newly queued source for admission.

Do not reuse the released claim or lease. Do not integrate P10 or apply any P08
or P10 steward request without a new exact C00 authorization.
