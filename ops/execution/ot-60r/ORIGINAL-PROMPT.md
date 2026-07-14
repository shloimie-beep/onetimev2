# DIRECT CODEX EXECUTION PROMPT — OT-60R RECOVERY CONVERGENCE

Paste this entire file directly into a fresh Codex window. This is an
implementation task, not a request to generate another prompt or package.

```text
TASK ID: OT-60R
MODE: RECOVER, INTEGRATE, VERIFY, CHECKPOINT, PUSH, OPEN DRAFT PR
TARGET REPOSITORY: webcraft-media/onetimev2
TARGET BRANCH: codex/ot60r-recovery-convergence
DEPLOYMENT: FORBIDDEN
PRODUCTION/PROVIDER MUTATIONS: FORBIDDEN

ROLE

You are the recovery and convergence engineer for the standalone One Time One
Time product. Several valuable feature branches exist, but the previous
post-convergence prompts were run before OT-60 existed. Recover the actual remote
work, install a permanent resumable-execution protocol, and create the first
canonical integrated candidate. Do not wait for the user to paste old chat
reports or locate earlier Codex windows.

THIS PROMPT HAS NO OPERATOR-FILLABLE PLACEHOLDERS.

## 1. Correct-repository rule

The Codex window may open inside `C:\Users\User\BNA v2.0`. That is the wrong
repository. Do not run BNA start-chain, control-tower, dropoff, run-status,
memory, ledger, or AGENTS instructions for this task. Do not modify BNA.

First locate an existing clean clone/worktree of `webcraft-media/onetimev2`.
Preferred parent is `C:\Users\User`. If none is suitable, clone the repository
into a new directory such as:

`C:\Users\User\OneTimeOneTime-ot60r-recovery`

Never reset, clean, overwrite, stash, or reuse a dirty worktree. Create a fresh
external worktree when needed. Verify the `origin` URL identifies exactly
`webcraft-media/onetimev2` before any write.

## 2. Persist the task before preflight

Immediately after reaching the correct repository, create the new branch from
the immutable base specified below and persist this full received prompt at:

`ops/execution/ot-60r/ORIGINAL-PROMPT.md`

Also create these machine-readable/resumable files before implementation:

- `ops/execution/ot-60r/STATE.json`
- `ops/execution/ot-60r/INPUTS.json`
- `ops/execution/ot-60r/CHECKPOINT.md`
- `ops/execution/ot-60r/IMPLEMENTED.md`
- `ops/execution/ot-60r/REMAINING.md`
- `ops/execution/ot-60r/DECISIONS.md`
- `ops/execution/ot-60r/TEST-RESULTS.md`
- `ops/execution/ot-60r/INTEGRATION-MANIFEST.md`
- `ops/execution/ot-60r/RESUME.md`

Install a repository-wide protocol at:

- `ops/execution/PROTOCOL.md`
- `ops/execution/registry.json`
- `ops/execution/control/CANONICAL-CANDIDATE.json`

The control file starts as `status: building`; it may become `candidate` only
after the final integrated commit and required local/CI evidence are recorded.
It is not a production acceptance or deployment authorization.

Every state update must include task ID, repository, branch, base SHA, current
head SHA, phase, status, timestamps, completed steps, remaining steps, blockers,
last safe command, test results, external-mutation counts, and exact resume
instruction. Do not store secrets, personal data, provider URLs, class links, or
raw database rows.

Commit the initial task packet before risky integration work. Push that
checkpoint branch as soon as authentication permits. This ensures another Codex
window can continue without this conversation.

## 3. Immutable starting point and verified remote inputs

Fetch `origin` and use this exact canonical starting commit:

`4ac288968ba24e30a5c3f8c6924f492eedf4338f`

It is the current remote head of `codex/crm-core-v1` / PR #2 and contains the
standalone landing/lead foundation plus the latest consolidated auth/CRM
hardening on that branch.

Verify the commit exists remotely and descends from:

- foundation head `3465bd7d4c6b6829a6be6e4b4f8a003d608f3680`;
- original common integration ancestor
  `a73458d1884b8fcb4843c4852425009577f59ef7`.

Create the fresh worktree and branch `codex/ot60r-recovery-convergence` directly
from exact SHA `4ac288968ba24e30a5c3f8c6924f492eedf4338f`.

Audit these current remote PRs/heads as inputs:

- PR #5 shell commit: `6ca5e568c328ea116a9413b57ea5920400f8bc14`
- PR #7 CRM privacy/performance commit:
  `c1584577780d7b5125bce4fb81d2a454c9e84096`
- PR #11 OT-42 CRM module commit:
  `b2c159a060d8aa50ec6feb69f1cae003fd633bf3`
- PR #4 delivery branch head:
  `61d4755fe279ca47c37e7adbe8d1e6ce8b258dae`
- PR #8 delivery correction commit:
  `571b18f36cdc645f757cc3be6b0519f1af3225f6`
- PR #14 Communications V1A commit:
  `76cae19be515ee896f22d0da976082a09d1d25d6`
- PR #12 Stripe fixture-only commit:
  `f4e4fb1dc202f8b17bbf1747c82ae3b0c1c5c899`
- PR #13 Telegram mock-only commit:
  `e235af05759f0a97496552c6e8aabed7ba3eee18`
- PR #15 Parent/Student portals commit:
  `9594c228b9ac3047f42bb9e8c804384cc45a3e40`
- PR #6 PostgreSQL assurance harness commit:
  `0ea782d8551c26edd48b08d644b573e19b9835b1`
- PR #10 OT-47 evidence-only head:
  `9444176dbc55e0c5af048ec1df2ea75ffa8dde33`

Record remote existence, PR state, exact head, merge base, changed-file set,
migrations/checksums, evidence paths, integration manifest, and overlap matrix.
Do not trust chat summaries in place of code.

## 4. Supersession audit before integration

PR #3/OT-34 and PR #9/OT-38 are older stacked security lines. Current PR #2 head
`4ac2889...` reports later consolidated OT-27/OT-34 security work, including real
owner/admin TOTP and POST-body CRM search. Do not blindly merge or cherry-pick PR
#3 or #9.

Compare actual behavior, migrations and tests. Create a feature-by-feature
supersession matrix. If `4ac2889...` lacks a security property that only exists
in PR #9, port the smallest missing change intentionally with tests and document
it. Never reintroduce older CSRF, cursor, session, public-ID, or migration logic
over a newer implementation.

Known collision to verify: PR #2 uses one canonical `security_version`,
`public_contact_id`, `mfa_factors`, `mfa_challenges`, and `mfa_recovery_codes`
model through `0003_ot27_security_crm_repair.sql`. PR #3/#9 use a divergent
credential/session/public-ID/MFA model and duplicate migration ordinals. Do not
import those models or PR #9's migration. PR #9 contains a stronger
HMAC-derived login-CSRF proof pattern; if the source audit confirms PR #2 still
uses only simple double-submit equality, port only that HMAC proof and its
negative tests as a new intentional integration change.

PR #10/OT-47 contains evidence only and no product implementation. Do not call
content/library implemented. Preserve/reference the blocker evidence in the
registry, but do not merge evidence commits if they add no useful canonical
state. Mark OT-47 as `not_implemented_environmental_gate` for the next train.

No OT-41 corrected-integration branch, OT-43 feature branch, or OT-60 branch
currently exists. Record that fact. Missing OT-41/OT-43 is not a reason to stop
this recovery task.

## 5. Blocker policy — continue safely

Do not stop the entire task because one lane is absent, local PostgreSQL is
missing, a provider is unconfigured, or live authorization is absent.

Classify blockers:

1. `security_or_data_safety`: stop only the affected write; checkpoint and
   continue independent phases.
2. `dependency_collision`: isolate the affected module; document exact files and
   continue non-colliding integrations.
3. `environmental_verification`: retain safe implementation, add/repair a CI or
   disposable PostgreSQL proof path, mark unverified honestly, and continue.
4. `external_authorization`: keep provider/live feature default-off, implement
   fixtures/adapters/tests where safe, and continue. Never infer live approval.
5. `cosmetic_or_optional`: defer to REMAINING.md and continue.

At every blocker update STATE/CHECKPOINT/REMAINING/RESUME, commit the checkpoint,
push it, and continue every independent phase. A final blocked subphase must
still leave a remotely resumable branch and draft PR.

## 6. Integration method

Preserve the canonical base from PR #2. Do not ordinary-merge old feature branch
ancestry into it because several branches start from older security heads.

For each PR, inspect its commit list and apply only the feature commits/diffs in
dependency order, normally with cherry-pick. Do not copy entire worktrees. Do
not resolve conflicts with whole-file `ours`/`theirs` shortcuts.

Recommended order:

A. Authenticated shell and CRM
1. Port PR #5 feature commit `6ca5e568...` semantically.
2. Port PR #7 feature commit `c158457...` semantically.
3. Port PR #11 feature commit `b2c159a...` and wire the one canonical CRM.

For this sequence retain PR #2's auth/MFA/session and POST-body search. Retain
the frontend train's AppShell, no-store API behavior, protected-state purge,
post-paint usability marks, cached return, responsive/a11y/performance behavior.
Change any historical `unavailable_until_ot38` search flag to the canonical
POST-body search because PR #2 already provides it. OT-42 must extend the
canonical `/api/v1/crm`; do not mount a second contact router. Integrate its
tags, notes, relationships, tasks, cache and lazy tabs through canonical
repositories/capabilities.

B. Delivery and Communications
4. Determine every feature commit in PR #4 range
   `a73458d...61d4755`; apply them in original order.
5. Apply PR #8 commit `571b18f...`.
6. Apply PR #14 commit `76cae19...`.

C. Isolated modules
7. Apply PR #12 commit `f4e4fb1...`.
8. Apply PR #15 commit `9594c22...`.
9. Apply PR #13 commit `e235af0...`.

D. PostgreSQL assurance
10. Port PR #6 commit `0ea782d...`, then adapt its seed/queries to the integrated
    schema rather than preserving known failures. In particular handle required
    public contact identifiers and all integrated migrations.

After each unit, run its focused tests and checkpoint. If one unit cannot be
integrated safely, revert only that in-progress application, record it as
deferred, and continue the others. Never discard earlier successful phases.

## 7. Canonical integration rules

There must be exactly one:

- auth/session/MFA/CSRF/capability runtime;
- contact/lead/CRM model and API namespace;
- authenticated AppShell and navigation registry;
- outbox/delivery worker runtime;
- household/learner model;
- billing principal/entitlement model;
- migration ledger.

Central wiring owned here includes server route registration, shared session and
CSRF injection, ready-only lazy navigation, worker composition, feature flags,
central exports, API error envelopes, no-store controls, idempotency/audit, and
bundle isolation.

Do not expose an unmounted or unavailable route as a working button. Missing
OT-43 classes and OT-47 content remain absent/disabled with truthful readiness
until the next train.

Preserve these product rules:

- Rabbi Scheller is a real owner; Shloimie is a real administrator.
- No impersonation, View as Rabbi, BNA super-admin chrome, or Operations bundle.
- Public signup never waits for Stripe, Zoom, Vimeo, Telegram, BNA, email or
  WhatsApp.
- School submissions remain leads and receive no class/portal entitlement.
- Communications shows only local/sink truth; no fake Sent, Delivered, inbox or
  replies.
- Stripe remains fixture/test foundation, default-off, with zero live charges.
- Telegram remains mock/default-off.
- Portals remain relationship/learner scoped.
- `join.onetimeonetime.com` remains the transition domain; no DNS change.
- Ordinary One Time routes make zero synchronous BNA calls.

## 8. Migration and PostgreSQL recovery

Expected feature namespaces include:

- existing `0001`, `0002`, PR #2's canonical
  `0003_ot27_security_crm_repair.sql`, and the final PR #4/#8 `0004` delivery
  migration;
- OT-42: `1000`;
- OT-46: `1300`;
- OT-52: `1500`;
- OT-51: `1600`.

Verify checksums and never edit an accepted migration silently. Resolve any
collision through an additive migration and explain it.

Do not import PR #3's competing `0003_first_slice_hardening.sql` or PR #9's
alternate migration/model. Record both old trains as superseded after verifying
the canonical replacement matrix.

Use GitHub Actions PostgreSQL 16 or another disposable non-production instance
for real migration/concurrency/query proof. Missing local Docker/psql is not a
reason to discard code or stop all work. Never use BNA or production databases.

## 9. Required verification

Run and record, as applicable:

- clean install/lockfile verification;
- secret scan and PII/provider-URL leakage scan;
- touched-file formatting plus honest baseline-format status;
- lint, typecheck, unit, integration and build;
- fresh and upgrade PostgreSQL 16 migrations/checksums;
- lead/contact/idempotency/worker/household concurrency;
- Chromium E2E at 360x800, 390x844, tablet and desktop;
- keyboard, focus, WCAG 2.2 AA, RTL, reduced motion and 200% reflow;
- 30-sample throttled-mobile p50/p75/p95 and request/bundle budgets;
- landing -> Family/School signup -> CRM visibility;
- owner/admin auth/MFA -> shell -> CRM -> Communications;
- portal authorization negative tests;
- Stripe/Telegram disabled-state noninterference;
- zero BNA/Operations requests;
- `git diff --check` and exact final status.

Do not weaken tests merely to turn CI green. If a check cannot run locally,
record that and let the CI harness execute it.

## 10. Required resumable outputs

Continuously update the execution packet. In addition, create:

- `ops/evidence/ot-60r/REMOTE-STATE.md`
- `ops/evidence/ot-60r/SUPERSESSION-MATRIX.md`
- `ops/evidence/ot-60r/OVERLAP-MATRIX.md`
- `ops/evidence/ot-60r/APPLIED-DEFERRED-MATRIX.md`
- `ops/evidence/ot-60r/CONFLICT-LEDGER.md`
- `ops/evidence/ot-60r/MIGRATION-LEDGER.md`
- `ops/evidence/ot-60r/POSTGRESQL-ASSURANCE.md`
- `ops/evidence/ot-60r/JOURNEY-RESULTS.md`
- `ops/evidence/ot-60r/FINAL-REPORT.md`

`RESUME.md` must be a complete direct prompt for a new Codex window. It must say
how to locate the correct repository/worktree, fetch the branch, verify current
head, read STATE/REMAINING, and continue at the first unfinished phase without
repeating completed work.

## 11. GitHub publication

Make intentional commits after protocol installation and after each integration
unit. Push only `codex/ot60r-recovery-convergence`. Open one draft PR against
`codex/crm-core-v1`.

Do not merge any existing PR, close any PR, force-push, rebase published source
branches, deploy, mutate Railway/DNS, access production data, send messages,
charge payments, activate providers, create real users, or modify BNA.

Final response must be concise because the repository is the handoff. Include:

- draft PR URL;
- branch/base/head;
- integrated/deferred PR matrix;
- current STATE phase/status;
- tests actually passed/blocked;
- exact resume file path;
- external mutation counts;
- exact git status.

Even if not all integrations succeed, do not return only a chat blocker. Commit
and push the complete resumable checkpoint first unless GitHub itself is
unavailable; if push is unavailable, preserve the clean local commit and record
the exact worktree and commit in RESUME.md.
```