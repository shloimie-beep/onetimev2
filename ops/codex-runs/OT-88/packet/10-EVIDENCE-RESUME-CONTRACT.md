# OT-88 Evidence, State, Resume, and Final-Report Contract

## Required run directory

All run-control and evidence files live under:

```text
ops/codex-runs/OT-88/
```

Create the directory and the four controlling files before editing product code.

## Required controlling files

### `TASK_PROMPT.md`

Contains the full prompt supplied to Codex. Include source filename/reference and a SHA-256 of the prompt content. Do not include secrets.

### `STATE.json`

Machine-readable current state. It must remain valid JSON after every update.

Recommended schema:

```json
{
  "ticket": "OT-88",
  "status": "PREFLIGHT_COMPLETE",
  "startedAt": "ISO-8601 UTC",
  "updatedAt": "ISO-8601 UTC",
  "repository": {
    "root": "absolute path",
    "identityEvidence": ["safe description"],
    "sourceRemote": "remote name",
    "sourceBranch": "codex/ot84-telegram-action-gateway",
    "sourceRef": "fetched remote-tracking ref",
    "sourceCommit": "actual runtime-resolved commit",
    "targetBranch": "codex/ot88-zoom-learner-classroom",
    "worktree": "absolute path"
  },
  "ot83Foundation": {
    "provenance": [
      {"type": "run-artifact-or-commit", "pathOrRef": "actual value", "summary": "safe summary"}
    ],
    "functionalEvidence": [
      {"capability": "portal auth", "paths": ["actual path"], "summary": "safe summary"}
    ],
    "verified": true
  },
  "repositoryConventions": {
    "languageFramework": "actual value",
    "packageManager": "actual value",
    "migrationTool": "actual value",
    "testCommands": ["actual command"],
    "ot84ContractPaths": ["actual path"],
    "bnaDefinition": "actual repository definition or unresolved note"
  },
  "safetyMode": {
    "providerMutationsEnabled": false,
    "externalRemindersEnabled": false,
    "zoomFeatureParticipantEnabled": false,
    "zoomCanaryEnabled": false,
    "providerOffDefault": true
  },
  "protectedPrerequisites": {
    "zoomCredentialReferencePresent": false,
    "testAccountAuthorizationVerified": false,
    "testMeetingConfigured": false,
    "registrationVerified": false,
    "clientPrivacyVerified": false,
    "componentPrivacyVerified": false,
    "canaryAllowlistConfigured": false
  },
  "checkpoints": [
    {
      "at": "ISO-8601 UTC",
      "status": "PREFLIGHT_COMPLETE",
      "summary": "safe concise checkpoint",
      "commit": "actual commit if one exists",
      "evidence": ["relative path"]
    }
  ],
  "tests": {
    "providerOff": "NOT_RUN",
    "security": "NOT_RUN",
    "performance30Sample": "NOT_RUN",
    "accessibility": "NOT_RUN",
    "zoomCanary": "NOT_RUN"
  },
  "git": {
    "lastCommit": null,
    "pushed": false,
    "draftPrUrl": null,
    "clean": true
  },
  "blockers": []
}
```

Use actual resolved values at runtime. The JSON example is a schema illustration, not permission to leave placeholder data in the final run state.

### `RESUME.md`

Must be usable by a new operator without prior chat context.

Required sections:

1. current status/checkpoint;
2. repository root and worktree path;
3. target branch;
4. source remote/ref/actual commit;
5. commands to verify the worktree and current branch;
6. OT-83 proof summary;
7. completed phases;
8. next exact action;
9. tests/evidence still required;
10. protected prerequisites still missing, as booleans/descriptions only;
11. safe environment/config names needed, never values;
12. uncommitted changes or commit list;
13. push/PR state; and
14. stop conditions.

Example verification sequence using actual recorded values:

```text
cd <recorded-worktree>
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain
git rev-parse HEAD
cat ops/codex-runs/OT-88/STATE.json
```

The final `RESUME.md` must contain the concrete worktree path and real branch/commit, not angle-bracket placeholders.

### `FINAL.md`

