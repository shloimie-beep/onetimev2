# W12-99 — Final semantic convergence, staging, import preview, and canary gate

## Hard entry condition

Run only after the active release/production operation is complete and every desired W12 lane has a pushed draft PR with durable final/checkpoint artifacts. If not, do not create an integration branch; report exact missing PRs/artifacts.

## Outcome

Build one coherent candidate from the exact accepted release source. Manually reconcile W12 branches, verify real journeys, deploy one exact SHA to isolated staging, preview the real audience import, and run only explicitly authorized bounded canaries.

## Source and worktree

Target `webcraft-media/onetimev2`. Dynamically resolve the exact current production source SHA, current rollback deployment, and latest accepted release commit. Never use a placeholder or assume PR numbering. Create a clean external integration worktree/branch `integration/w12-final-convergence-<UTC timestamp>`.

## Integration order

1. W12-00 handoff.
2. W12-07 landing.
3. W12-08 admin/dashboard/classroom.
4. W12-01 contact/tag/import schema and tooling.
5. W12-02 communications/history.
6. W12-03 portal identities/test lab.
7. W12-04 content/Vimeo/classroom/portal links.
8. W12-05 Telegram.
9. W12-06 WhatsApp and landing launcher contract.

Do not blindly merge. Review each diff and final report. Reconcile shared server composition, root exports, navigation, brand tokens, package/lockfiles, migration numbering/checksums/ledger, capability registry, worker composition, and CI. Preserve newer security/privacy fixes. Record every conflict and decision.

## Verification

- Full install/format/lint/typecheck/unit/integration/build.
- Disposable PostgreSQL from zero plus upgrade, concurrency, 10k CRM/query, backup/restore, rollback.
- Browser journeys for anonymous signup, owner/admin login, CRM/import preview, communications, dashboard/classroom/content, parent, student, support.
- 360/390/768/1440 visual, a11y, reduced motion, 200% zoom, no overflow.
- privacy/cache/PII-in-URL/log/evidence, role/cross-account/sibling isolation, session and rate-limit tests.
- bundle/request/LCP/CLS/usable-action budgets and provider-off resilience.
- secret scan and raw-data scan.

Deploy the exact green candidate to isolated staging only. Verify `/health`, `/ready`, `/version`, rollback, worker, and full journeys. Update `ops/director/**` to the candidate truth.

## Real audience gate

Run W12-01 in counts-only dry-run against the explicitly selected real sources. Produce source hashes, totals, create/update/no-op/conflict/suppression counts, tag counts, and rollback plan—no row values. Do not apply until the operator explicitly approves that exact manifest hash and counts. If approved in a later instruction, bounded apply must be idempotent and followed by reconciliation.

## Provider canary gate

No broad sends or live publication. A provider canary runs only when protected credentials already exist, repository evidence names the authorization, target is allowlisted, budget is one/few specified actions, and rollback is clear. Otherwise mark canary pending while keeping the candidate usable/provider-off.

## Durability/publication

Maintain `ops/codex-runs/W12-99/ORIGINAL-PROMPT.md`, `STATE.json`, `RESUME.md`, `FINAL-REPORT.md`, `CONFLICT-LEDGER.md`, `CAPABILITY-MATRIX.json`, `IMPORT-PREVIEW.json`, `CANARY-REPORT.json`, `CHANGED-FILES.txt`, and rollback docs. Commit, push, open draft PR. Do not promote production without a separate explicit authorization after staging evidence.

