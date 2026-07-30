# P08 Corrected Registration Source - Next Prompt

Fetch `origin/codex/v21-control` and
`origin/codex/v21-p08-registration-server`. Treat the branch tip as the
terminal metadata checkpoint and verify its sole parent is corrected
implementation `1550e6682ff1bcacdea260d1b6b80ec231381ded`.

Independently verify:

1. implementation `1550e6682ff1bcacdea260d1b6b80ec231381ded` has sole
   parent `30de59df0555058fc021bc6002a3dffc4e3ea916` and is reviewed
   against base `9cb28a0078e3dfe814cfca34cf93000993416ce8`;
2. the cumulative base-to-implementation diff contains exactly the fourteen
   recorded P08 product/request paths, while `apps/web/src/server/app.ts`,
   `packages/config/src/index.ts`, and
   `tests/unit/config/v21-verification-environment.test.ts` equal base;
3. source contract version `2.1.0`, export SHA-256
   `a29ab4b30049719e530ca38eb0c78671d171959c694d4b6593a5c688caf4dd4c`,
   and derived contract digest
   `800fe2387b47b064d89e2a272253c24c4594deea4b992943fbc3cf3a494bcfcd`
   reproduce, without treating the unissued checkpoint as integrated;
4. `P08-auth-household-002` reproduces raw/canonical SHA-256
   `600bdc4618a4812ea2ad0cfcdd6074b9ce69d99124991e8be7b21a5c5ed731fc`
   /
   `aa7628c7665033ea0ad85ff10fc36a8890cadc6202314dec712feeb4f1db9860`;
5. `P08-config-002` reproduces raw/canonical SHA-256
   `88fcdc20555bcf044455cebf30fbad4e91af89432ee7dd6768114c0d4de24b19`
   /
   `d7131affc30ad18aba0a691ffda5410195f3bec829aca1e8f3a270bdec6f26be`;
6. `P08-registration-002` reproduces raw/canonical SHA-256
   `0b0b82567be04624d0facf501dbc9d5fb418d0d86b79462f6220e8d8b56856d3`
   /
   `da27ec8f95da3007e3bf51edec04d18cac093e1c1a568c67fa79d360ced6b5f5`;
7. predecessor request Git blobs remain
   `0822e598cf2bb619f6968e5fbba2fad3c2a103c7` and
   `d27d048cfca13a0193ec7718eec20c8ed22141ba`;
8. the focused 29-test proof, native PGlite proof
   `P08_NATIVE_OK adults=2 households=2 signups=2 commercial_commands=3 hosted_checkout_jobs=1`,
   and zero external effects are accurately recorded.

If independent review passes, admit the source head without calling it
integrated or released. Then:

1. I36 dispositions `P08-registration-002` and `P08-config-002`; F03/F04
   disposition `P08-auth-household-002`.
2. F03/F04 implement the v2.1 session writer/current resolver and repair the
   invalid `v21_households.display_name` household-label read.
3. I36 adds the central route/config bindings, required root-barrel exports,
   and shared registration/configuration tests.
4. P27 adds the adult-only outbox consumer and canonical GHL readback.
5. F06 gates P25 worker dispatch with the exact provider binding, exclusive
   lock, fencing token, and reconciliation.
6. F07/I36 add truthful session success and the safe one-use checkout redirect
   handle.
7. C00/I36 publish the independently recomputed semantic-contract `2.1.0`
   checkpoint and only then advance candidate evidence.

Do not perform a provider effect, create or expose a checkout URL, send a
message, enroll a workflow, create a Student contact, charge, mutate Stripe,
deploy, change DNS, or edit an applied migration from this handoff.
