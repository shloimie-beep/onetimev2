# One Time Operator Decision Override — One Checkbox Includes Everything

**Decision ID:** `OT-CTRL-20260813-ONE-CHECKBOX`  
**Decision date:** 2026-08-13  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED OPERATOR REPLACEMENT — SOURCE OF TRUTH**  
**Target:** `shloimie-beep/onetimev2` / PR #131 integration line

## Replacement decision

The One Time Family signup experience displays **exactly one required, initially unchecked checkbox**, and there is **never a second consent, privacy, marketing, recording, media, newsletter, WhatsApp, or Student-publicity checkbox** in signup, Student creation, onboarding, or the Parent portal.

The visible label remains:

> **I agree to the Terms of Use**

The linked integrated Terms of Use is the single document governing the complete relationship. The one affirmative action includes all of the following, to the fullest extent stated in the legally reviewed Terms:

- Terms of Use;
- Privacy Notice and Student Data Notice;
- cancellation, refund, billing, and access terms;
- required service and account communications;
- One Time program updates;
- general marketing and the Parent newsletter;
- permitted email, SMS, and WhatsApp communications, subject to applicable suppression and opt-out rules;
- the account owner’s representation that they are legally authorized to act for every dependent Student they create;
- live-class recording and capture of Student image and voice;
- use of a Student’s approved name, image, voice, likeness, classroom participation, and recorded class appearances in One Time service delivery and promotional materials;
- use across the One Time website, email, WhatsApp, Facebook, Instagram, YouTube, organic posts, and paid advertising.

## Backend projection

Although the customer sees and checks only one box, the backend must record distinct, versioned facts for audit and operations, including at least:

- integrated Terms version and digest;
- Privacy/Student Data Notice version and digest;
- acceptance timestamp, source route, request/audit reference, adult account, household, and affected Student identities;
- adult service-communications scope;
- adult marketing/newsletter scope;
- permitted messaging-channel scopes;
- dependent-Student authority attestation;
- Student recording/capture scope;
- Student promotional/public-display scope;
- policy/notice text versions governing those scopes.

This is one visible action with multiple internal projections. It is not permission to create additional visible checkboxes.

## Withdrawal and suppression

Unsubscribe, DND, complaint, hard-bounce, legal suppression, and a later privacy/media-use withdrawal remain authoritative for future processing. A later withdrawal is handled through account/privacy controls or a verified support request, **not another signup checkbox**. Marketing or future-media withdrawal does not automatically cancel the Family account, subscription, or class access unless the legally reviewed Terms explicitly require otherwise.

## Superseded material

This decision supersedes all conflicting statements, including:

- PR #141 text saying WhatsApp or Student recording/recognition/public-display consent stays outside the one checkbox;
- any proposed separate optional media-release checkbox;
- any per-Student checkbox requirement;
- any marketing handoff that preserves a second checkbox;
- any acceptance test that expects more than one visible checkbox.

PR #141 must not merge unchanged. It must be rebased or replaced so the entire implementation and documentation agree with this decision.

## Required source-of-truth updates

Codex must update, at minimum:

- `AGENTS.md`;
- `ops/v2.1-execution/source-spec/03-DECISION-REGISTER-v2.1.md` — replace/add `DEC-056`;
- `ops/v2.1-execution/source-spec/02-ACCEPTANCE-CONTRACT-v2.1.yaml`;
- `ops/v2.1-execution/source-spec/08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`;
- `ops/v2.1-execution/source-spec/09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`;
- `ops/v2.1-execution/source-spec/10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- `ops/v2.1-execution/source-spec/12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`;
- current launch status/readiness documents;
- legal content and policy definitions;
- Family signup contracts, domain policy, repository/service/router, UI model, generated public page, audit projections, and focused tests.

## Legal and safety gate

This is the locked product/UI decision. It is **not a legal conclusion** that one bundled action satisfies every applicable consent requirement in every jurisdiction.

Because the program involves children and photographs, video, and audio containing a child’s image or voice can be regulated personal information, qualified legal review of the exact integrated Terms and consent method remains a release gate. Codex must preserve that legal-review gate and must not deploy the changed consent flow until approval is recorded.

If qualified counsel concludes that applicable law requires a separate affirmative action, Codex must stop and return the conflict to Shloimie rather than silently adding a second checkbox.
