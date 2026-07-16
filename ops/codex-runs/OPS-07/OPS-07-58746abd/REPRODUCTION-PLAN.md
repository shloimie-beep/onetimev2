# OPS-07 Reproduction Plan

This plan is reusable for OT-99. It is not executed as a final pass until `BASE-RESOLUTION.json` classifies a candidate as `FULLY_INTEGRATED`.

## 1. Candidate Discipline

- Fetch and resolve the exact OT-99 integration SHA.
- Verify every release-scoped lane by `git merge-base --is-ancestor`.
- Refuse newest-branch, newest-PR, or timestamp-only selection.
- Create the corrective branch only from the selected full SHA.

## 2. Authorization And Learner Privacy

- Mount HTTP, service, and repository/SQL tests for all `OPS-07-AUTHZ-*` cases.
- Use two accounts, two products per account, two households, three learners in one household, sibling learners, support-only guardian, revoked guardian, disabled member, archived/deleted/suppressed contacts, and conflicting identity rows.
- Assert status/body shape, timing bounds, row counts, audit rows, outbox rows, and no prohibited data.

## 3. Session And Request Integrity

- Exercise MFA, recovery, recent step-up, security-version, session-family rotation, CSRF, safe return routes, private no-store, rate limits, idempotency, optimistic concurrency, and durable redacted audit.
- Run multi-process and disposable PostgreSQL race tests.

## 4. Provider Webhook Fixtures

- Use local raw-byte fixtures only.
- Stub all provider network access so real provider calls fail the test.
- Cover Stripe TEST, Telegram, WhatsApp, Vimeo/content, Zoom, support bridge, and social publishing.

## 5. Injection And KB Safety

- Run direct, indirect retrieval, tool-output, encoded, Unicode/bidi, multi-turn, cross-learner, source-fabrication, system-prompt, secret-exfiltration, and unrestricted-network prompts.
- Inspect tool calls and retrieval filters, not only final text.

## 6. Provider-Link And Private-Data Leakage

- Seed canaries for session/CSRF/MFA/recovery/provider secrets, raw provider URLs/passcodes, contact values, learner free text, and private content.
- Scan source, database fixtures, stdout/stderr, logs, traces, metrics, analytics fixtures, screenshots metadata, browser storage, requested URLs, response headers, support exports, built bundles, and OPS evidence artifacts.

## 7. Negative Matrix

- Execute all 267 `OPS-07-NEG-*` cases.
- Any omitted case becomes an explicit finding with owner, severity, and blocker.
- Missing credentials or provider resources are `BLOCKED_ENVIRONMENTAL`, never `PASS`.
