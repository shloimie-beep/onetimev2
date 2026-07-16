# OT-86B packet index and authority

Read in this order:

1. `CODEX-PROMPT.md`
2. `01-BRANCH-WORKTREE-RESUMABILITY.md`
3. `02-OWNED-FILE-ROOTS-AND-MIGRATIONS.md`
4. `03-SOCIAL-EVENT-CONSUMER-CONTRACT.md`
5. `04-SOCIAL-WORKFLOW-CONTRACT.md`
6. `05-SOCIAL-DRAFT.schema.json`
7. `06-BUFFER-PUBLISH-COMMAND.schema.json`
8. `07-BUFFER-ADAPTER-CONTRACT.md`
9. `08-APPROVAL-AUDIT-RETRACT-CONTRACT.md`
10. `09-SECURITY-PRIVACY-NEGATIVE-TESTS.md`
11. `10-PERFORMANCE-BUNDLE-BOUNDARIES.md`
12. `11-ACCEPTANCE-CHECKLIST.md`
13. `12-REQUIRED-REPORTS.md`
14. `fixtures/`

OT-86A's actual remote contract is authoritative for `content.approved_for_social`. This packet's fixture is a consumer conformance copy and may not be used to silently fork OT-86A. When a difference exists, preserve OT-86A compatibility, implement the stricter privacy interpretation, and document the comparison in `CONTRACT-VALIDATION.md`.
