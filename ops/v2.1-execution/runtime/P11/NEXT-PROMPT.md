MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: REVIEW_AND_INTEGRATE

Review and integrate the residual-corrected One Time v2.1 P11 implementation.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p11-admin-operations
Authoritative control ref: origin/codex/v21-control
Task state: ops/v2.1-execution/runtime/P11/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P11/HANDOFF.md

Exact implementation:
`f27f16a77fde21d283d594a7987ccd600bc1b367`.
Residual atomic claim:
`ce87a6c2808216214870d4b2343c82c0a36aaf36`.
Reconciled control:
`fff9a0a79f2db87ffca97451f8295080b9736549`.
Claim `6efc5db3-43b4-4dad-ae3f-59031adddbd5` and ADMIN_OPERATIONS_UI
lease `84e7a42a-d2a5-4c88-ba45-57b34ecc6de9` were released cleanly.

Verify the final remote metadata head and ancestry through exact implementation
`f27f16a77fde21d283d594a7987ccd600bc1b367`. Reproduce:

- artifact digest
  `497dcc8690ee8dec109f6c48d5216cb3ea074089881bbc48fc57fa54e816776f`;
- P11-registration-001 digest
  `68a99cc059304f66570f2296a5872bfa379062ae854401c54c196ec12b56fa42`;
- request aggregate
  `2327a180d429e131be3de3d65ada907ed964031496aa49b7eb2524bd797a7f8e`.

Independently prove:

- provider readiness is returned only when the stored row itself carries exact
  matching runtime-tier and verification-environment provenance;
- `provider_sandbox` cannot be relabeled as `persistent_staging`;
- sign-out, role revocation, credential-version change, stale resolution, and
  bfcache restore clear private query text together with results, cursors,
  selection/error state, and recent values; and
- multiple result groups produce one unique combobox-controlled listbox and a
  valid unique active descendant.

Preserve every earlier P11 current-Admin/target resolver, canonical same-origin
route, POST-body/no-store/CSRF, eight-kind, redaction, exact scope, 24-hour
activity, honest operations, keyboard, visible Jerusalem timezone, and
real-data-only invariant. Disposition but do not weaken P11-registration-001.

External authority is `none`; effects attempted `0`, succeeded `0`, reconciled
`0`. No migration, registration application, steward action, provider call, or
external effect is part of P11.
