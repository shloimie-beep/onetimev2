# P30 Corrected Campaign Workflows — Ready for Review

## Identity

- Branch: `codex/v21-p30-campaign-workflows`
- Authorized integration start:
  `49431959f58f284bdc13ca931acf09f980fc483a`
- Adopted repair implementation:
  `f6d074e964cebefe032042b9627d7c7b47304bdd`
- Corrected-binding atomic claim:
  `8e9583a9b47b486930e79e3586c36bf882dba375`
- This ready-for-review final: derive with `git rev-parse HEAD`; C00 records the
  pushed head
- Repaired containing controller:
  `0c911664217efe3dbb89b93b6fe29eb9eda2fec3`
- Ready-entry parent:
  `e54ea923a743caf760ef47638a2c8d8a875faf34`
- Ready-entry digest:
  `380e1f3ddfa39b986befe6aa58506783f7e295c4aa5e421a6b69821226a51553`
- Reconciled finalization control:
  `268ab601b89573238befe70de7995908925575cc`
- Reconciled control parent:
  `5b0356cc30baf4062e50664f9749ebcf97f9d7f4`
- Claim: `87608f7e-3d2b-448b-8376-da025b05d1b7`
- Writer: `codex-p30-worker-87608f7e`
- GHL_CAMPAIGNS lease:
  `a77f21df-1741-46ea-a8c7-f13f6aa9e5f0`
- Lease expiry: `2026-07-29T01:13:59Z`
- Lease released: `2026-07-29T00:32:24Z`

## Correction result

The adopted implementation fully resolves the bounded correction findings.
OT-15 can no longer launch or deliver from step 1 approval alone: it resolves
all three configured IDs through the canonical catalog, validates each exact
copy contract, and independently applies digest-backed approval evidence. The
currently absent step 2 and step 3 catalog entries therefore block launch.

P30 did not invent bodies for those missing messages.
`P30-copy-registration-001` asks the canonical copy owner to author, approve,
and register them under the exact IDs and subjects. The existing registry
request now explicitly depends on that copy registration.

OT-16 recomputes the canonical operation ID from workflow key, adult, expiry,
and checkpoint and rejects any mismatch before persistence or provider access.
After durable reservation, the worker reads current eligibility immediately
before dispatch; paid, explicit-decline, and custom-School transitions complete
as skipped decisions with zero provider calls.

## Verification

- Focused campaign and worker tests: 12/12 passed.
- Typecheck and full lint: passed.
- Focused formatting: passed for every P30 material path.
- YAML/TypeScript drift: 3 workflows × 15 contract keys passed.
- Secret scan: passed across 2719 repository text files.
- Full unit suite: 566/567. The sole failure is the inherited P28 registry
  projection count assertion (19 expected versus 22 integrated), covered by
  `P28-registry-projection-001`; P30 changed neither failing surface.
- Repository-wide formatting still reports 2235 inherited files; all P30 paths
  pass focused formatting.

Material SHA-256 digests are recorded in `TASK-STATE.yaml`. The workflow
fragment digest is
`37cb0350e141ef1928bcb8d4f2c55dca355452e09b9dcf6824b77245f35088cb`;
the copy and registry request digests are
`0fbfef8bc01adcbc6d683be66afc59ceb5e2981d69756edb5d2089f9d1dbc9cf`
and
`8c6b582f4265cf9f5cd0f51c302ea239c40d1c5ca3bfc27805c15bd699e52644`.

## Scope and effects

Repair commit `f6d074e9` has sole parent `2f2aa5c9` and changes exactly nine
P30-owned product/test/fragment/steward-request paths. Claim `8e9583a9` has sole
parent `f6d074e9` and changes only the three task-local runtime files. No
migration, central registry/composer, package, provider, enrollment, or external
effect occurred.

## Exact next action

C00 and I36 should review this exact final and integrate it with ancestry
preserved. OT-15 must remain fail closed until the copy-owner request is
adjudicated and all three exact canonical approvals exist; the central workflow
registration request is separately stewarded.

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.
