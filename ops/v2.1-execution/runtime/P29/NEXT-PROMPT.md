# P29 Corrected-Binding Atomic Claim — Next Prompt

Stop after publishing the corrected-binding atomic correction claim checkpoint.

Before any product repair:

1. fetch `origin/codex/v21-control`;
2. require C00 to have reconciled P29 correction claim
   `308031d1-15e8-4ff5-aca0-6560e9a8c93d`;
3. require the expected P29 branch head to equal the exact pushed atomic
   correction claim head;
4. require the same unexpired `GHL_CORE_WORKFLOWS` lease or a newly authorized
   replacement lease;
5. verify the new ready/resume entry and recompute its canonical payload digest.

Until those checks pass, do not edit product code, the P29 fragment, tests,
steward requests, migrations, interfaces, registries, composers, or provider
state. Do not restore named stash
`P29 product repair pending C00 reconciliation claim 308031d1`.
External-effect authority remains none.
