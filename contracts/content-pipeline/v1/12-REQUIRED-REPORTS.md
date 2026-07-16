# Exact OT-86A run reports

Create these files under `ops/codex-runs/OT-86A/`. Each Markdown report begins with packet id, branch, base SHA, head SHA when available, and UTC generated time. Commands are copied exactly with exit code; redact secrets and private payloads.

1. `RUN.json` — atomic run ledger defined in the worktree contract.
2. `DISCOVERY.md` — repository layout evidence; BNA/One Time boundaries; existing auth, queue, storage, search, audit, test, and deployment conventions; chosen implementation path.
3. `OWNED-ROOTS.json` — exact machine-readable changed-path allowlist.
4. `IMPLEMENTATION.md` — changed components mapped to workflow stages; state-machine location; provider seams; UI/readiness behavior; known external dependencies.
5. `DATA-MODEL.md` — tables/entities, keys, constraints, indexes, retention, immutable-version enforcement, and BNA versus One Time ownership.
6. `MIGRATIONS.md` — migration ids, additive proof, empty/upgrade validation commands, durations, row effects, and rollback/disable strategy.
7. `CONTRACT-VALIDATION.md` — runtime schema locations, fixture matrix, signature/checksum implementation, compatibility/versioning decision, and valid/invalid results.
8. `TESTS.md` — every test/lint/typecheck/build command, exit code, concise result, failures fixed, and deliberately skipped external tests with reason.
9. `SECURITY-PRIVACY.md` — mapping of A-NEG-001 through A-NEG-030 to tests/evidence; authz, isolation, injection, privacy, secret-scan, and audit findings.
10. `PERFORMANCE.md` — dataset size, tool/environment, commands, p50/p95/max, query-plan evidence, bundle deltas, and pass/fail against each boundary.
11. `VIMEO-READINESS.md` — safe readiness states, adapter capabilities, webhook/poller coverage, canary command results, missing capability classes, and manual-reference behavior. Never include secret values.
12. `PR.md` — exact pull-request body containing summary, architecture boundary, migrations, test evidence, privacy/security evidence, performance evidence, rollout/rollback, Vimeo checkpoint, and follow-up operations. It must not claim live provider success without a successful canary.
13. `CHECKPOINT` — present only when an external readiness checkpoint applies; content is exactly `READY_FOR_VIMEO_CANARY` followed by a newline.

`RUN.json` must list the SHA-256 of every report so post-run evidence changes are detectable. A report that says only “passed” without commands/evidence does not satisfy acceptance.
