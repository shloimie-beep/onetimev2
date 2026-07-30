MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: REVIEW

Audit the exact superseding P32 privacy-scope persistence compatibility
correction.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p32-privacy-data-rights
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P32.yaml
Task context: ops/v2.1-execution/contexts/P32-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P32/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P32/HANDOFF.md

Claim checkpoint bindings:

- resume parent `f4ae1c03c60917a23a825d46a4d0ec63ff4fc125`
- containing control `9d53cf1c581dcb67e30b2beb62d048a1839f23e2`
- acquisition parent `a6bc58cc4a35173fd1606124c0fa651dda2dac64`
- claim `26390213-86c7-4085-8de0-1a5cc428b003`
- lease `0c5215bf-e4c5-49b3-9f99-9c7ed0cf1e8e`
- READY digest `32b38115f94e6989832318a478adf88480cbe14a3d1975a815b4c14f0873eda4`
- reconciled claim head `39a578ff9a8ba91c59ebe082dc6611a17c051b79`
- continuation control `5644d38395e86ea114197eb12415106994bbf3ea`
- continuation acquisition parent `fe0d60fa2807b02882390df960f3e75517672d11`

Fetch remote refs and audit the exact P32 head descended directly from
`39a578ff9a8ba91c59ebe082dc6611a17c051b79`. Require exactly ten P32-owned
privacy TypeScript files plus the P32 runtime triplet. Confirm trusted scope is
validated and cannot be replaced by caller-conflicting scope, request and grant
inserts persist all three scope fields, grants inherit request scope, scoped
updates remain fenced, and the composite database binding is preserved.

Rerun the focused 24-test suite, typecheck, focused formatting/lint, secret,
diff/scope, and native PostgreSQL positive/negative scope proof. Confirm the
lease release preceded expiry and effects remained `0/0/0`. Stop for C00
admission; do not merge, register, inspect providers, deploy, send, or perform
effects.
