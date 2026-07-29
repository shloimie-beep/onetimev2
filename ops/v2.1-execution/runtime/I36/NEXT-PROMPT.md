# I36 P10 Full Release — Next Prompt

Stop after publishing this metadata-only release checkpoint.

C00 must reconcile:

- P10 source `5fccc34507ae9c5dbc609e234ab559576ab3a445`;
- two-parent merge result `522fe505eca226ee7053e38bb67be5af78af79d6`;
- the pushed I36 metadata-only release head;
- released claim `ba9b0d15-c3c4-4f68-89b9-f96eb9626e8d`;
- released RELEASE_INTEGRATOR lease
  `8f1bf970-a69c-463d-98d2-a97f3591fd10`;
- zero steward, migration, registration, and provider actions;
- zero external effects.

Before any further integration:

1. fetch the exact remote control and integration heads;
2. require a new C00-issued authorization whose expected target equals the
   pushed I36 release head;
3. require a new exact claim and unexpired RELEASE_INTEGRATOR lease;
4. recompute all rebound queue digests and independently verify source scope;
5. publish an atomic claim before reading a newly queued source for admission.

Do not reuse the released claim or lease. Do not apply the merged P10 steward
request without a new exact C00 authorization.
