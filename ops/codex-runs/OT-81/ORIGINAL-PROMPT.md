# CODEX EXECUTION — OT81 Day-One Certification Closure and Isolated Staging

You are executing, not merely auditing. Work in `webcraft-media/onetimev2`. The current chat window may have opened in the dirty BNA repository; that is not the target and is not a blocker. Locate an existing clean One Time checkout or clone the repository, fetch `origin`, and create a new external worktree.

## Canonical source

The source branch is `origin/codex/ot80-one-shot-final-convergence`, draft PR #23. When this prompt was authored its PR metadata head was `741af0c08ee1d43be4e220b7c6e4c77a2330adc2` and its recorded product/source anchor was `b753d50ca562c01cfa8619762254e70c90b0105f`. Fetch the branch now. Resolve and record its actual remote head. If the head moved, use the current remote head only after confirming it still contains the recorded source anchor and PR #23 remains the OT80 convergence branch.

Create worktree `C:\Users\User\OneTimeOneTime-ot81-dayone-certification-staging` and branch `codex/ot81-dayone-certification-staging` from the resolved remote head.

Do not require a copied accepted-SHA placeholder. Do not run BNA control-tower commands. Do not modify the existing dirty BNA worktree.

## Persist first

Before product edits, create and commit-ready-stage these files:

```text
ops/codex-runs/OT-81/ORIGINAL-PROMPT.md
ops/codex-runs/OT-81/INPUTS.json
ops/codex-runs/OT-81/STATE.json
ops/codex-runs/OT-81/RESUME.md
ops/codex-runs/OT-81/FINAL-REPORT.md
```

Copy this complete prompt into `ORIGINAL-PROMPT.md`. Record the resolved base branch, base SHA, PR #23, starting certification report path, and external-action permissions. Update state/resume after each phase. A fresh Codex window must be able to continue solely from repository files.

## Goal

Turn the green OT80 candidate into an honestly Day-One-certified, isolated-staging candidate that Shloimie can open and log into. Do not add broad new provider features. Close the existing ten blockers using real code/evidence or an explicit product-scope decision that the certification contract permits. Never relabel a partial capability as complete without proof.

Inspect:

```text
ops/evidence/ot-76/ot80-final-candidate/day-one-certify-report.json
ops/day-one/day-one-capability-registry.json
ops/day-one/release-manifest.example.json
ops/execution/ot-80/RELEASE-MANIFEST.json
ops/execution/ot-80/BLOCKERS.json
ops/execution/ot-80/RESUME.md
ops/release/ot75/**
```

Close or precisely disposition all ten current blockers:

1. School signup displays the exact approved public acknowledgement and remains lead-only. Prove that it creates no class access, reminder, portal account, or public provider send.
2. CRM and read-only communications are capability-registered and proven with real mounted-route evidence.
3. Class access/reminder behavior is protected, provider-default-off, and honestly testable without exposing a raw Zoom URL.
4. Content review/publish and entitled library behavior have mounted-route and authorization evidence.
5. Parent household and student portal prove separate learner identities and exactly-one-learner student sessions.
6. Every provider-dependent action is either functional in allowed sink/test mode or visibly unavailable; no dead button.
7. Add a machine-readable visible-action registry mapping every visible control to handler, authorization capability, audit event, test, and readiness state.
8. Produce responsive/accessibility evidence at 360x800, 390x844, tablet, and desktop, including RTL, reduced motion, keyboard, 200% zoom/reflow, loading, empty, error, and drawer/modal states.
9. Produce fresh integrated 30-sample performance measurements for landing, signup, login, CRM list, CRM detail, parent portal, student portal, and warm return. Preserve route-only loading and zero BNA/Operations fanout. Record p50/p75/p95, request counts, bundle sizes, LCP/CLS where browser support permits, and failures. Do not fake unavailable browser proof.
10. Produce exact source, migration ledger/checksums, worker isolation, provider-default-off, backup/restore-plan, rollback, and release evidence required by the certification harness.

Run strict certification repeatedly until it passes or until only genuine external staging-account facts remain. Fix harness defects if they reject truthful proof, but do not weaken security, privacy, accessibility, or performance requirements.

## Isolated staging authorization

After strict local/CI certification passes, isolated staging is authorized. This does not authorize production.

Use only the separate One Time Railway project/services and staging database. Never add One Time services to the BNA project. Never change the root production domain or production DNS. Never read or mutate production/legacy contacts. Never run a live Stripe charge or broad real email/WhatsApp/Telegram send.

Predeploy must prove:

- exact deployed source SHA;
- separate staging web, worker, and PostgreSQL resources;
- migration checksum ledger;
- backup/PITR configuration and a documented safe restore drill or precise blocker;
- worker/provider isolation and global send-disable switch;
- all providers default-off except explicit sink/test adapters;
- rollback to prior image/SHA;
- secrets present by name only, never printed.

If Railway credentials or a staging resource is missing, do not stop the implementation. Finish and push the certified branch, create a draft PR, set state to `READY_FOR_STAGING_AUTH`, and write an exact one-command/operator checklist. Do not invent deployment evidence.

If access exists, deploy the exact OT81 SHA to isolated staging, apply migrations, and bootstrap protected activation for:

- Rabbi Scheller as `one_time_owner`;
- Shloimie as `one_time_admin`.

Do not commit passwords, recovery email addresses, phone numbers, tokens, or activation URLs. Use protected one-time activation and secret storage. There is no impersonation and no “View as Rabbi.”

Run synthetic staging journeys:

- public landing and family signup;
- school lead-only signup;
- owner/admin login;
- CRM list/detail/create/edit/note/archive/read-only communications;
- parent activation, up to three learner profiles, learner reset/suspend;
- separate student login with no sibling discovery;
- protected class route in provider-off/sink mode;
- content/library entitlement;
- logout/session invalidation;
- no dead visible actions;
- mobile/a11y/performance smoke.

No real provider send is required for OT81.

## Verification and publication

Run the full repository verification, PostgreSQL 16 assurance, strict Day-One certification, secret scan, migration readback, clean-format/touched-file checks, visual/a11y/performance suites, and staging smoke where available.

Commit in coherent phases, push `codex/ot81-dayone-certification-staging`, and open one draft PR stacked on `codex/ot80-one-shot-final-convergence`. Keep the worktree clean.

Final report must state:

- resolved base branch/SHA and final head SHA;
- each of the original ten blockers: fixed, excluded by approved Day-One scope, or still blocked with evidence;
- certification result and exact reports;
- staging URL only if actually deployed;
- login activation status without secrets;
- migrations/checksums;
- tests and measurements;
- external mutations actually performed;
- provider modes;
- rollback status;
- exact next prompt and repository-backed resume path.

