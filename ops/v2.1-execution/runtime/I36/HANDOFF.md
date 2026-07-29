# I36 P08 v2 Interface Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact target head: `87e3ba67c6433d249a29be9eac99f780ffc99683`
- Containing controller authorization:
  `047186d86034a4f6eb5e9d72837971c2edfe3005`
- Sole controller parent / acquisition:
  `9184bcfdb7e983a4f03733624d2d5f98455c7ea3`
- Claim: `2b9e5c96-4e10-45a9-9f59-aa2d7110cdd3`
- RELEASE_INTEGRATOR lease:
  `1975bc3e-446f-473a-9872-92dd927fdc48`
- Lease issued: `2026-07-29T02:32:11Z`
- Lease expires: `2026-07-29T03:32:11Z`
- Ready digest:
  `db8a42f5a7261e815384ac014c694b73400e7e309b6f0865519def5a5d483b78`
- P08 merge id: `6fc2b7ae-b59a-4344-9399-669a5d79212b`
- P08 merge digest:
  `20642826a27d6e76d282420ad154ef53c398a33f6fb040a938dc2cc3e8298494`
- Queued P08 source head:
  `e15a7af6cde557ff7f0fbbd55c12244780ca2321`
- External effects: attempted 0; succeeded 0; reconciled 0

## This checkpoint

This checkpoint consumes only the atomic I36 claim. Exactly
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md` change.

I36 did not read the P08 source for admission, merge or cherry-pick a P08
commit, apply a steward request, edit product or shared registration paths,
move a candidate, or perform a provider or external effect.

## Exact next action

Push and report this atomic-claim head and its exact parent. Then stop until C00
reconciles the claim and issues an exact authorization for source admission.
