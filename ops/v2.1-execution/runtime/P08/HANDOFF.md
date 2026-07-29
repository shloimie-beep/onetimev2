# P08 Exact Family Signup Correction — Ready for Review

## Exact identity

- Branch: `codex/v21-p08-family-signup`
- Replacement claim: `60986795-c22a-4861-9e98-a93de2c1d22e`
- Atomic claim head: `c58b4a65dfbdab52f7be7dddf41875194c4b632c`
- C00 reconciliation: `04ebe46bc1cff1223bdade3379457cf774c0dce1`
- Reconciliation sole parent: `765ad933964ce0019895c2133ff10a491b7938a2`
- Correction implementation: `8ab2c55c56e93fa343e6e50dd70a36ef193bd73e`
- Verification/steward request head:
  `67fb8b74c5109e06fa2829797fed1ffa0ce995d4`
- FAMILY_SIGNUP lease: `4dce3bb7-4411-4643-a367-d7e43adaabb8`
- Lease released: `2026-07-29T02:26:07Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## Corrected behavior

The Family form and command now contain the exact UI-010.2 surface:

- adult first and last name;
- normalized email;
- password and exact password confirmation;
- editable/searchable IANA household timezone with browser detection used only
  as a suggestion;
- required Terms and privacy acceptance;
- separate optional general-marketing and Parent-newsletter booleans, both
  unchecked by default and never inferred.

The server independently rejects non-IANA identifiers, raw offsets,
confirmation mismatch, missing or non-boolean consent choices, and any extra
payload field before repository access. Password confirmation is not persisted.
The canonical request and durable outbox retain the two exact consent choices.

P09-owned School command and form details were removed. P08 preserves only the
exact mutually exclusive `family | school` classification seam.

An ambiguous GHL match still permits local authentication and pre-expiry free
access. At or after expiry it now produces `inactive_identity_review`,
`checkout_required: false`, and `next_action: identity_review`; GHL
sync/workflow dispatch and GHL-hosted paid Checkout remain quarantined until
Admin resolution.

## Superseding interface

- Contract version: `2.0.0`
- Contract implementation:
  `8ab2c55c56e93fa343e6e50dd70a36ef193bd73e`
- Metadata checkpoint:
  `594570798a5af8145d7949ba10572e8b1e644f17`
- Contract digest:
  `32a4a8bedd1ef290ca8484033076923e8184eb6d52e13b6ec8cc871eeef0fa43`
- Export artifact SHA-256:
  `502bb09dcf4e95ffba49951ca92ff6ae591be2ded7034493269349b73e8965ef`
- Supersedes checkpoint:
  `ca06599ffbe62d7c617235f9e54f5ded57e4b6c7`
- Supersedes contract digest:
  `922f9624679581868b598f4b89c94a5d2e53d650a2cd32e87a0ce88945002b0c`

P09 must consume only this superseding interface after C00 integration.

## Verification

- Focused P08 Vitest: 4 files, 17 assertions passed.
- Targeted ESLint: passed.
- Repository TypeScript typecheck: passed.
- Focused Prettier and `git diff --check`: passed.
- Secret scan: passed across 2720 repository text files.
- Full unit suite: 566 passed, 1 inherited out-of-scope failure.

The sole full-suite failure is
`tests/unit/highlevel/sender-registry-v1-1.test.ts`, which expects 19 automation
assets while the integrated registry contains 22. P08 owns neither file.

## Steward requests

- Migration request SHA-256:
  `d77c51fb84a06a3e8a3e8a0b9d28f64f1aea5223711afa23fef656e4c2617749`
- Registration request SHA-256:
  `5958df286bf5a8213b4431709084b7fabe05ae8d6fdb1c2aa08d97db4f35409c`

No migration, route, barrel, composer, shared registry, manifest, lockfile, or
provider state was edited.

## C00 action

Review the exact pushed ready-for-review head, reconcile the lease release, and
admit the corrected P08 implementation and semantic-version-2.0.0 interface if
accepted.