Initially contains `IMPLEMENTATION_PENDING`. Replace with the exact final report before completion.

## Status vocabulary

Use one of these primary states, extending only when necessary and documented:

```text
PREFLIGHT
BLOCKED_REPOSITORY_NOT_FOUND
BLOCKED_REMOTE_BASE_MISSING
BLOCKED_OT83_FOUNDATION_UNVERIFIED
BLOCKED_TARGET_BRANCH_CONFLICT
PREFLIGHT_COMPLETE
IMPLEMENTING
MIGRATIONS_COMPLETE
PROVIDER_OFF_TESTS_PASSED
SECURITY_TESTS_PASSED
PERFORMANCE_EVIDENCE_COMPLETE
ACCESSIBILITY_EVIDENCE_COMPLETE
READY_FOR_ZOOM_CANARY
ZOOM_CANARY_RUNNING
CANARY_FAILED
ZOOM_CANARY_PASSED
READY_FOR_REVIEW
BLOCKED_TESTS
BLOCKED_PUSH_OR_DRAFT_PR
```

`READY_FOR_ZOOM_CANARY` means:

- safe code is complete;
- provider-off/sink, security, performance, and accessibility evidence pass;
- production provider mutation and broad reminders remain off;
- real Zoom canary did not run because one or more protected prerequisites are missing/unproven; and
- an exact checklist identifies what an authorized operator must provide/verify.

It is not a partial-code excuse.

## Evidence directory

```text
ops/codex-runs/OT-88/evidence/
  commands.md
  tests/
    unit.md
    integration.md
    e2e.md
    authorization.md
    questions.md
    reminders.md
  provider-off/
    network-isolation.md
    outbound-counts.json
  security/
    leakage-scan.md
    secret-scan.md
    headers.md
  performance/
    samples.json
    summary.md
  accessibility/
    automated.md
    keyboard.md
    rtl-reduced-motion.md
  zoom-canary/
    prerequisites.md
    results.md
    sanitized-screenshots/   # only if safe and needed
  git/
    diff-check.md
    status.md
    push-pr.md
```

Follow repository conventions if test tools already emit reports elsewhere; reference them from this directory. Do not duplicate unsafe raw reports.

## `commands.md` format

For each significant command:

```text
### <UTC timestamp> — <purpose>

Command:
`<exact command with secret values omitted or represented by variable name>`

Working directory:
`<path>`

Exit status:
`0`

Result:
<test count / safe summary / artifact path>
```

Do not use `set -x` around secrets. Do not paste environment dumps.

## Test evidence requirements

Every test evidence file includes:

- command;
- exit code;
- tool/version if material;
- tests passed/failed/skipped;
- elapsed time;
- final commit tested;
- artifact path; and
- safe explanation of any skip.

A skip caused by absent protected Zoom credentials belongs in the canary prerequisite report, not hidden in the general test count.

## Performance evidence schema

`performance/samples.json` contains exactly the recorded sample rows, including failed samples.

Conceptual row:

```json
{
  "sample": 1,
  "path": "mobile-client",
  "cold": true,
  "commit": "actual commit",
  "environment": "safe test environment label",
  "nextClassMs": 0,
  "grantIssueMs": 0,
  "shellReadyMs": 0,
  "bootstrapSinkMs": 0,
  "sdkMountBoundaryMs": 0,
  "appOwnedTotalMs": 0,
  "cls": 0,
  "longTaskCount": 0,
  "result": "PASS",
  "leakScan": "PASS"
}
```

Actual values must replace zeros. Summary includes sample count, p50, p95, max, environment caveats, and budgets.

## Provider-off outbound counts

Record machine-readable counts for each controlled scenario, for example:

```json
{
  "scenario": "one-question-one-reminder-provider-down",
  "zoomCalls": 0,
  "ot84SinkCalls": 1,
  "ot84DistinctRecipientRefs": 1,
  "reminderSinkCalls": 1,
  "reminderDistinctRecipientRefs": 1,
  "unexpectedExternalRequests": 0
}
```

Use actual test output. Do not record external recipient identifiers or payload text.

## Zoom canary prerequisites report

