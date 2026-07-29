# P08 Atomic Follow-up Claim — Next Prompt

Stop after publishing the atomic claim checkpoint.

Before any product, contract, test, interface, or steward-request correction:

1. fetch `origin/codex/v21-control` and
   `origin/codex/v21-p08-family-signup`;
2. require C00 to have reconciled claim
   `a456f914-02cb-4c08-9717-af9709f1948a`;
3. require the expected P08 branch head to equal the exact pushed atomic claim
   head;
4. require the same unexpired FAMILY_SIGNUP lease
   `7b42f2bb-18ac-4f98-b86c-48b021afb66d` or a newly issued replacement;
5. verify the rebound ready-entry digest and exact authorized follow-up scope.

Until those checks pass, do not modify product code, contracts, tests, steward
requests, interface checkpoints, migrations, routes, registrations, or
provider state. External-effect authority remains none.
