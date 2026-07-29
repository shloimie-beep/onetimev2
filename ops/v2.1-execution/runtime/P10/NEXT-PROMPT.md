MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P10 from its remote atomic-claim checkpoint.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p10-admin-directory
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P10.yaml
Task context: ops/v2.1-execution/contexts/P10-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P10/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P10/HANDOFF.md

Fetch remote refs and resume the exact branch head. This first-run claim uses
containing control `eb3b0e1deecbffe05177a07df0d8e52d648d109c`, exact control
parent `de271a6cab5fc74e8c77b5defc302094fe9a22fc`, authorized start
`49431959f58f284bdc13ca931acf09f980fc483a`, claim
`f7e5889d-4db4-4818-a47f-5f26927597ae`, ready digest
`91d515fb029f45f7263b8aec6ee6ef39bac2066ab160428b5c253c94ff137587`,
and ADMIN_DIRECTORY lease `45e45c29-d8eb-49e2-960b-b1c2a545398f`. The lease
was issued at `2026-07-29T00:38:10Z` and expires at
`2026-07-29T01:38:10Z`; no effect lock or external authority exists.

Do not inspect dependency exports or implement product code until C00
reconciles this exact atomic claim and explicitly authorizes continuation. After
that authorization, follow `TASK-STATE.yaml:next_action`, inspect only the named
F03/F04/F07 interfaces and P10-owned paths, and perform no external effects.
