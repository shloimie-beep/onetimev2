# F02 Lease A Metadata-Correction Atomic Claim

- Parent/head before claim: `e8dcbd750ce41424102b4d2ead4b786ff3c9c764`
- Containing control: `c1e744b0f31ce430ef1dc4c98f82844f97fddae4`
- Sole control acquisition: `21f0ae2f2b79d0ba179d6e4cb7dd7f0b39a26ff0`
- READY digest: `fb3f35593548c28c591dbeef4eb5c4997f9858abc1734668cb98ad867d17ae42`
- Claim: `937b224d-ee11-4936-82d7-719f177d31da`
- Shared lease: `08ae9549-daf0-42fc-8938-7c5e5b28030f`
- Lease expiry: `2026-07-29T20:23:53Z`
- Effects: attempted `0`, succeeded `0`, reconciled `0`

This checkpoint claims only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. The allocation proposal and all four SQL files remain
unchanged. The admitted correction is limited to recording distinct native
and pg-mem checksums in the proposal/runtime evidence and formatting those
four metadata files after C00 reconciles this claim.

Stop for C00 reconciliation. No SQL edit, ordinal allocation, registration,
provider access, deployment, send, or external effect is authorized.
