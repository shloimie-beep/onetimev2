# P08 Exact Family Signup Ready State — Next Prompt

Fetch `origin/codex/v21-control` and
`origin/codex/v21-p08-family-signup`, then verify:

1. the branch head equals the exact pushed ready-for-review head recorded by
   the completing task;
2. task state is based on correction verification/steward head
   `67fb8b74c5109e06fa2829797fed1ffa0ce995d4`;
3. superseding interface metadata head
   `594570798a5af8145d7949ba10572e8b1e644f17` binds implementation
   `8ab2c55c56e93fa343e6e50dd70a36ef193bd73e`, contract version `2.0.0`,
   artifact
   `502bb09dcf4e95ffba49951ca92ff6ae591be2ded7034493269349b73e8965ef`,
   and digest
   `32a4a8bedd1ef290ca8484033076923e8184eb6d52e13b6ec8cc871eeef0fa43`;
4. the checkpoint explicitly supersedes
   `ca06599ffbe62d7c617235f9e54f5ded57e4b6c7` /
   `922f9624679581868b598f4b89c94a5d2e53d650a2cd32e87a0ce88945002b0c`;
5. claim `60986795-c22a-4861-9e98-a93de2c1d22e` and lease
   `4dce3bb7-4411-4643-a367-d7e43adaabb8` are reconciled as released with
   zero external effects.

If review passes, C00 may admit the corrected task and integrate the
superseding Family-only interface for P09. Migration and registration work
remains steward-owned. P09 owns School command/form details behind the
preserved classification seam.
