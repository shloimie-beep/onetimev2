# OT-99 — Direct-to-Codex Final Semantic Convergence Prompt

You are the principal release-convergence lead for `OT-99`. Work in the One Time repository that contains this packet. Execute the task; do not merely propose commands. Preserve evidence for every material assertion. Never treat a prompt launch, branch name, report filename, pull request state, or green partial check as proof that implementation succeeded.

Packet identity: `OT-99-bcd34498`.

## OT-99 mission

Build one semantically integrated One Time release line from the latest completed `OT-83R` foundation, merge eligible descendant lanes in dependency order, reconcile shared contracts and migrations, validate the full system, open one clean draft pull request, and deploy only the exact `OT-99` SHA to genuinely isolated One Time staging when authorization exists.

Do not start integration edits until current remote branches and checkpoint or final reports for `OT-83R`, `OT-88`, and `OT-89A` can be inspected. `OT-83R` requires a completion report whose claims you verify against code and CI.

## OT-99 expected graph

```text
OT-81/82
└─ OT-83 + OT-83R portal completion
   ├─ OT-84 Telegram
   │  ├─ OT-88 Zoom classroom
   │  └─ OT-89A One Time support producer
   ├─ OT-85 WhatsApp
   ├─ OT-86A Vimeo/content/KB
   │  └─ OT-86B Buffer approval-only publishing
   └─ OT-87 Stripe TEST entitlements

BNA separate: OT-89B support consumer
```

## OT-99 non-negotiable prohibitions

Do not change root DNS. Do not issue a live Stripe charge. Do not perform a broad send. Do not import production contacts. Do not automatically publish through Buffer. Do not hard-delete data. Do not declare production live. Do not import `OT-89B` BNA code into One Time. Do not resolve conflicts with blanket `ours` or `theirs`, and do not delete an entire lane to make tests pass.

Protected provider actions require explicit, separate authorization and isolated test credentials. Missing credentials produce accurate readiness states, not fake success and not an undifferentiated failure.

## OT-99 phase 0 — persist state before edits

1. From the current checkout, run `runtime/OT-99-persist-task-state.sh` before creating or modifying integration files.
2. Export its printed path as `OT99_STATE_DIR`.
3. Run `runtime/OT-99-discover-remote-state.sh`.
4. Preserve the resulting state directory unchanged. Copy only redacted, non-secret evidence into `artifacts/OT-99/preflight/` after the clean integration worktree exists.
5. Record the starting repository, origin URL without credentials, current branch, current HEAD, worktree status, remote refs, tool versions, and packet checksums.

If `git`, authenticated `gh`, remote fetch access, or report access is unavailable, stop integration edits and write a precise blocker. Do not guess branch names or SHAs.

## OT-99 phase 1 — discover and adjudicate current candidates

Use the runtime discovery output and direct inspection to resolve actual remote branches, pull requests, heads, reports, migrations, and CI for `OT-81`, `OT-82`, `OT-83`, `OT-83R`, `OT-84`, `OT-85`, `OT-86A`, `OT-86B`, `OT-87`, `OT-88`, `OT-89A`, and externally referenced `OT-89B`.

For each candidate, verify all of the following against its current remote head:

- remote branch and exact SHA;
- pull request number, URL, head, base, and state when a pull request exists;
- ancestry and merge-base relative to the selected foundation and dependent lanes;
- final or checkpoint report content, not only its path;
- changed migrations and any migration ledger or checksum entries;
- CI check runs and statuses for that exact SHA;
- owned scope stated by the report and scope actually changed in the diff;
- whether the head moved after the report or CI evidence was generated.

Write `artifacts/OT-99/preflight/candidate-adjudication.json` and validate it against `schemas/OT-99-candidate-adjudication.schema.json`.

The integration gate opens only when:

- `OT-83R`, `OT-88`, and `OT-89A` each have an inspectable remote head and checkpoint or final report;
- the `OT-83R` report is a completion report and its completion claim is consistent with code and CI;
- ambiguous multiple candidates are resolved with recorded evidence;
- no required report points to a different head without an explained and verified relationship.

If the gate remains closed, do not create an integration worktree and do not merge anything. Produce a `blocked_preintegration` `OT-99` release manifest and final report that identify the exact missing remote evidence, the last verified SHA, and the minimum action needed to reopen the gate.

## OT-99 phase 2 — verify the audited remote facts

Treat the following as audit hypotheses that must be verified or corrected with evidence:

- `main` is still the initial foundation and is unsuitable as the direct integration base.
- Pull request `#25` duplicates the `OT-81` line from `#24` and is one commit ahead, while descendants use `#24`.
- `OT-83` was partial at its audited head and requires `OT-83R` completion.
- `OT-84`, `OT-85`, `OT-86A`, and `OT-87` introduced colliding `2000_*` migrations; `OT-86B` introduced `2100_*` migrations.
- Shared overlaps include the server application, configuration, contracts, domain indexes, `.env.example`, package manifests, lockfiles, and tests.
- `OT-84`, `OT-86A`, and `OT-86B` disagree between two and three outbox assertions.

Record whether each hypothesis is confirmed, corrected, or no longer applicable. Include exact SHAs and paths.

