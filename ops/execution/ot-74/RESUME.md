# Resume OT-74 Audience Reconciliation

You are resuming OT-74 for `webcraft-media/onetimev2`.

1. Open `C:\Users\User\OneTimeOneTime-ot74-audience-reconciliation`.
2. Verify repository identity and branch:

```powershell
git remote get-url origin
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected origin: `https://github.com/webcraft-media/onetimev2.git`.

Expected branch: `codex/ot74-audience-reconciliation`.

Expected base ancestry: this branch started from
`dfef7de2035e08f1ee72e0133ccf656fe7a74444`.

3. Read:

```text
AGENTS.md
ops/execution/PROTOCOL.md
ops/execution/ot-74/STATE.json
ops/execution/ot-74/REMAINING.md
ops/execution/ot-74/CHECKPOINT.md
ops/execution/ot-74/TEST-RESULTS.md
ops/execution/ot-74/INTEGRATION-MANIFEST.md
```

4. Continue at the first pending phase in `STATE.json`.
5. Do not modify or run BNA.
6. Do not deploy, import real spreadsheets, mutate production/provider systems,
   send messages, create charges, create real users, or connect to the
   production Rabbi database.
7. Keep OT74 feature-local and unmounted; OT80 owns central wiring.

## Current Resume Point

The implementation candidate is locally verified, pushed, and opened as draft
PR #22: `https://github.com/webcraft-media/onetimev2/pull/22`.

Before committing, rerun or inspect:

```powershell
npm run unit -- tests/unit/audience/audience-reconciliation.test.ts
npm run integration -- tests/integration/audience/audience-migration.test.ts
npm run typecheck
npm run secret:scan
```

OT80 wiring instructions are in `ops/execution/ot-74/INTEGRATION-MANIFEST.md`.
