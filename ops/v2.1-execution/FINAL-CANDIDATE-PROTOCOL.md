# Final Candidate and Release Protocol

## Candidate identity

Every verification result must bind the same immutable candidate:

- source commit SHA;
- deployable web and worker artifact/image digests;
- migration-set digest;
- frontend asset digest;
- route/action inventory digest;
- workflow/provider-registry digests.

Each result separately binds its exact environment, runtime tier, configuration
profile, deployment instance/time, and applicable provider assets. The recorded
environment must be allowed for that exact case by
`ACCEPTANCE-ENVIRONMENT-MATRIX.yaml`. Different cases intentionally run in
different allowed environments; their allowed-environment intersection need
not exist. Evidence is never silently transferred between environments.

## Verification lanes

I36 creates `codex/v21-evidence-<candidate-short-sha>` from the immutable
source candidate. V37–V43 run concurrently from that same source identity and
target the evidence branch. Provider access is none by default; scoped
read-only access requires C00 authorization. They write only their candidate
result paths. A live/provider effect requires the exact exclusive lock,
authority record, fixture, budget, and cleanup defined in the source manifest.

One failed or blocked release case blocks release. Evidence from a different candidate is stale.

## Operator gate

R44 begins only when the seven verifier lanes have passed every case that does not explicitly require the operator journey. It uses real operator-controlled identities and devices, never fictional fixtures or unrelated production customers.

I36 aggregates the seven verification heads into the evidence branch. R44
starts from that evidence head. I36 then aggregates R44. P34 Phase B writes only
its non-result post-operator canary/legal/recovery supporting proof from the
updated evidence head. I36 aggregates that proof; C00 then reauthorizes V43
Phase B, and V43 alone supersedes its three `pending_R44` attempts with current
acceptance results. Follow `EVIDENCE-PROTOCOL.md`.

## Final certification

R45 uses two distinct phases so it never relies on an index containing its own
unmerged result:

1. **Phase A:** start only when 264 non-R45 cases are passed and
   `OTV2-OPS-175-AC01` is the sole remaining case; perform the complete
   read-only interactive certification and execute that case without broad
   cutover. On pass, push `certification_evidence_ready`. On an exact remaining
   failed/blocked result, push a schema-valid `release_blocked` decision and
   `release_decision_recorded`; that branch does not require 265 passed.
2. On the passing path, C00 queues the exact R45 Phase A result head; I36 alone
   ancestry-merges it and rebuilds the canonical result index to exactly
   265/265 passed.
3. C00 independently validates the 265/265 index and issues a new
   `resume_ready` lease that names the descendant evidence head and either
   `phase_b_cutover` with exact externally approved authority/fencing, or
   read-only `phase_b_blocked_decision` with no effect lock.
4. **Phase B:** fast-forward the registered R45 branch to that exact evidence
   head with `--ff-only`. In blocked-decision mode, write the exact blocked
   decision and perform no mutation. In cutover mode, confirm failed,
   unverified, blocked, stale, waived, unexpected-effect, exposed-bearer,
   Student-GHL-contact, fake-data, and visible-control invariant counts are all
   zero.
5. Confirm every result binds the same candidate core and an environment
   permitted for that case; confirm legal artifacts, backup/restore, rollback,
   provider identity, and explicit broad-cutover/DNS/provider authority.
6. Before each authorized mutation, push a candidate-bound write-ahead effect
   reservation; after the operation, append provider/runtime readback and
   reconciliation. Never retry an unknown outcome without readback.
7. Deploy/cut over only if every gate passes; bind the exact production
   deployment instance and maintain the required continuous 60-minute
   observation, restarting it after any identity change or monitoring gap.
8. Execute rollback when a stop condition fires.
9. Push the final effect/observation/decision head. I36 aggregates it; C00
   independently verifies it. C00 marks global `done` only for a verified
   `released` decision. A blocked decision leaves global state
   `release_blocked`.
