MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

V37 is terminal at `ready_for_evidence_merge` for candidate `ea45b0ab10ec540444e274cad90400ab02d1820efabd5df06bf1318f3b82876d` and source `0a5ef2e1e6ba88b151334f2aa78bee9cd8949365`.

Fetch `origin/codex/v21-control` and `origin/codex/v21-verify-ea45b0ab10ec-v37`. Require C00's exact expected branch head before any resume. Read `TASK-STATE.yaml`, `HANDOFF.md`, and `results/ea45b0ab10ec540444e274cad90400ab02d1820efabd5df06bf1318f3b82876d/V37/SUMMARY.yaml`.

The current terminal records 55/55 attempts: 44 passed, five failed, six blocked, zero stale/waived, zero unexpected effects, and no cleanup. Do not rerun or overwrite valid attempts. C00 should validate and queue the exact evidence head for I36 aggregation. Any retry requires a new frozen candidate or newly authorized environment/effect, a fresh C00 resume lease, and a new immutable attempt that supersedes the current digest.
