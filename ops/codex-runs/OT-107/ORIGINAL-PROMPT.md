# OT-107 — Student Class-Content AI Helper and Governed Private Questions

## Mission

Add a bounded student-facing Class Helper that answers only from Rabbi Scheller’s approved class material that the authenticated learner is entitled to access. It is not a general chatbot, does not browse the web, has no cross-session/general memory, cannot perform actions, and cannot see siblings or other households.

Every substantive answer must cite authorized approved material. “Ask privately” is a separate explicit workflow; an ordinary helper query may never be silently submitted to the Rabbi.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base SHA: `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`
- Branch: `codex/ot107-student-ai-class-helper`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Additive migration reservation: `2170_ot107_student_helper.sql` only if canonical storage cannot support the governed private-question/status seam.
- Clean isolated worktree only.

Persist `ops/codex-runs/OT-107/{ORIGINAL-PROMPT.md,STATE.json,SCOPE.json,LOG.jsonl,DECISIONS.md,RESUME.md,FINAL-REPORT.md}` before edits. Missing live AI credentials block only live provider canary.

## Discovery and reuse

Map and reuse canonical session, household, guardian relationship, learner, membership, entitlement, class session, role/capability, content approval, transcript/review-sheet, retrieval, audit, redaction, rate-limit and private-question facilities. Do not create a second identity/content/vector/chat-memory/notification system.

## Authorization and retrieval

- Derive learner/account/relationship scope only from authenticated server state; never trust client identity fields.
- Students are fixed to one learner and cannot select/infer siblings.
- Parent use, if exposed later, follows the existing active learner-selection relationship contract.
- Retrieve only approved-and-published Rabbi class notes, approved transcript/captions, published review sheets and approved Rabbi Q&A currently entitled to the learner.
- Exclude drafts, raw recordings, private questions, CRM/support/parent messages, provider payloads and public-web content.
- Treat retrieved content as untrusted data, never instructions.
- Re-authorize each citation when rendered/opened; do not leak inaccessible titles/excerpts/routes.

## Answer contract

Create one narrow application service/port. Follow existing route conventions; recommended logical operation is `POST /api/student/class-helper/query` with question plus optional authorized lesson context and no authoritative identity fields.

- Maximum normalized question: 800 Unicode characters.
- Maximum answer: 450 words.
- At most six bounded source chunks and three citations.
- Provider receives no student name, contact/household/guardian/support data or persistent profile.
- No tools, browsing, code execution, external retrieval or write actions.
- Require and validate structured output.
- Citations must come from the exact authorized retrieval set; invalid/invented citations fail safely.
- If no adequate source exists: “I couldn’t find that in Rabbi Scheller’s approved class material. Try asking about this lesson, or send a private question.”
- If outside scope: “I can only help with Rabbi Scheller’s approved class material.”
- UI disclosure: “Class Helper answers from Rabbi Scheller’s approved class material.” Never present it as the Rabbi.

## No general memory/privacy

Each query is stateless beyond explicit lesson context and request-local retrieval. Do not persist chat transcripts, create learner profiles from questions, embed student messages, or store conversations in browser storage. Retain only minimized operational metadata without raw question/answer/provider payload/PII. A refresh clears the helper conversation.

Use safe, age-appropriate responses and never solicit personal contact/location/secrets/photos. For a message requiring adult support outside class-content scope, use a brief fixed response directing the learner to a parent/guardian or trusted adult; do not copy the raw message into routine notifications.

Default rate limits: 10 queries/learner/5 minutes and 60/day, plus existing account/IP controls. Render a strict safe text/Markdown subset with no raw HTML, remote images or arbitrary links.

## Private questions

- Show only to eligible learners with required relationship/consent.
- Explain that the question is not public but is visible to Rabbi Scheller and authorized One Time staff, with guardian visibility governed by account policy.
- Require preview of exact text and explicit confirmation.
- Reuse canonical private-question workflow; extend additively if needed with submitted, acknowledged, answered, closed and restricted-review states.
- AI cannot author/send the Rabbi’s reply.
- Notifications contain status and authenticated deep link, never question body.
- Encrypt/protect bodies with existing sensitive-data facilities and enforce the canonical retention policy.

## UI/provider architecture

Add a lesson-aware panel within the existing student portal: boundary disclosure, question/character count, loading, cited answer, no-source/out-of-scope, rate/provider/session/permission states, and explicit private-question review/confirm/status. It must work at 360×800, 390×844, tablet and desktop with keyboard/screen-reader support.

Use the canonical provider port and feature flags: disabled by default, deterministic sink for tests, live only later through OPS-04. Pin model/config through validated protected settings. Add bounded timeout/retry/circuit/cost metrics. Reuse existing repository-native approved-content search; do not add an external vector database.

## Collision boundary

Own newly added helper/private-question modules, task migration, helper UI/tests/evidence. Do not edit landing, activation/login/reset, billing, provider delivery, Telegram/BNA or global tokens. Put unavoidable central route/shell/env/package/lockfile changes in a final isolated `OT-107 integration seam` commit and list them for OPS-04.

## Verification

Test exact learner/relationship/entitlement scoping, sibling/cross-household/wrong-role/suspended denial, approved-source inclusion and draft/revoked exclusion, citation authorization, refusal/no-source behavior, prompt injection in queries/sources, no persistence/log leakage, provider failure/malformed output/invented citation, rates/idempotency, private-question visibility/confirmation/states, CSRF/XSS and mobile/a11y. Use fictional learners and synthetic Rabbi content only; no live provider or real minor data.

Run scoped checks, push and open a draft PR. Final report includes exact branch/SHA/PR, models reused, migration/checksum, source/authorization/privacy proof, test totals, provider status, OPS-04 seam, blockers and clean git state.

