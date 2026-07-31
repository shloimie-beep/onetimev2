MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P21 from the terminal `ready_for_review` checkpoint on
`codex/v21-p21-publication-scope-correction`.

First verify:

- live branch equals the containing commit;
- the branch descends from adopted integration
  `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`;
- controller authorization is
  `c22354f184f046a1cb817e0c9cd415aec7c37449`;
- claim `06848315-08fd-40aa-8ff1-3c5cda4c42e4` and lease
  `030212ad-7da5-4877-b29b-85de75a4380c` are released;
- the terminal delta is exactly the nine paths recorded in
  `TASK-STATE.yaml`;
- external effects remain `0/0/0`.

Independently verify the canonical content-state writer:

- exact source/projection join and derived product/runtime/environment;
- raw `content_id` aggregate key;
- fresh ordered bootstrap to `needs_review` version 4;
- exact replay with zero event or aggregate writes;
- canonical expected versions read under `FOR UPDATE`, never inferred from
  publication versions;
- same-transaction events for approve, request-publish, reconciled publish,
  unpublish, and archive;
- Admin versus reconciler actor ownership;
- no event for attach-occurrence or revocation cleanup;
- Vimeo binding and locked pending-job scope fences;
- operation-namespaced idempotency and full canonical request hashes;
- no direct `canonical_aggregate_states` DML.

Rerun the five focused files, typecheck, focused ESLint/Prettier, steward-request
schema validation, scope/diff/secret gates, and immutable predecessor checks.
Validate that `P21-registration-003` supersedes `P21-registration-002` and
binds central registration to integrated migration 2253 plus this writer.

Exact next action: C00/I36 integrates the verified terminal P21 head and
dispositions `P21-registration-003`, or returns one bounded rejection. Do not
claim candidate readiness, operator acceptance, or production release from
this source checkpoint.
