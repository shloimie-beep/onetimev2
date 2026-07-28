# Merge Captain Protocol

I36 is the sole writer to `codex/v21-integration`.

I36 starts after C00 and is resumed on demand throughout Waves 1–8. It merges
small foundation interface checkpoints early so every downstream task can start
from one exact integration SHA containing all required contracts.

## Admission

For every interface, full-implementation, or evidence item, C00 independently
populates three SHA fields: `source_head_sha`,
`source_delta_base_head_sha`, and the current `expected_target_head_sha`.
Field values may coincide when Git proves that relationship (for example, the
first lane's merge base may equal its target); the source delta base is never
defaulted or inferred from the target. I36 requires the source delta base to be an
ancestor of the source and to equal
`git merge-base expected_target_head_sha source_head_sha`. It scope-checks only
`source_delta_base_head_sha..source_head_sha`; the expected target is used only
as the optimistic-concurrency head. Never diff a parallel source lane directly
against a moving target.

A full task implementation is merge-ready only when:

- all hard dependencies are integrated;
- its exact remote task head exists;
- its diff stays inside owned paths or includes approved steward requests;
- task state and handoff are complete;
- targeted verification passes or names only baseline failures already recorded by C00;
- migrations came from F02;
- root registration, dependency, config, lockfile, and generated-registry changes are requests for I36 rather than competing edits;
- no retired surface, old authority, old role, demo/test product lane, direct Stripe mutation, Student GHL contact, or raw bearer was reintroduced;
- external effects match the task’s authority budget.

An `interface_ready` checkpoint may be admitted earlier when:

- C00 queued its exact checkpoint SHA and digest;
- it contains only the declared interface/registration contract and task state;
- task-owned contract checks pass;
- it does not claim implementation or acceptance completion;
- I36 merges that exact commit ancestry rather than copying it into an unrelated commit.

After each interface merge, I36 publishes the resulting integration SHA. C00
may authorize a downstream branch only from an integration SHA containing every
required start contract.

## Order

Merge dependency-ordered micro-batches of no more than three disjoint task heads:

1. authority and composition foundations;
2. schema, identity, API/jobs, provider, design contracts;
3. backend feature modules;
4. frontend feature modules;
5. root registration and steward requests;
6. cross-domain integration;
7. operations/deployment mechanisms;
8. final instrumentation.

After each risky merge and each micro-batch:

- update the candidate manifest;
- validate migration ordering/checksums;
- regenerate route/action/provider/workflow inventories;
- run contract/type/build checks and changed-area verification;
- push the integration checkpoint.

## Conflict policy

- Resolve only mechanical central-file conflicts whose intended registrations are explicit.
- Return semantic conflicts to the owning task.
- Never rewrite an applied migration or silently weaken an invariant to merge.
- Do not require workers to rebase onto a moving integration branch unless C00 issues a new exact start SHA.

## Candidate freeze

After all implementation tasks are integrated and checks pass:

1. record source SHA, web/worker/artifact digests, migration-set digest,
   frontend asset digest, supported environment-profile schema digest, provider
   registry version, route/action inventory digest, and workflow registry
   digest;
2. push the immutable checkpoint;
3. prohibit implementation changes on that candidate;
4. launch V37–V43 from the same candidate identity;
5. invalidate all candidate-bound evidence if the candidate changes.

## Evidence aggregation

After source-candidate freeze, I36 is also the sole writer to
`codex/v21-evidence-<candidate-short-sha>`. For each queued evidence head it
requires an independently populated exact `source_delta_base_head_sha`,
verifies it is the merge base of `expected_target_head_sha` and
`source_head_sha`, and scope-checks
only `source_delta_base_head_sha..source_head_sha`. The expected target is used
only for optimistic concurrency. The source-base and target values may coincide
when Git verifies that merge base; equality is not a rejection. I36 then
performs an ancestry-preserving merge
of that whole admissible source head. It never squashes, cherry-picks, or
rebuilds a synthetic path-only commit. Thus parallel sibling lanes do not
appear to delete previously aggregated evidence, and later phase branches can
fast-forward because their earlier heads remain ancestors.
It never merges evidence commits back into the frozen source candidate. Follow
`EVIDENCE-PROTOCOL.md`.
