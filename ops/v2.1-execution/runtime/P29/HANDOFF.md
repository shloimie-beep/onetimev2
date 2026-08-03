# P29 Corrected Core Workflows — Ready for Review

## Identity

- Branch: `codex/v21-p29-core-workflows`
- Authorized integration start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Corrected atomic claim head:
  `56fcfceed0c6dcf5ff6107ee1987c1047dbb404a`
- Correction implementation:
  `cad2c6f2a8aeb875dcf5122ae1ebe9ca012bf507`
- Claim: `308031d1-15e8-4ff5-aca0-6560e9a8c93d`
- Claim authorization:
  `0c911664217efe3dbb89b93b6fe29eb9eda2fec3`
- Reconciled correction authorization:
  `268ab601b89573238befe70de7995908925575cc`
- Reconciliation acquisition parent:
  `5b0356cc30baf4062e50664f9749ebcf97f9d7f4`
- Ready-entry digest:
  `634d4c807f31e08fd411457021d1bec960d70764cbe88b3c8339111a283455c2`
- GHL_CORE_WORKFLOWS lease:
  `8f82be8b-7a99-4edb-a079-d485b402729a`
- Lease released: `2026-07-29T00:31:30Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## Corrected implementation

All 12 P29 workflows now fail closed unless a separately read trusted approval
snapshot confirms both audience and copy approval. The planned content and
audience digests must exactly match the approved digests before reservation or
delivery, including OT-02B. Provider readback drift is also compared with those
trusted approved digests.

Traceability now uses exact `OTV2-GHL-*` requirement IDs and separate exact
`OTV2-GHL-*-AC01` acceptance-case IDs. OT-01 explicitly projects the
`one_time_family_signup` lifecycle. OT-10 requires Admin approval and
provider-readback evidence before planning, reservation, delivery, and provider
readback.

The corrected steward requests bind the approval-read port, exact traceability,
OT-01 projection, digest drift, and OT-10 evidence requirements.

## Verification

- P29 domain and worker suites: 58/58 passed.
- Targeted ESLint: passed.
- TypeScript typecheck: passed.
- Prettier check: passed.
- Secret scan: passed across 2720 repository text files.
- Fragment YAML and exact traceability validation: passed for all 12 workflows.
- Full unit suite: 566/567 passed.
- The sole full-suite failure is inherited and outside P29 ownership:
  `tests/unit/highlevel/sender-registry-v1-1.test.ts` expects 19 automation
  assets while the integrated P28 registry contains 22.
- One parallel-load timeout in the unrelated Tisha B'Av public-copy test passed
  immediately in isolation and also passed in the final full-suite rerun.

## Material digests

- Workflow fragment:
  `72f8fdbc09638d028da91960da0841eb9c14d7ae51d5861f8788b7111a479dec`
- P29-config-001:
  `10eb53f6f54fd3d8a7e32ea48452205c1b7c55a98f67f8e81ec434b83e50da0e`
- P29-registration-001:
  `cf2b8dc9a552dd296ab9f1236b7c84c56a895f6a9d4a14fac3fc7c53c15efd82`
- P29-registry-projection-001:
  `e42a3ef91712ae0852c4dfe516c260ba7112eeec2737668087af3d15816c5919`

## Exact next action

C00/I36 should verify the exact pushed final head, review this bounded
correction, route the three steward requests to their owners, and integrate only
after their normal authority checks. No migration or external effect was
performed.
