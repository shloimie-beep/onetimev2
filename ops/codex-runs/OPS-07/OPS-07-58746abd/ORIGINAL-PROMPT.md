# OPS-07 — Codex execution prompt

You are the principal application-security, learner-privacy, and authorization engineer for `webcraft-media/onetimev2`. Execute this packet against the current integrated One Time candidate. The packet ID is `OPS-07-58746abd`.

## Absolute boundaries

- Perform candidate and prior-finding audit read-only before source edits.
- Do not access production, use real users, exploit external services, send messages, create charges, deploy, alter DNS/Railway/provider configuration, or mutate any external provider.
- Do not treat missing credentials, unavailable providers, absent PostgreSQL, or skipped browser execution as security success.
- Do not weaken or remove product functionality merely to pass a test.
- Do not wholesale merge superseded OT-34/OT-38 migrations or models.
- Use synthetic fixtures, disposable PostgreSQL, local mock providers, and blocked outbound networking.

## Phase 0 — Verify packet and persist state before edits

1. Verify `OPS-07-CHECKSUMS.sha256`.
2. Copy this prompt verbatim to `ops/codex-runs/OPS-07/OPS-07-58746abd/ORIGINAL-PROMPT.md`.
3. Create and validate `STATE.json` using `OPS-07-EXECUTION-STATE-SCHEMA.json`.
4. Record `CHECKPOINT.md`, `DECISIONS.md`, and zero-valued `EXTERNAL-MUTATIONS.json`.
5. Confirm a clean repository and no production credentials. Record environment variable names/status only, never values.
6. Run `OPS-07-CANDIDATE-RESOLUTION.md`. Do not create a corrective branch until a `FULLY_INTEGRATED` candidate and exact SHA are recorded.

## Phase 1 — Read-only implementation and history audit

- Read `AGENTS.md`, repository execution protocol, canonical-candidate control files, migrations, package composition, route registration, worker entrypoints, and security/privacy evidence.
- Audit OT-24, OT-26, OT-34, and OT-38 behavior using `OPS-07-READONLY-AUDIT-BASELINE.md`.
- Trace every private operation route → actor/session resolver → capability/membership service → domain service → repository query → audit/outbox.
- Inventory all D2-D6 data stores and sinks: database, caches, object storage, logs, metrics, traces, analytics, browser storage, screenshots, support exports, evidence, and provider payloads.
- Write a reproduction plan and preliminary severity report before changing code.

## Phase 2 — Reproduce, do not infer

Run every relevant case in `OPS-07-AUTHORIZATION-MATRIX.md` and all 267 cases in `OPS-07-NEGATIVE-TEST-MATRIX.md`. Begin with the nine preliminary candidate findings. A source pattern may establish a hypothesis; only mounted route/service/repository/PostgreSQL/browser evidence establishes impact and final severity.

Use privacy-safe responses and prove zero side effects on every deny path. Capture exact candidate SHA, commands, exit codes, transaction outcomes, row-count invariants, and artifact hashes using `OPS-07-EVIDENCE-SCHEMA.json`.

## Phase 3 — Implement scoped compatible fixes

For each confirmed finding:

1. Identify the canonical current data/session/provider model and root cause.
2. Apply the smallest complete fix that preserves product capability.
3. Enforce account/product/real-membership/role/household/guardian/learner scope at route, service, and SQL layers.
4. Make student resolution exactly-one and fail closed; never accept a learner subject from request data.
5. Keep parent setup/reset/suspend/restore/revoke as lifecycle operations only; never retrieve or mint an impersonation credential for a parent.
6. Require recent privileged step-up for factor/recovery changes; rotate/revoke affected session families and make recovery replay-safe.
7. Require explicit CSRF proof, secure cookie attributes, private no-store, safe non-looping return routes, durable rate limits, request-hash idempotency, optimistic concurrency, and redacted durable audit.
8. Restore signed/versioned/expiring CRM cursor context binding; active same-scope assignee membership; no-consent manual contact defaults; explicit duplicate/archive/deletion identity policies.
9. Authenticate raw provider ingress with the strongest provider-supported mechanism plus application freshness/dedupe controls. Do not invent a provider signature that the implemented provider does not support; fail closed or use an authenticated internal bridge where necessary.
10. Keep raw provider links/passcodes/tokens, secrets, contact values, learner free text, and private questions out of logs, analytics, audits, browser storage, screenshots, evidence, and support exports.
11. Validate attachments/content before storage/indexing; enforce archive/path/size/type/parser/SSRF defenses.
12. Keep helper/model tools allowlisted and actor-scoped. Authorize before retrieval, use approved Rabbi content only, cite only authorized source records, and abstain instead of inventing external sourcing.
13. Implement or repair consent/version, suppression, retention, deletion, and export seams without false-success states.
14. Preserve CSP/security headers, safe error handling, dependency hygiene, and secret scanning.

Add migrations only when constraints/indexes/state are needed. Migrations must be compatible with the selected candidate and include fresh/upgrade/checksum/idempotency/rollback evidence.

## Phase 4 — Assurance

- Run unit, integration, disposable PostgreSQL concurrency/isolation, and browser role tests.
- Run local raw-byte provider fixtures for Stripe TEST, Telegram, WhatsApp, Vimeo/content, Zoom, support bridge, and social publishing.
- Run attachment/archive/SSRF and prompt/tool-injection corpora with no outbound network.
- Run prohibited-data canary scans across every sink.
- Run CSP/header, dependency/SBOM, git-history/build secret, typecheck, lint, format, build, accessibility, and existing regression suites.
- Rerun every reproduced exploit/negative case and prove it now fails safely.

## Phase 5 — Report and publish corrective branch

1. Validate every evidence and finding record against the packet schemas.
2. Evaluate all gates in `OPS-07-REMEDIATION-GATES.md`.
3. Generate `SEVERITY-OWNER-DISPOSITION.json` with no unowned finding and no automated S0/S1 risk acceptance.
4. Generate a concise `FINAL-REPORT.md` listing exact base/corrective SHAs, changed files, migrations, tests, blockers, residual risk, and zero external mutations.
5. Commit only OPS-07-scoped fixes/evidence on `codex/ops-07-security-privacy-corrective-58746abd` and push it if authorized by the normal repository workflow.
6. Open a draft pull request using `OPS-07-CORRECTIVE-PR-CONTRACT.md`. Do not merge or deploy.

Final run status may be `READY_FOR_SECURITY_REVIEW` only when the candidate is fully integrated, every S0/S1 finding is fixed or has explicit human approval, all mandatory local tests pass, and any unavailable external canary remains clearly `BLOCKED_ENVIRONMENTAL` rather than passed.
