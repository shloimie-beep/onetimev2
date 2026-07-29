# P08 Atomic Follow-up Correction Claim

## Identity

- Branch: `codex/v21-p08-family-signup`
- Exact correction parent and expected existing head:
  `605c659afe488e32114bae57b3751c044301bdca`
- Follow-up claim: `a456f914-02cb-4c08-9717-af9709f1948a`
- Writer: `codex-p08-worker-a456f914`
- Containing control authorization:
  `e695750e02c62ee9e95ca342265c1981f574e9b7`
- Containing control parent:
  `95883ac4ffe1369ea3a635749952e7504c9f4c42`
- Ready-entry controller:
  `95883ac406ec38b6c9399c0447022aa906532b5d`
- Canonical ready digest:
  `a013156d18578f4db3e5ff4a61e6b35aeb27ecbfa13eb857b3158daad58d6e5d`
- FAMILY_SIGNUP lease:
  `7b42f2bb-18ac-4f98-b86c-48b021afb66d`
- Lease issued: `2026-07-29T01:57:52Z`
- Lease expires: `2026-07-29T02:57:52Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## This checkpoint

This commit consumes only the P08 follow-up correction claim. It changes
exactly `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.

No product, contract, test, interface checkpoint, steward request, migration,
route, registration, provider, or external-effect change is included.

## Authorized later scope

After C00 reconciliation only:

- require server-side IANA timezone validation and editable/searchable IANA
  timezone form metadata;
- require exact Family password confirmation;
- model separate optional general-marketing and Parent-newsletter booleans,
  never infer consent, and bind them into canonical request and persistence;
- remove P09-owned School command and form details while preserving the
  `family | school` branch seam;
- block post-expiry Checkout and GHL workflow when identity state is
  `identity_review`, pending Admin resolution;
- add negative tests and republish the superseding contract, interface digest,
  and steward requests.

## Exact next action

Push and report this three-file atomic claim checkpoint. Then stop until C00
reconciles claim `a456f914-02cb-4c08-9717-af9709f1948a`.
