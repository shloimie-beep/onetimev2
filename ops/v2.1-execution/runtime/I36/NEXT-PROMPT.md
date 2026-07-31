MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: PAUSE_FOR_C00_ATOMIC_CLAIM_RECONCILIATION

Audit and reconcile the exact I36 fresh atomic claim checkpoint. Do not resume
product or test work from this prompt.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-integration
Exact checkpoint parent: `0d834c0c0b0e1fd9db8b5a54076631cf1f2fe857`
Containing control: `f0a73d35937a1366289ab7f733da354e65e0532b`
State-basis control: `50ebdcdb345bf13bd76d9af013c25855bc369836`
READY: `010c6e951a95840de997ec93136b5ba1f28468b8fc35498ab008a81457cc5c1f`
Fresh claim: `5deb22c5-dc93-4946-98f1-dd7db19ee164`
Fresh writer: `codex-i36-parent-session-successor-5deb22c5`
Fresh shared lease: `87280cec-f71e-4dbd-91dd-38f54d0c7b93`
Lease issued: `2026-07-31T00:58:50Z`
Lease expiry: `2026-07-31T02:28:50Z`
Checkpoint heartbeat: `2026-07-31T01:11:58Z`

The shared lease binds exactly SERVER_COMPOSER, CLIENT_COMPOSER,
IDENTITY_AUTH_ACCESS, and ACCOUNT_HOUSEHOLD_IDENTITY. Prior claim
`ef14f276-f6a2-45a5-b35d-d45d37572ca5`, writer
`codex-i36-parent-session-successor-ef14f276`, and lease
`21315060-463e-49a8-a246-20057483ec20` are historical, released, and
superseded.

The checkpoint must have the exact parent above and change only:

- `ops/v2.1-execution/runtime/I36/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/I36/HANDOFF.md`
- `ops/v2.1-execution/runtime/I36/NEXT-PROMPT.md`

Confirm product checkpoint `5285a71e86ebf80bab3332f6cc3490a380bc7890`
and all product/test bytes remain unchanged. Preserve the six pending security
closeout items:

1. linearizable pre-Argon login reservations and exact release accounting;
2. invalid-versus-unavailable session propagation without outage cookie loss;
3. invalid-CSRF retryability and outcome-dependent logout cookie clearing;
4. recovery-required propagation for unverified password-upgrade cleanup;
5. redacted v2 logout audit insertion and exact readback proof; and
6. real Parent bundle reload/logout proof with zero legacy Parent API calls.

No implementation, validation rerun, destructive cleanup, PostgreSQL stop,
provider action, customer mutation, candidate action, deployment, DNS change,
send, charge, or other external effect occurred. Effects are `0/0/0`.

C00 must independently verify the exact parent, three-path inventory, runtime
digests, fresh authority binding, heartbeat, clean local/tracking/live remote
equality, and effects before directing I36 to resume. Do not resume from this
prompt.
