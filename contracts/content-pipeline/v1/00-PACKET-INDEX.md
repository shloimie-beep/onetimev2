# OT-86A packet index and authority

Read in this order:

1. `CODEX-PROMPT.md`
2. `01-BRANCH-WORKTREE-RESUMABILITY.md`
3. `02-OWNED-FILE-ROOTS-AND-MIGRATIONS.md`
4. `03-CONTENT-LIFECYCLE-CONTRACT.md`
5. `04-CONTENT-PUBLISH-MANIFEST.schema.json`
6. `05-APPROVED-FOR-SOCIAL-EVENT.schema.json`
7. `06-PUBLISH-HANDOFF-CONTRACT.md`
8. `07-VIMEO-PROVIDER-CONTRACT.md`
9. `08-KB-RETRIEVAL-CONTRACT.md`
10. `09-SECURITY-PRIVACY-NEGATIVE-TESTS.md`
11. `10-PERFORMANCE-BUNDLE-BOUNDARIES.md`
12. `11-ACCEPTANCE-CHECKLIST.md`
13. `12-REQUIRED-REPORTS.md`
14. `fixtures/`

The Markdown contracts define behavior; the JSON Schemas define wire shape. When prose and schema appear inconsistent, implement the stricter interpretation and record the discrepancy in `ops/codex-runs/OT-86A/CONTRACT-VALIDATION.md` rather than silently changing either contract.

Repository-native naming may differ, but every invariant, state, audit field, privacy restriction, idempotency rule, and acceptance gate must remain observable in code and tests.
