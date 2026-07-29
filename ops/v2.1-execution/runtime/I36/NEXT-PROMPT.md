# I36 P33 Interface Release — Next Prompt

Stop after publishing this metadata-only release checkpoint.

C00 must reconcile:

- P33 source `295c125ec6ed3ea41382e5ea44db6f6be1b98933`;
- two-parent merge result `770696f88860d62f2cd7f9d30717b451ebdd77f7`;
- the pushed I36 metadata-only release head;
- released claim `d824f937-9896-4110-8b0b-567929ede386`;
- released RELEASE_INTEGRATOR lease
  `7ceb45bf-dcaf-441b-bed4-08c6ba798055`;
- zero steward, config, deploy, registration, and provider actions;
- zero external effects.

Before any further integration:

1. fetch the exact remote control and integration heads;
2. require a new C00-issued authorization whose expected target equals the
   pushed I36 release head;
3. require a new exact claim and unexpired RELEASE_INTEGRATOR lease;
4. recompute all rebound queue digests and independently verify source scope;
5. publish an atomic claim before reading a newly queued source for admission.

Do not reuse the released claim or lease. Do not apply any merged P33 steward
request without a new exact C00 authorization.
