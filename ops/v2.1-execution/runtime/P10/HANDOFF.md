# P10 Atomic Claim

## Identity

- Branch: `codex/v21-p10-admin-directory`
- Authorized start and sole parent:
  `49431959f58f284bdc13ca931acf09f980fc483a`
- Containing control authorization:
  `eb3b0e1deecbffe05177a07df0d8e52d648d109c`
- Control/ready-state parent:
  `de271a6cab5fc74e8c77b5defc302094fe9a22fc`
- Ready-entry digest:
  `91d515fb029f45f7263b8aec6ee6ef39bac2066ab160428b5c253c94ff137587`
- Claim mode: `create_new_branch`
- Claim: `f7e5889d-4db4-4818-a47f-5f26927597ae`
- Writer: `codex-p10-worker-f7e5889d`
- ADMIN_DIRECTORY lease:
  `45e45c29-d8eb-49e2-960b-b1c2a545398f`
- Lease issued: `2026-07-29T00:38:10Z`
- Lease expiry: `2026-07-29T01:38:10Z`

## Verified claim state

Fetched the corrected control ref and verified its exact sole parent. Parsed the
P10 `create_new_branch` ready entry and independently recomputed its canonical
sorted-JSON digest. Confirmed the exact authorized start, absent local/remote
branch, immutable package/task/context digests, F03/F04/F07 interface bindings,
claim, active ADMIN_DIRECTORY lease, registry state, and zero effect locks.

This atomic claim changes only:

- `ops/v2.1-execution/runtime/P10/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P10/HANDOFF.md`
- `ops/v2.1-execution/runtime/P10/NEXT-PROMPT.md`

No Admin directory product code, acceptance evidence, steward request,
migration, shared runtime, manifest, lockfile, or provider configuration was
changed.

## Exact next action

Push this three-file claim with sole parent
`49431959f58f284bdc13ca931acf09f980fc483a`, report the pushed claim head to
C00, and stop. Do not inspect dependency exports or implement product code until
C00 reconciles claim `f7e5889d-4db4-4818-a47f-5f26927597ae` and explicitly
authorizes continuation.

## Effects

External-effect authority is `none`; attempted/succeeded/reconciled effects are
`0/0/0`. No account mutation, credential reset, ownership transfer, message,
deployment, provider request, or canary was performed.
