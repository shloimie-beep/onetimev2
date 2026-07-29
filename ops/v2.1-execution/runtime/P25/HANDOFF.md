# P25 Atomic Claim Handoff

## Identity

- Branch: `codex/v21-p25-billing-commercial`
- Authorized start:
  `d075dc1839660205845e7da039a182bbe44778d2`
- Containing controller:
  `2b29ce6ce75de10765f6f6c64d059e858c548281`
- Ready-entry parent/acquisition:
  `9e04eda2275f3b6a92066670d878a3e1c62361ca`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the exact
  observed remote head.
- Claim: `a4dcccb9-2058-44df-a72d-4b3e6f51bdd9`
- Writer: `codex-p25-worker-a4dcccb9`
- BILLING_COMMERCIAL lease:
  `bf5b157c-d452-44a8-991f-bea035e1fd82`
- Lease issued: `2026-07-29T05:02:55Z`
- Lease expiry: `2026-07-29T06:02:55Z`
- Ready-entry digest:
  `30aec96a3b09178b89f322ba285b6216c2851039f9eab971edad7e248ce4fb87`

## Exact dependency bindings

- F04: task `54a0ac28b51d271aacab60003451dbcc66ffcac8`,
  integration `9782a4164662b8059a557c0969de9c35f54d0cf7`, interface source
  `4cc95c29c6012174595ba1821e0554aca8572e08`, implementation
  `81c0ee64072386db41aa5a40243c693762ab493a`, checkpoint digest
  `a57837379bfc8210188887ff31937ed7882befe10b80941499dc7ba305e7984d`.
- F05: task `9174d845e1c04916e2f1884cfadfaef624ac6862`,
  integration `9782a4164662b8059a557c0969de9c35f54d0cf7`, interface source
  `0656380bcfc50cc464dcea7588448dc724049599`, implementation
  `1ade14c52e42e59bb8fd1d1de776b91406c45f15`, checkpoint digest
  `fd17c478bfc851dcb434b8e0c2750701605b80dfdf880833a6a2993e8fad6329`.
- F06: task `ce061ca5b208cfb2a41e0c2f439a7a4b91e8ca57`,
  integration `d35166838267711a514cf73822cd2ca49a3f3ded`, interface source
  `9a426ccaa294ca1f54ece20ea2a37c7ef9de1ef7`, implementation
  `94281de13063203808ecabef8a818762e5ff1e2e`, checkpoint digest
  `7d0e2e360036fa6e3b742053c714b13f442e29c9ff3e83ad7b6bf02c005694a0`.
- F07: task `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`,
  integration `91349fc1fa9a474ae31cf408ae0364aa10520385`, interface source
  `47a2bb6b76225951e0599683499a95f4dc9881be`, implementation
  `a90baae8cf69d6823af6d741161fe0e9e7441321`, checkpoint digest
  `366a1b30f724afc35e525f3f3175a4c84a45b7c13681cea1a17060bee75e4188`.

## Scope and stop

This atomic first phase creates only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md` under P25 runtime memory. No product, source, provider,
steward, migration, shared, or external-effect work was performed.

C00 must reconcile the exact pushed claim head before P25 resumes. Stop after
push and remote verification.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
