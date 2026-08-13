# Codex Prompt A — One Checkbox Source-of-Truth and Consent Correction

You are in `shloimie-beep/onetimev2`.

This is a dedicated product-consent/source-of-truth lane. It must run in a separate Codex window and separate worktree from the marketing-media lane.

## Read first

1. Current remote `AGENTS.md` from PR #131.
2. Current PR #131 head and launch status/EXECPLAN.
3. PR #141 and all of its changed files.
4. `ops/v2.1-execution/source-spec/03-DECISION-REGISTER-v2.1.md`.
5. `ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml`.
6. `ops/v2.1-execution/source-spec/08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`.
7. `ops/v2.1-execution/source-spec/09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`.
8. `ops/v2.1-execution/source-spec/10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`.
9. `ops/v2.1-execution/source-spec/12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`.
10. `ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-ONE-CHECKBOX.md`.

## Locked replacement decision

There is exactly **one required, initially unchecked visible checkbox ever**:

`I agree to the Terms of Use`

That one action includes the complete integrated relationship, including privacy, Student data, billing/refund terms, service communications, general marketing, newsletter, permitted messaging channels, Parent authority, Student recording/capture, and Student promotional/public-display use across website, email, WhatsApp, Facebook, Instagram, YouTube, organic content, and paid advertising.

There is no second marketing checkbox, no separate media checkbox, no optional per-Student checkbox, and no later Parent-portal checkbox.

The backend still records distinct versioned scopes and audit facts from the one visible action. Later unsubscribe, suppression, or verified future-use withdrawal is handled through account/privacy/support controls, not another signup checkbox.

This replaces the conflicting PR #141 statement that WhatsApp and Student recording/recognition/public-display consent remain outside the checkbox. PR #141 must not merge unchanged.

## Required work

Create or resume a dedicated child branch from the current PR #131 head. Do not modify the active PR #131 worktree directly.

Update all affected source-of-truth and implementation files, including at minimum:

- `AGENTS.md`;
- `ops/v2.1-execution/source-spec/03-DECISION-REGISTER-v2.1.md` — add/replace `DEC-056`;
- `ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml`;
- `ops/v2.1-execution/source-spec/08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`;
- `ops/v2.1-execution/source-spec/09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`;
- `ops/v2.1-execution/source-spec/10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- `ops/v2.1-execution/source-spec/12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`;
- launch status/readiness files;
- `packages/domain/src/legal/content.ts`;
- `packages/domain/src/legal/policies.ts`;
- Family signup contract, domain policy, server repository/service/router, public signup model/UI, generated public page, audit projections, and focused tests;
- any visible-action registry or generated digest affected by the exact final bytes.

## Exact semantics

The one visible action must record, without adding visible controls:

- Terms version/digest;
- Privacy and Student Data Notice version/digest;
- acceptance timestamp/source/audit request;
- adult account and household;
- each dependent Student covered by the authority/media attestation;
- required service-communication scope;
- marketing/newsletter scope;
- channel scopes;
- Student recording/capture scope;
- Student promotional/public-display scope;
- exact policy versions.

Do not create Student contacts in GHL. Do not send passwords to GHL. Do not treat a later marketing/media withdrawal as automatic service/account/class withdrawal unless exact legally reviewed policy says so.

## Legal gate

Preserve a qualified legal-review release gate. This operator decision controls the UI/product design, but Codex must not claim that bundling is legally sufficient.

Do not deploy or mutate production. If qualified legal review says a separate affirmative action is mandatory, stop and return the conflict to Shloimie. Do not silently add a second checkbox.

## Validation

Run focused contract, domain, repository, router, generated-page, browser, accessibility, and source-of-truth checks. Verify at 360×800, 390×844, tablet, and desktop.

Acceptance requires:

- exactly one visible checkbox;
- initially unchecked;
- exact label `I agree to the Terms of Use`;
- no other visible consent/marketing/media/newsletter control;
- integrated Terms link and legally reviewable copy;
- distinct backend projections from one action;
- duplicate/replay-safe acceptance record;
- no broad send/provider/deploy effects;
- all changed source-of-truth documents agree.

## Return

1. Branch and draft PR.
2. Exact PR #131 head used.
3. Files changed.
4. Final `DEC-056` wording.
5. Final visible checkbox and linked Terms copy.
6. Backend scopes recorded.
7. Tests and viewport evidence.
8. Legal-review blocker/status.
9. External-effect counts.
10. One exact next operator action.
