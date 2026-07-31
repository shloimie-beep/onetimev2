MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: PAUSE_FOR_C00_RUNTIME_METADATA_CORRECTION_RECONCILIATION

Audit and reconcile the exact I36 runtime-metadata-correction-only checkpoint.
Do not resume product or test work from this prompt.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Exact checkpoint parent: `0389fe344f27bcd44c1640e7f6ebcb90d485b213`
Correction control: `b2ddcf4c4bc132a9de9399dbd8cd66b0b46c0aff`
State-basis/fresh-claim control: `f0a73d35937a1366289ab7f733da354e65e0532b`
READY: `010c6e951a95840de997ec93136b5ba1f28468b8fc35498ab008a81457cc5c1f`
Fresh claim: `5deb22c5-dc93-4946-98f1-dd7db19ee164`
Fresh writer: `codex-i36-parent-session-successor-5deb22c5`
Fresh shared lease: `87280cec-f71e-4dbd-91dd-38f54d0c7b93`
Lease issued: `2026-07-31T00:58:50Z`
Lease expiry: `2026-07-31T02:28:50Z`
Correction heartbeat: `2026-07-31T01:23:30Z`
Phase scope:
`parent_session_auth_client_successor_runtime_metadata_correction_only_then_stop`

The shared lease binds exactly SERVER_COMPOSER, CLIENT_COMPOSER,
IDENTITY_AUTH_ACCESS, and ACCOUNT_HOUSEHOLD_IDENTITY for this correction-only
phase. Prior claim
`ef14f276-f6a2-45a5-b35d-d45d37572ca5`, writer
`codex-i36-parent-session-successor-ef14f276`, and lease
`21315060-463e-49a8-a246-20057483ec20` are historical, released, and
superseded.

The checkpoint must have the exact parent above and change only:

- `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/I36/HANDOFF.md`
- `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`

Confirm product checkpoint `5285a71e86ebf80bab3332f6cc3490a380bc7890`,
all ten product/test blobs, and all product/test bytes remain unchanged.
Confirm canonical top-level `remaining_steps` preserves the six pending
security closeout items:

1. linearizable pre-Argon login reservations and exact release accounting;
2. invalid-versus-unavailable session propagation without outage cookie loss;
3. invalid-CSRF retryability and outcome-dependent logout cookie clearing;
4. recovery-required propagation for unverified password-upgrade cleanup;
5. redacted v2 logout audit insertion and exact readback proof; and
6. real Parent bundle reload/logout proof with zero legacy Parent API calls.

Also confirm terminal native PostgreSQL, real-browser, production-build,
workspace-typecheck, changed-file-lint, focused-format, secret-scan, and
exact-scope gates remain pending, and canonical top-level `next_action` is an
explicit stop for C00 reconciliation before any product or test work.

No implementation, substantive validation rerun, destructive cleanup,
PostgreSQL stop, provider action, customer mutation, migration, candidate
action, deployment, DNS change, send, charge, or other external effect
occurred. Effects are `0/0/0`.

C00 must independently verify the sole parent, correction control, exact
three-path inventory, canonical pair/triplet digests, unchanged fresh and
historical authority, correction phase scope, heartbeat, corrected canonical
fields, preserved product/test blobs, clean local/tracking/live remote
equality, and effects before directing I36 to resume. Do not resume from this
prompt.
