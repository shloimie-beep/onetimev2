# P08 Atomic Correction Claim — Next Prompt

Stop after publishing the atomic correction claim checkpoint.

Before any product or contract correction:

1. fetch `origin/codex/v21-control` and
   `origin/codex/v21-p08-family-signup`;
2. require C00 to have reconciled claim
   `e9148002-e9ff-4b7c-ab6e-63080c66bd00`;
3. require the expected P08 branch head to equal the exact pushed atomic claim
   head;
4. require the same unexpired FAMILY_SIGNUP lease or a newly issued replacement;
5. verify the rebound ready-entry payload digest and exact correction scope.

Until those checks pass, do not modify product code, contracts, tests, steward
requests, interface checkpoints, migrations, routes, registrations, or provider
state. External-effect authority remains none.
