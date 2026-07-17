# W12-04 Test Results

Final passing checks:

- `npm run integration -- tests/integration/content/ot110a-admin-content-workspace.test.ts`
  - Result: passed
  - Files: `1 passed`
  - Tests: `3 passed`
- `npm run typecheck`
  - Result: passed
- `npx prettier --check apps/web/src/client/app/content-workspace/ContentWorkspace.tsx apps/web/src/client/app/content-workspace/content-workspace.css packages/contracts/src/content/admin-workspace.ts packages/domain/src/content/admin-workspace.ts tests/integration/content/ot110a-admin-content-workspace.test.ts`
  - Result: passed
- `npm run brand:check`
  - Result: passed
  - Note: dist public bundle not present, build budgets skipped by script
- `npm run secret:scan`
  - Result: passed
  - Scope: `1180` repo text files
- `npm run lint`
  - Result: passed

Known baseline caveat:

- `npm run format` still fails for the repository-wide pre-existing formatting baseline (`835` files reported). The five W12-04 touched source/test files pass the targeted Prettier check after formatting.

Provider-off proof:

- The focused integration test seeds only fictional One Time fixture data.
- It signs local OT86 and OT86B fixture messages.
- It publishes approved knowledge locally.
- It generates four Buffer-ready social drafts without calling Buffer.
- It asserts the admin detail projection does not expose raw Vimeo player URLs, bearer tokens, or passwords.