## OT-99 phase 3 — create the clean integration line

1. Select the latest completed `OT-83R` head by report date, remote head freshness, ancestry, CI, and verified completion. Do not use `main` as a shortcut.
2. Create a sibling clean worktree and a unique branch named with the prefix `integration/ot-99-final-semantic-convergence-` followed by the UTC creation timestamp.
3. The branch must start exactly at the selected `OT-83R` SHA.
4. Copy the redacted preflight evidence and this packet into `artifacts/OT-99/packet/` or another repository-standard evidence directory without copying secrets.
5. Confirm the integration worktree is clean before the first merge.

## OT-99 phase 4 — reconcile pull requests #24 and #25

Inspect pull requests `#24` and `#25`, their exact heads, merge bases, unique commits, and patches.

Descendants are expected to use the `#24` lineage. Never merge both histories blindly. Compute the exact delta that exists in `#25` but not `#24`. Determine whether each unique change is already present downstream, obsolete, conflicting, or still useful. Selectively cherry-pick or manually reapply only useful, non-duplicated behavior. Record the source commit, destination commit, files, rationale, and tests. If no delta remains useful, record that conclusion with diff evidence.

## OT-99 phase 5 — merge histories in dependency order

Follow `matrices/OT-99-dependency-merge-matrix.csv`.

Use ordinary history merges for eligible branches in this order after the `OT-83R` foundation:

1. `OT-84`;
2. `OT-88` after `OT-84`;
3. `OT-89A` after `OT-84`;
4. `OT-85`;
5. `OT-86A`;
6. `OT-86B` after `OT-86A`;
7. `OT-87`.

Before every merge, use ancestry checks. If a candidate head is already an ancestor of the current `OT-99` head, skip the merge and record why. If a descendant already contains its parent, do not merge the parent twice. If a branch is incomplete, stale, superseded, or fails its checkpoint contract, do not import it silently; record the decision and the minimum remediation.

For each merge, inspect the full diff and preserve ordinary branch history. Use no-commit merges when conflict resolution is required so the semantic union can be reviewed before commit.

## OT-99 phase 6 — perform semantic union across collisions

Follow `matrices/OT-99-semantic-collision-matrix.csv`.

Resolve every shared file by behavior, contract, and ownership rather than by choosing one side wholesale. Reconcile at least:

- server application composition and provider registration;
- configuration schema, environment parsing, defaults, validation, and `.env.example`;
- event names, DTOs, contracts, serialization, and versioning;
- domain barrel files and indexes;
- feature flags and provider-off behavior;
- route and visible-action registry entries;
- background workers, queues, retries, idempotency, and dead-letter behavior;
- design tokens and reusable portal UI primitives;
- authentication, roles, capabilities, account, household, and sibling boundaries;
- package manifests and exactly one coherent lockfile result;
- tests, docs, checkpoint evidence, and operational runbooks.

For the two-versus-three outbox discrepancy, identify the canonical business events and side effects. Replace brittle raw-count assertions with exact semantic event-set assertions where appropriate. Preserve idempotency and prove no duplicate provider action occurs on retries.

Landing, signup, CRM, and portals must boot and remain usable with every provider disabled, unreachable, timing out, or returning controlled errors.

## OT-99 phase 7 — deterministically repair migrations

Follow `matrices/OT-99-migration-renumber-matrix.csv`.

1. Discover the repository's authoritative migration mechanism, ledgers, checksums, and environment-applied migration records.
2. Never rename an identifier proven applied in a relevant environment.
3. Build the set of branch-introduced migrations absent from the selected `OT-83R` base.
4. Identify numeric and semantic collisions, including all `2000_*` and `2100_*` files.
5. For every unapplied colliding migration, assign a deterministic new number using this key: dependency order from the merge matrix, then original numeric prefix, then original path in lexical order, then source commit SHA.
6. Allocate the smallest free numeric identifiers above the highest fixed identifier that appears in the selected base or any verified applied ledger. Skip every fixed identifier. Preserve suffix meaning while making names unique.
7. Update every migration checksum, ledger, registry, import, documentation reference, snapshot, and test fixture that the repository actually uses.
8. Write `artifacts/OT-99/migrations/renumber-map.json` with old path, new path, source task, source SHA, applied status, reason, and checksum before and after.

Prove migration safety on disposable PostgreSQL 16. Use isolated random credentials and disposable databases or containers. Test a fresh install and every relevant upgrade path represented by the selected base, candidate reports, verified staging ledgers, and any distinct applied migration state. At minimum, exercise fresh install, selected `OT-83R`, each integrated lane head that introduced schema changes, and the final `OT-99` head. Verify apply, rollback where supported, reapply, data preservation, constraints, indexes, and concurrent startup behavior.

Do not point destructive migration tests at production or shared staging.

## OT-99 phase 8 — keep BNA separate

`OT-89B` is the BNA support consumer and remains an asynchronous external dependency. Inspect remote report or linked evidence when accessible, but do not import BNA code into One Time.

