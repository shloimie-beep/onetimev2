# P23 Atomic Claim Handoff

## Identity

- Branch: `codex/v21-p23-student-notifications`
- Authorized start:
  `cecc1c0dc6ff57562e5d89dd731289d860086bf7`
- Containing controller:
  `9f1609933ceeaa315115a49d8612276002e33330`
- Ready-entry parent/acquisition:
  `2dc1ffa0f4c3a2de22cfd8660571a355cda0b928`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the exact
  observed remote head.
- Claim: `68340416-7e06-4986-a125-59d81b500a0b`
- Writer: `codex-p23-worker-68340416`
- STUDENT_NOTIFICATIONS lease:
  `45041adc-a69f-4065-a179-b94473967c94`
- Lease issued: `2026-07-29T06:26:07Z`
- Lease expiry: `2026-07-29T07:26:07Z`
- Ready-entry digest:
  `b0598496f6d52eb63e801cb0ac7741344256ff2dd1481916ab00c41e2b9b694f`

## Exact dependency bindings

- F05: task `9174d845e1c04916e2f1884cfadfaef624ac6862`,
  integration `9782a4164662b8059a557c0969de9c35f54d0cf7`, interface source
  `0656380bcfc50cc464dcea7588448dc724049599`, implementation
  `1ade14c52e42e59bb8fd1d1de776b91406c45f15`, checkpoint digest
  `fd17c478bfc851dcb434b8e0c2750701605b80dfdf880833a6a2993e8fad6329`,
  task packet digest
  `807393d09cb614e05625677818976930cf4a14e07e65bb488f647cdcd3b63ec3`.
- F07: task `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`,
  integration `91349fc1fa9a474ae31cf408ae0364aa10520385`, interface source
  `47a2bb6b76225951e0599683499a95f4dc9881be`, implementation
  `a90baae8cf69d6823af6d741161fe0e9e7441321`, checkpoint digest
  `366a1b30f724afc35e525f3f3175a4c84a45b7c13681cea1a17060bee75e4188`.

All package-lock, source-manifest, task, context, interface, and ancestry gates
passed against the exact authorized start.

## Scope and stop

This atomic first phase creates only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md` under P23 runtime memory. Requirements OTV2-NOTIFY-203 and
OTV2-NOTIFY-237 are claimed but not started; their three named acceptance
cases have not run.

No product, source, provider/send, steward, migration, registration, shared,
or external-effect work was performed. C00 must reconcile the exact pushed
claim head before P23 resumes. Stop after push and remote verification.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
