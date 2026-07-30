# P17 Zoom Preparation — corrected review handoff

## Current review target

- Review only implementation commit `178af0c35012828016f395611e3d2f8cb3f88ff8`.
- Its parent is renewed atomic-claim commit `b9e7b49a2fa8c0ad1281dc262babd457d4f532ac`.
- Runtime metadata-correction claim `023cf8f0-4c6b-4224-943e-71c8e7f522d2` was atomically published at `8d409a2d70017a60dc70c54eac3942deaf40eb7d` and reconciled by C00 at canonical control `a38b917f514b65c49d2d75789b8ae50d96985cdc`.
- Product-terminal metadata commit `506d9024fc3280f0f302c04b7d265597117d9936` and metadata atomic-claim commit `8d409a2d70017a60dc70c54eac3942deaf40eb7d` both passed normal non-force push and remote-equality gates.
- The runtime-only metadata correction released ZOOM_PREPARATION lease `24a593bc-5edd-4fe1-8e65-87cbebdfd933` at `2026-07-30T07:50:19Z`.

## Superseded historical values

The following values are preserved only as historical evidence and must not be treated as current instructions or review targets:

- `3560b053a535b2889ea95e1d05ab58bb82b219cc`: superseded historical implementation.
- `6941a60b`: superseded historical runtime checkpoint/reference.
- `b7211f31-df73-40fa-8281-5765ca37d3b9`: superseded historical released lease.

## Corrected product scope

The implementation keeps P17 limited to Zoom preparation:

- preparation saga and command;
- roster snapshot and classroom resource;
- Student registrant identity;
- join availability, retry, quarantine, and provider lifecycle;
- transactionally atomic F05-style `job_outbox` insertion plus exact F06 `provider_operation_binding`;
- fail-closed rollback for mismatched existing jobs or bindings;
- schema contract `P17-ZOOM-PREPARATION-SCHEMA-002` with exactly five preparation tables.

P18 remains the sole owner of launch grants, Meeting SDK bootstrap, live sessions, devices, Admin reset, and attendance. P17 contains no ownership claim over those surfaces.

## Evidence

- Implementation changed-path digest: `c3afe953e44a0fd5b86aa9e7522d066c4c048eca4472372c5c7f50349160603a`.
- Canonical 13-product digest: `c35cf10d10031cf4227faf31c6442bcef9aa41c9a55e6ec24320a7f8c4b4d731`.
- Contract raw SHA-256: `4e99730e9ac01b0f84474009152f7e8b2dd4ba1f8d2022cc5f0e5a69728b5916`.
- Schema raw SHA-256: `60156982482173fc84a2e42c17e6a79106f970997e3212715c2999a309180eac`.
- Acceptance raw SHA-256: `0573200dc876dc6cbac4892bd3dce027c3d6413a6861dd2d1653efc9616487aa`.
- Existing `-001` request-container raw SHA-256 remains `92b34ce0a0030390ede24518e7d7b6304729a1eff3945542f08ce6b5bfe7f444`.
- Verification passed: 23 focused tests across four files, workspace typecheck, focused ESLint, focused Prettier, successor YAML parsing, repository secret scan across 2725 text files, exact scope, and diff hygiene.

## Request dispositions

- `P17-MIGRATION-001`: **superseded/withheld**; bytes preserved.
- `P17-SERVER-WORKER-REGISTRATION-001`: **superseded/withheld**; bytes preserved.
- `P17-ZOOM-CONFIG-DEPENDENCY-001`: **assigned**; bytes preserved.
- `P17-REMINDER-ROUTING-001`: **applied/acknowledged**; bytes preserved.
- `P17-MIGRATION-002`: **proposed immutable**; raw SHA-256 `fa9868d91b12a30808f80a5233219011126ea9cde5571380c25058a53b2818c8`, canonical SHA-256 `e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624ca`.
- `P17-SERVER-WORKER-REGISTRATION-002`: **proposed immutable**; raw SHA-256 `375142acb5e58ac91c11c83721930f43f5b5bc4e9bc90a027669a80dd933d53a`, canonical SHA-256 `e90e471bb23f71b85ad321e188e64144d323461805838baff33f46ed4cd4f1b8`.

F02 owns independent disposition of `P17-MIGRATION-002`; I36 owns independent disposition of `P17-SERVER-WORKER-REGISTRATION-002`.

## Effect ledger

- External authority: none.
- Attempted: `0`.
- Succeeded: `0`.
- Reconciled: `0`.

Provider inspection and every external effect remain prohibited.
