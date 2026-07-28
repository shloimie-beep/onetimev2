# Candidate Evidence Aggregation Protocol

Source code and release evidence use separate branch identities so verification
records do not mutate the frozen source-candidate SHA.

## Branches

- Frozen source candidate: the exact `codex/v21-integration` checkpoint recorded
  at
  `merge/candidates/<canonical-candidate-digest>/CANDIDATE.yaml`.
- Evidence aggregation:
  `codex/v21-evidence-<candidate-short-sha>`, created from the frozen candidate.
- Verification lanes:
  `codex/v21-verify-<candidate-short-sha>-v37` through `-v43`, each targeting the
  evidence aggregation branch.
- Operator lane:
  `codex/v21-r44-operator-<candidate-short-sha>`, created from the evidence head
  after V37–V43 aggregation.
- Post-operator P34 supporting proof:
  `codex/v21-p34-evidence-<candidate-short-sha>`.
- Final release lane:
  `codex/v21-r45-release-<candidate-short-sha>`, created from the fully
  aggregated evidence head.

## Sole aggregation writer

I36 is the sole writer to the evidence aggregation branch. After the source
candidate freezes, I36 merges each exact queued evidence-only branch head with
normal ancestry-preserving Git merges (or a fast-forward when the target is its
ancestor). It never squashes, cherry-picks, or reconstructs a synthetic
path-only commit. Therefore every aggregated evidence head is a descendant of
every admitted lane/phase head, while product code, artifacts, migrations, and
the recorded source-candidate identity remain unchanged.

For each evidence head I36 verifies:

- only assigned result/state/handoff paths are admitted to the evidence branch;
- every result schema parses;
- every result binds the frozen source candidate and allowed environment;
- case IDs belong to the lane;
- no secret, bearer, child/private data, or unredacted provider payload exists;
- external-effect counts, authority, locks, and cleanup reconcile;
- a case has one current result and no unauthorized waiver.

For R44/R45, the queued allowed-path set may additionally include canonical
authority, append-only effect events, observation records, cleanup, and release
decision files. For P34 Phase B it may include only the canonical supporting
proof. These are schema-validated and candidate/deployment-bound; no deployable
source is admitted.

A verifier may maintain candidate-excluded harness code only under its exact
`verification-harness/<lane>/**` scope on the separately registered sibling
`codex/v21-harness-<candidate-short-sha>-<lane>` branch. Harness commits must
never enter the ancestry of the canonical
`codex/v21-verify-<candidate-short-sha>-<lane>` evidence branch. Results may
record the harness commit digest. C00's merge entry lists the expected target
head, exact source head, and exact allowed delta paths. I36 verifies
`source_delta_base_head_sha..source_head_sha` changes only
result/state/handoff paths, after verifying that the independently populated
source delta base is the exact `git merge-base` with the current expected
target. The source-base and target values may coincide; equality is not a
rejection, and C00 never defaults or infers the source base from the target. It
then merges the whole admissible head so its ancestry is preserved. It never
admits harness files or deployable/product changes.

P34 Phase B is the sole exception to “result paths”: it contributes one
schema-valid non-result supporting proof under
`proofs/<candidate>/P34/POST-OPERATOR-PROOF.yaml`. It cannot mark or supersede a
case. V43 owns all P34 acceptance results and in Phase B supersedes only its own
three earlier `pending_R44` attempts.

Result paths are collision-safe and immutable:

`results/<candidate>/<lane>/<case-id>/attempt-<n>.yaml`

Each case has a small `CURRENT.yaml` pointer. A later attempt never overwrites
history; it records `supersedes_result_digest`. I36 rebuilds
`results/<candidate>/CANDIDATE-RESULT-INDEX.yaml` after each aggregation,
mapping all 265 case IDs to exact lane branch/head, attempt path/digest, status,
candidate/deployment identity, and supersession state. C00 validates and records
the index digest in `control/CURRENT-CANDIDATE.yaml`.

If an evidence merge contains any product change, reject it and invalidate the
lane. Product changes require a new source candidate and rerun of affected
evidence.

## Sequence

1. I36 freezes the source candidate and creates the evidence branch.
2. V37–V43 run concurrently.
3. C00 queues completed verifier heads; I36 merges them into the evidence branch.
4. R44 starts from the seven-lane evidence head.
5. I36 aggregates R44 evidence.
6. P34 writes only its post-operator supporting proof from that evidence head;
   it writes no acceptance result.
7. I36 aggregates P34 supporting proof and records its exact head/digest.
8. C00 reauthorizes V43 Phase B; V43 verifies and supersedes its three pending
   post-operator case results.
9. I36 aggregates the final V43 head and rebuilds
   `CANDIDATE-RESULT-INDEX.yaml`.
10. R45 Phase A starts only when the index has 264 passed non-R45 cases and
    performs no broad cutover mutation. If case 265 passes, it pushes
    `certification_evidence_ready`. If the case fails or is precisely blocked,
    it instead pushes that result plus a schema-valid `release_blocked`
    decision at `release_decision_recorded`.
11. On the pass path, C00 queues the exact R45 Phase A result head; I36 merges
    it with ancestry preserved and rebuilds the canonical evidence-branch index
    to 265/265.
12. C00 independently validates that index. With valid externally granted
    mutation authority it issues `phase_b_cutover`; with a missing, denied, or
    expired authority/final gate it may instead issue a read-only
    `phase_b_blocked_decision` resume containing no effect locks. R45
    fast-forwards to the descendant evidence head. Only `phase_b_cutover` may
    perform cutover and the 60-minute observation.
13. On either blocked path or after authorized Phase B, C00 queues the exact
    R45 result/decision head; I36 merges it with ancestry preserved. C00
    independently verifies the remote decision and evidence. It marks global
    `done` only for `released`; `release_blocked` never requires 265 passed but
    must bind the exact current index/counts, blocker, and reconciled effects.

The evidence-branch commit is not a new product candidate. Every result remains
bound to the recorded frozen source SHA and artifact digests.