`zoom-canary/prerequisites.md` lists checks as pass/fail/unknown:

- protected Meeting SDK credential reference available;
- test account authorization/cross-account requirements verified;
- test meeting configured;
- per-learner registration identity verified;
- installed SDK minimum version verified;
- client-view privacy controls verified;
- component-view privacy controls verified;
- explicit test learner/occurrence allowlist;
- canary operator authorized;
- no production mutation;
- no broad reminders; and
- evidence storage sanitized.

Never write values, meeting identifiers, account IDs, tokens, or screenshots containing them.

## Final report template

`FINAL.md` must use this structure:

```text
# OT-88 Final Report

## 1. Status
READY_FOR_REVIEW | READY_FOR_ZOOM_CANARY | BLOCKED_...

## 2. Repository and worktree
- Repository root:
- Worktree:
- Target branch:

## 3. Source proof
- Remote:
- Source branch:
- Fetched ref:
- Resolved source commit:

## 4. OT-83 foundation proof
- Provenance:
- Functional evidence paths:

## 5. Final commits
- <actual commit and subject>

## 6. Implemented scope
- Domain/persistence:
- API/application services:
- UI/SDK shell:
- Questions/OT-84:
- Reminders:
- Readiness/canary:

## 7. Security and privacy invariants
- Ordinary surface leakage prevention:
- Dedicated bootstrap controls:
- Authorization/replay:
- Logging/analytics/support/Telegram redaction:
- Child data/attendance minimization:

## 8. Authorization evidence
- Three seats:
- Fourth-seat/concurrency:
- Cross-household:
- Sibling:
- School/no-subscription:

## 9. Tests
| Command | Exit | Passed | Failed | Skipped | Evidence |

## 10. Performance
- Samples:
- p50/p95/max:
- Budget result:
- Raw evidence:

## 11. Accessibility / keyboard / RTL / reduced motion
- Results and evidence:

## 12. Provider-off / sink / no-BNA-fanout
- Network isolation:
- Outbound counts:
- Repository BNA definition and assertion:

## 13. Zoom canary
- Ran: yes/no
- Scope/result or missing prerequisites:
- Evidence:

## 14. Questions and OT-84
- Redaction/privacy:
- Retry/idempotency:
- Feature-next disabled Zoom port:

## 15. Git and draft PR
- Push:
- Draft PR base/head:
- Draft PR URL or blocker:

## 16. Cleanliness
- git diff --check:
- git status --porcelain:
- secret/leak scan:

## 17. Known limitations
- Provider/account/UI limitations:
- Disabled automation:

## 18. Resume instructions
- Exact path/commands/checkpoint:
```

Replace every field with actual evidence. Remove instructional placeholders in the final report.

## Draft PR body requirements

The draft PR should include:

- OT-88 purpose and fixed product decision;
- base/source commit proof;
- schema/domain summary;
- protected launch/security model;
- view/fallback behavior;
- question/OT-84 behavior and no Zoom chat;
- disabled spotlight automation;
- test/evidence summary and paths;
- canary status or `READY_FOR_ZOOM_CANARY` checklist;
- production mutation/reminder safety statement; and
- known limitations/rollout flags.

Do not paste provider values or child question content into the PR.

## Cleanliness checks

Before final status:

```text
git diff --check
git status --porcelain
```

Also run repository secret scanning and packet-specific sentinel leakage checks over staged files and evidence.

Expected final state:

- no untracked evidence that should be committed;
- no generated credentials or raw traces;
- target branch pushed without force;
- draft PR created against OT-84 source branch;
- all run files updated and internally consistent; and
- `git status --porcelain` empty.

## Resume safety

A resumed run must revalidate:

1. worktree exists and is the recorded repository;
2. current branch is the recorded target branch;
3. source commit in state is still the branch base for this run;
4. no unrelated changes appeared;
5. run status/checkpoint matches evidence;
6. protected flags remain safe;
7. any newly supplied credentials are references, not written into state; and
8. no production provider/reminder target is selected.

If the source remote branch advances after the run began, do not silently rebase. Record it as a new fact and follow the repository/team’s explicit update policy.
