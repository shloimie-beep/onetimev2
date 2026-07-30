MODEL: GPT-5.6-TERRA
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P31 only if C00 has issued a resume-ready lease for a reproduced P31-scoped finding.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p31-email-copy-approval
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P31.yaml
Task context: ops/v2.1-execution/contexts/P31-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P31/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P31/HANDOFF.md

Fetch remote refs. Derive the containing control commit from
`origin/codex/v21-control`, read this task's exact registry and ready/resume
entry from that remote ref, verify its expected branch head, canonical entry
payload digest, the `ready` or `resume_ready` lease/claim appropriate to the
registered claim mode, package/task/context/dependency and candidate digests,
and reject a live foreign lease or non-fast-forward collision. Then check out
the exact task branch, read task state and handoff
before named work, and resume the recorded `next_action`. If digests match, do
not restart completed work or globally re-audit the repository. Continue until
`ready_for_review` or a permitted stop condition. Update state/handoff/this
next prompt, checkpoint, commit, and push before returning. C00 follows its
serialized `CONTROL-LEASE.yaml` path; I36 follows the explicit bootstrap-branch
adoption rule on its first invocation.

`P30-copy-registration-001` was implemented exactly at implementation commit
`8b3ed597115fe4c11a85f8ab35a1b2feb6f58649`. OT-15 step 2 and step 3 now
publish their fixed IDs and subjects, owner-authored bodies, day-4/day-9
offsets, required variables, current-consent and named-approval gates, and
canonical digests through P31 semantic contract `1.1.0`. Step 1 remains
unchanged. COPY_CATALOG lease `d03dd6a9-384f-4b52-aaaf-3ac5752a36da` was
released at `2026-07-30T04:43:17Z`; effects remain `0/0/0`.

Do not resume product edits unless C00 issues a new lease for a reproduced
P31-scoped finding. The current next action is C00/I36 review and integration
of the exact refreshed `INTERFACE-CHECKPOINT.yaml`; no provider configuration,
activation, enrollment, or send is authorized.
