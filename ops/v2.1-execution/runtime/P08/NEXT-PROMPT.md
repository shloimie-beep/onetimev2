# P08 Atomic Claim — Next Prompt

Stop after publishing the atomic P08 claim checkpoint.

Before any contract or product work:

1. fetch `origin/codex/v21-control`;
2. require C00 to have reconciled P08 claim
   `798ccc6e-82cc-4eb6-82ca-167cc3998042`;
3. require the expected P08 branch head to equal the exact pushed atomic claim
   head;
4. require the same unexpired `FAMILY_SIGNUP` lease or a newly authorized
   replacement lease;
5. verify the new ready/resume entry and recompute its canonical payload digest;
6. then follow `ops/v2.1-execution/prompts/P08-START-OR-RESUME.md`.

Until those checks pass, do not inspect or edit product code, contracts, tests,
steward requests, interface checkpoints, migrations, composers, provider state,
or deployment state. External-effect authority remains none.
