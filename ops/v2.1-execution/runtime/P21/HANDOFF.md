# P21 Source-Complete Projection — Migration Successor Handoff

## Exact identity

- Branch: `codex/v21-p20-publication-seed-enrichment`
- Source-complete implementation head:
  `38156528c1c022a0575db71426ce2cc8f2e20ab8`
- Remote source equality: verified before this metadata checkpoint
- Current 17-artifact aggregate:
  `94689409b4eb4dacaddf24335c95669384ed9002df16989fbdb186703a36ab35`
- Exact eight-artifact P21 companion aggregate:
  `55070ee51ae052e07d655faf404ea25a3a5116b38d18a14573e7bf57dfdeddb2`
- Metadata checkpoint scope: this handoff, `NEXT-PROMPT.md`,
  `TASK-STATE.yaml`, and new immutable request `P21-MIGRATION-003.yaml`

## Source correction complete

P20 now emits and P21 now consumes the exact source-complete publication
projection. The contract has 27 top-level fields, seven canonically ordered
artifacts, and exactly eight fields per artifact. P21 validates the exact
projection/digest, constructs and idempotently registers the review-ready
publication record, refetches P20 evidence server-side for approval, and keeps
the publication seed bound to exact source evidence.

Focused verification at the source head passed five files and 23 tests,
focused ESLint, and focused Prettier. The full TypeScript run has no P21 error;
its remaining failures are the existing missing local Playwright declarations
in historical browser harnesses.

This is source completion only. It is not acceptance passed, candidate ready,
operator accepted, or production released.

## Immutable migration boundary

Integrated
`packages/db/migrations/2252_v21_content_publication.sql` remains byte-identical
at raw SHA-256
`7981b9cf9805ec9bfba7005e7688034bacb90f5e730d0e593c43202c68afeafc`.
It still implements the superseded 13-field projection and 4-field artifact
validator. It must never be edited or amended.

`P21-MIGRATION-002` remains immutable historical request evidence at raw
Git-blob SHA-256
`aab270cb40f12885ea89acbdc4308e0d1ffa9cf89ae48d7e0cca6c5445985a45`.
It was not repurposed.

The new forward-only successor request is:

- Request: `P21-MIGRATION-003`
- Canonical sorted-JSON payload SHA-256:
  `4c102308b097a26a1a25b3f37a894ab1222acbbc09421502d77fc0a5d880e4a9`
- Raw Git-blob SHA-256:
  `4ab2d70eff1a64fe70d3f7d2b076c9852dd27374367f9e8b683ed68c4cbd3a33`
- Four-request aggregate:
  `b0bcabe474905f4a0529fb9a7b8d091de3007949cba2cf68b622430053541f01`
- Requested steward: `F02`
- Exact requested allocation:
  `packages/db/migrations/2253_v21_content_publication_projection_v2.sql`

The request binds F02 to source head `38156528...`, immutable migration-2252
checksum `7981b9cf...`, the exact 27/8 contract, both publication-binding
validator calls plus outbox, assignment, and library call sites, and native
PostgreSQL acceptance/rejection probes. The successor may supersede 2252 only
through forward-only `CREATE OR REPLACE` functions.

## Effects and readiness

No migration was authored or applied. No backfill, provider inspection or
mutation, deployment, send, publication, control-ledger edit, central
registration, or external effect occurred. Effects remain `0/0/0`.

P21 status is `implementation_complete_steward_successor_pending`. Candidate
preparation and final acceptance remain blocked on the authored, probed, and
integrated 2253 successor plus later candidate-bound evidence.

## Exact next action

F02 consumes immutable request `P21-MIGRATION-003`, allocates and authors exact
forward-only `2253_v21_content_publication_projection_v2.sql`, runs the
requested native PostgreSQL probes, and publishes an immutable steward result.
I36 then independently validates and integrates that result before any claim
of P21 candidate readiness.