Represent `OT-89B` in the release manifest with its system boundary, report reference, current readiness, protocol compatibility, and blockers. Validate One Time's `OT-89A` producer contract with a stub, contract fixture, or isolated test consumer. A missing BNA credential or unavailable BNA environment blocks the protected end-to-end canary, not the correctness of the One Time producer implementation.

## OT-99 phase 9 — validate the complete system

Detect the repository's package manager, workspace layout, build system, and existing test commands. Run all existing relevant checks plus the following categories, recording commands, exact SHA, timestamps, exit codes, logs, and artifacts:

- unit and integration;
- browser end-to-end and every-visible-action coverage;
- accessibility;
- security and dependency audit;
- privacy, secret scanning, and PII handling;
- provider URL and environment-target validation;
- bundle size and request-count budgets;
- performance and latency budgets;
- concurrency, retry, idempotency, and duplicate-delivery tests;
- role, capability, account, household, and sibling isolation tests;
- migration fresh-install and upgrade-path tests;
- provider outage and provider-off synthetic journeys.

Every visible control in landing, signup, CRM, and portals must map to a valid route or action. Exercise it in provider-off mode or verify an explicit, accessible disabled state with a truthful explanation. No dead buttons, hidden authorization bypasses, or unhandled provider exceptions are acceptable.

Run secret and PII checks on generated evidence before committing it.

## OT-99 phase 10 — open one clean draft pull request

Before pushing:

- review the complete diff against the selected `OT-83R` SHA;
- ensure there are no unrelated edits, generated secrets, provider credentials, production contacts, or temporary database artifacts;
- validate `artifacts/OT-99/release-manifest.json` against `schemas/OT-99-release-manifest.schema.json`;
- rerun the repository's required checks at the exact final SHA.

Push one `OT-99` integration branch and open one draft pull request titled `[OT-99] Final semantic convergence`. Target the selected `OT-83R` release line or another remotely verified convergence target that already contains the selected foundation. Do not target `main` while the audit confirms it is still the initial foundation. The pull request must identify the selected foundation SHA, every integrated or skipped lane, the `#24/#25` decision, migration map, test evidence, staging authorization state, and rollback plan. After opening it, re-fetch the remote branch and verify that the remote head equals the local exact SHA. Do not report success merely because the push or pull-request command returned zero.

## OT-99 phase 11 — deploy exact SHA only to isolated One Time staging

Deploy only when staging authorization exists and genuine isolation is proven. The deployed artifact must be built from the exact remote `OT-99` pull-request SHA; record the digest and deployment identity.

Isolation proof must cover a distinct staging hostname, non-production database, non-production object storage, non-production queues, non-production provider credentials, no production contact import, test or sandbox provider modes, and no root DNS change. If any proof is absent, do not deploy and mark staging `blocked` or `not_authorized`.

A real staging URL and SHA may be reported only after independently reading them back from the deployed environment and confirming the health endpoint or build metadata returns the exact SHA.

## OT-99 phase 12 — synthetic journeys and protected canaries

Run provider-off synthetic journeys first for landing, signup, Rabbi login, CRM, portals, Telegram, WhatsApp, Zoom, Vimeo/content/KB, Buffer approval-only flow, Stripe TEST entitlements, and `OT-89A` support production.

Provider-off journeys must prove graceful degradation, truthful disabled states, no credential leakage, no accidental production URL, and continued usability of landing, signup, CRM, and portals.

Run each protected canary only when separately authorized and isolated:

- Telegram: a designated test bot and designated test destination only;
- WhatsApp: approved sandbox or test number only;
- Zoom: isolated test classroom and test participants only;
- Vimeo/content/KB: isolated test content or read-only validation as authorized;
- Buffer: create an approval-only draft or equivalent review item, never automatic publication;
- Stripe: TEST mode only, never a live charge;
- `OT-89A`: isolated support event to a stub or authorized BNA test consumer, never a production broad send.

Read back provider-side evidence and correlate it to the exact `OT-99` SHA and idempotency key. A local request with no provider-side confirmation is not a passed canary.

## OT-99 phase 13 — rollback and final reporting

Follow `matrices/OT-99-rollback-matrix.csv`. Prove code rollback, worker pause, feature-flag disablement, provider credential revocation or detachment, migration rollback or forward-fix strategy, and data preservation. Do not use hard deletion as rollback.

Produce:

- `artifacts/OT-99/release-manifest.json` conforming to `schemas/OT-99-release-manifest.schema.json`;
- `artifacts/OT-99/FINAL-REPORT.md` conforming to `docs/OT-99-final-report-contract.md`;
- all command logs, test reports, migration evidence, screenshots where repository policy permits, deployment readback, and canary readback under `artifacts/OT-99/`.

The final report must plainly state:

- whether the Rabbi can log in and the evidence used;
- which actions work;
- which actions are disabled and why;
- the exact staging URL and exact deployed SHA only when real;
- remaining blockers;
- the tested rollback procedure;
- the shortest evidence-based route to live.

Report every component with these six independent readiness dimensions: code present, integrated, configured, canary passed, staging accepted, production live. Never infer a later dimension from an earlier one. `production live` remains `no` unless a separately authorized production release has actually occurred and been independently verified; this task does not authorize that release.
