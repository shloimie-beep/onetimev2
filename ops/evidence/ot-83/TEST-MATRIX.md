# OT-83 Test Matrix

| Area | Command | Result | Notes |
|---|---|---|---|
| Dependency install | `npm install` | Passed | 349 packages, 0 vulnerabilities |
| TypeScript | `npm run typecheck` | Passed | Full configured typecheck |
| Lint | `npm run lint` | Passed | Full repo lint |
| Secret scan | `npm run secret:scan` | Passed | Workflow URL was fixed after initial scanner rejection |
| Brand guard | `npm run brand:check` | Passed | Script noted dist budgets skipped when dist absent |
| Build | `npm run build` | Passed | Public and app bundles built |
| Portal services | `npx vitest run tests/ot-52/portal-services.test.ts` | Passed | Includes `revoke_sessions` operation recording |
| Account lifecycle + mounted portals | `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/account-lifecycle.test.ts tests/integration/portals/portal-mount.test.ts` | Passed | Proves revoke invalidates student session while preserving access |
| OT83 real PostgreSQL | `npx tsx tests/ot-83/real-postgres-concurrency.ts` | Blocked locally | No explicit safe PG target; CI workflow added |
| Formatting | `npx prettier --check <touched TS/TSX/YML files>` | Passed | SQL excluded because repo Prettier has no SQL parser |
| Whitespace | `git diff --check` | Passed | CRLF warnings only |
