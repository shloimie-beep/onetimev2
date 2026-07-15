# Resume OT-80

Use this repository state, not the original chat, to continue.

## Worktree

```powershell
cd "C:\Users\User\OneTimeOneTime-ot80-one-shot-final-convergence"
git status --short
git branch --show-current
```

Expected branch: `codex/ot80-one-shot-final-convergence`.

## Current State

- Phase: `phase1_source_lane_integration`
- Candidate status: `NOT_READY`
- Accepted base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Latest local head: `d3f60f76c15cc5c148c634bea1b6ff1066be72b4`
- Integrated so far: OT-71 product core
- Source heads: `ops/execution/ot-80/SOURCE-HEADS.json`
- Immutable prompt: `ops/execution/ot-80/ORIGINAL-PROMPT.md`
- Input manifest: `ops/execution/ot-80/INPUT-MANIFEST.json`
- Communications decisions:
  `ops/execution/ot-80/COMMUNICATIONS-INTEGRATION-DECISIONS.md`
- Communications archive:
  `ops/execution/ot-80/audit-inputs/OT-DAYONE-COMMUNICATIONS-COPY-PACK.zip`

## Next Commands

After the OT-71 checkpoint is committed and pushed, continue Phase 1 with
OT-74:

```powershell
git fetch origin --prune
git merge --no-ff origin/codex/ot74-audience-reconciliation
```

If conflicts occur, resolve them deliberately and update:

- `ops/execution/ot-80/CONFLICT-LEDGER.md`
- `ops/execution/ot-80/MIGRATION-LEDGER.json`
- `ops/execution/ot-80/IMPLEMENTED.md`
- `ops/execution/ot-80/REMAINING.md`
- `ops/execution/ot-80/TEST-RESULTS.md`
- `ops/execution/ot-80/RESUME.md`

Then run focused checks relevant to the integrated lane before committing and
pushing the next checkpoint.

## Guardrails

Do not merge to `main`, do not use BNA product code, do not touch production or
root DNS, do not send to real audiences, do not run live Stripe charges, and do
not mutate real legacy contacts. Isolated staging is only allowed after the
candidate gates described in `ORIGINAL-PROMPT.md`.
