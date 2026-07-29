# P08 Superseding Atomic Follow-up Correction Claim

## Identity

- Branch: `codex/v21-p08-family-signup`
- Exact correction parent and expected existing head:
  `615e124dd49030e3af5e01d94518aea76b6a733e`
- Rejected metadata-only claim:
  `615e124dd49030e3af5e01d94518aea76b6a733e`
- Rejected follow-up claim: `a456f914-02cb-4c08-9717-af9709f1948a`
- Replacement follow-up claim:
  `60986795-c22a-4861-9e98-a93de2c1d22e`
- Writer: `codex-p08-worker-60986795`
- Containing control authorization:
  `0233631c59c7d9c6845e35e6c4d35e6bd7b3a101`
- Exact ready-entry acquisition:
  `ab5e5cc865be45ef0a71bcec7d71d7df1c787744`
- Canonical ready digest:
  `2bd935e8708acd22a72d256d08d300340c0ac96753457cb697d1e2ff25ca0430`
- FAMILY_SIGNUP lease:
  `4dce3bb7-4411-4643-a367-d7e43adaabb8`
- Lease issued: `2026-07-29T02:07:09Z`
- Lease expires: `2026-07-29T03:07:09Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## This checkpoint

This commit supersedes the rejected metadata-only claim and consumes only the
replacement P08 follow-up correction claim. It changes exactly
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.

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
reconciles claim `60986795-c22a-4861-9e98-a93de2c1d22e`.
