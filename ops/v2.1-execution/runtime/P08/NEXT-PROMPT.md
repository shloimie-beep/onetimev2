# P08 Corrected Ready State — Next Prompt

Fetch `origin/codex/v21-control` and
`origin/codex/v21-p08-family-signup`, then verify:

1. the branch head equals the exact pushed ready-for-review head recorded by
   the completing task;
2. the task state is based on correction verification head
   `3f030e734e31da548ace6ca619f38eb27968f3a4`;
3. superseding interface metadata head
   `ca06599ffbe62d7c617235f9e54f5ded57e4b6c7` binds implementation
   `c903d1df6a0c3ee94a700fe62b4e1c0b3c3eeb72`, contract version `1.1.0`,
   and digest
   `922f9624679581868b598f4b89c94a5d2e53d650a2cd32e87a0ce88945002b0c`;
4. the checkpoint explicitly supersedes
   `b7601c002d2c37d0ef7760c328015f9a8d590893` /
   `f54e4381b53aa83522a2b15561a51a03319272a439afa8657c13655776c0d23c`;
5. claim `e9148002-e9ff-4b7c-ab6e-63080c66bd00` and lease
   `23274fa2-66cc-4cfd-8d6c-ba659d70a323` are reconciled as released with
   zero external effects.

If review passes, C00 may admit the corrected task and integrate the
superseding interface for P09. Migration and registration work remains
steward-owned. Do not use public signup to create another household for an
existing account.
