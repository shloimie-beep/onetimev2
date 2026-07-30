MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

P21 source correction is complete on
`codex/v21-p20-publication-seed-enrichment` at exact source head
`38156528c1c022a0575db71426ce2cc8f2e20ab8`.

Resume from `TASK-STATE.yaml` and `HANDOFF.md`. Verify the containing metadata
checkpoint is the normal pushed child of source head `38156528...`, the remote
branch equals that checkpoint, and its delta is exactly:

- `ops/v2.1-execution/runtime/P21/HANDOFF.md`
- `ops/v2.1-execution/runtime/P21/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P21/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P21/steward-requests/P21-MIGRATION-003.yaml`

The source-complete projection has exactly 27 top-level fields and eight fields
per artifact. The current 17-artifact aggregate is
`94689409b4eb4dacaddf24335c95669384ed9002df16989fbdb186703a36ab35`;
the exact eight-artifact companion aggregate is
`55070ee51ae052e07d655faf404ea25a3a5116b38d18a14573e7bf57dfdeddb2`.

Integrated migration 2252 is immutable at raw SHA-256
`7981b9cf9805ec9bfba7005e7688034bacb90f5e730d0e593c43202c68afeafc`.
Never edit or amend it. Never repurpose `P21-MIGRATION-002`, whose immutable
raw Git-blob SHA-256 is
`aab270cb40f12885ea89acbdc4308e0d1ffa9cf89ae48d7e0cca6c5445985a45`.

The current successor request is `P21-MIGRATION-003` at canonical sorted-JSON
payload SHA-256
`4c102308b097a26a1a25b3f37a894ab1222acbbc09421502d77fc0a5d880e4a9`
and exact raw Git-blob SHA-256
`4ab2d70eff1a64fe70d3f7d2b076c9852dd27374367f9e8b683ed68c4cbd3a33`.
It requests F02 allocation of exact forward-only
`packages/db/migrations/2253_v21_content_publication_projection_v2.sql`,
limited to `CREATE OR REPLACE` function successors, all five validator call
sites, and native PostgreSQL exact accept/reject probes. The four-request
aggregate is
`b0bcabe474905f4a0529fb9a7b8d091de3007949cba2cf68b622430053541f01`.

Next action: F02 consumes the immutable request, authors and probes 2253, and
publishes an immutable steward result. I36 independently validates and
integrates that result. Until then, P21 is source-complete but migration
successor pending; do not mark acceptance passed, candidate ready, operator
accepted, or released.

No migration application, provider action, backfill, deployment, send, control
edit, or external effect is authorized by this checkpoint.
