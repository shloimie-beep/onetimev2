# W12-01 — CRM audience inventory, tagging, and safe import

## Outcome

Make the Rabbi’s real audience importable into One Time without duplicates, cross-product contamination, lost consent, or unverifiable tags. This lane builds inventory, dry-run, reconciliation, rollback, APIs, and usable preview. It does not apply a real bulk import.

## Deterministic base

Target `webcraft-media/onetimev2`. Fetch remotes and select the current accepted release source using PR #61 and newest release/OPS evidence. If a newer accepted production source exists, use it; otherwise use current PR #61 head. Record the exact choice. Create a clean external worktree/branch `codex/w12-01-crm-audience-import`.

## Source discovery

Read current CRM/audience/import/tag/contact/household/member/subscription code and prior OT-74/OT-111 evidence. Inventory likely One Time spreadsheets and exports in `C:\Users\User\Downloads` and other explicitly referenced legacy export directories. Do not copy raw files into the repo. Commit only sanitized filenames, SHA-256 hashes, byte sizes, sheet names, column names, row counts, source classification, and warnings. Never record row values, private message text, phone/email values, tokens, or passwords.

Classify sources as proven One Time, mixed/needs review, unrelated, or duplicate. Never assume every spreadsheet belongs to the Rabbi.

## Canonical data and tags

Preserve separate concepts: contact/person, household, guardian, learner, school lead, lead, member/subscriber, legacy-system presence, current activation, enrollment, consent, suppression, source/provenance, campaign eligibility. Implement a governed taxonomy including equivalent semantic support for:

- family lead;
- school lead;
- legacy-system contact;
- active legacy user;
- current One Time member/subscriber;
- parent/guardian;
- learner;
- import source/date/batch;
- do-not-send/suppressed/bounced/invalid;
- campaign candidate, without conflating it with membership.

Use normalized email/phone identity carefully, preserve raw input only in protected import storage, and create deterministic conflict/manual-review outcomes for ambiguous household/contact matches.

## Deliverables

Implement:

1. source inventory and mapping manifest;
2. idempotent streaming parser for CSV/XLSX as appropriate;
3. validation/normalization/deduplication engine;
4. counts-only dry-run report by source/action/tag/conflict/suppression;
5. conflict queue with reason codes and operator decisions;
6. import-batch provenance, reversible change ledger, and rollback tooling;
7. permission-scoped admin preview/API and CRM tag visibility;
8. synthetic fixture and disposable-PostgreSQL proof at representative volume;
9. no-PII evidence and negative tests for repeated imports, mixed sources, malformed records, consent conflicts, cross-account rows, and rollback.

The real apply command must require an exact manifest hash, exact counts, explicit operator authorization, and a non-production/prod target declaration. Default is dry-run.

## Continuity/no-stop rule

Save `ORIGINAL-PROMPT.md`, `STATE.json`, `RESUME.md`, `FINAL-REPORT.md`, `CHANGED-FILES.txt`, and `HOTSPOTS.json` under `ops/codex-runs/W12-01/`. Missing provider access or unknown column semantics must create a review classification, not stop the whole lane. Finish safe code/tests with fixtures.

## Safety/completion

No real data apply, no sends, no provider mutation, no production DB read, no spreadsheet/PII in Git, no deploy. Use task-owned files when possible; document shared hotspots. Run focused and repo-relevant tests, formatting, secret scan, privacy scan, and PostgreSQL proof. Commit, push, and open a draft PR.

