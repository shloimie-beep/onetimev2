# P08 Family Signup Implementation — Next Prompt

Resume from the exact pushed interface checkpoint after verifying C00 still
authorizes claim `798ccc6e-82cc-4eb6-82ca-167cc3998042`.

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

The stable contract implementation is
`0c386529ea7e9487a457e51cc5be9500a6c29b52`, with interface digest
`f54e4381b53aa83522a2b15561a51a03319272a439afa8657c13655776c0d23c`.
Continue only within P08-owned globs: implement the domain planner, local-first
server transaction/recovery service, and public signup client model, then run
the full P08 verification and publish `ready_for_review`. Use structured steward
requests for shared registration, route, config, or migration work. External
effect authority remains none.
