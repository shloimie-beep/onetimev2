# W12-04 Content Vimeo Classroom Vertical Slice

## Summary

- Adds a typed `vertical_slice` projection to the admin Content source detail contract.
- Projects the One Time provider-off path from private source/reference through transcript, review outputs, approved knowledge, classroom/library eligibility, and Buffer draft handoff.
- Adds a Content workspace detail panel for classroom state, provider setup, content flow, and social handoff.
- Adds a deterministic W12-04 integration fixture using fictional data only: no real Vimeo provider access, no Buffer live publish, and no production publication.
- Preserves W12-04 archive validation, run state, hotspots, and test evidence under `ops/codex-runs/W12-04/`.

## Verification

- `npm run integration -- tests/integration/content/ot110a-admin-content-workspace.test.ts`
- `npm run typecheck`
- `npx prettier --check apps/web/src/client/app/content-workspace/ContentWorkspace.tsx apps/web/src/client/app/content-workspace/content-workspace.css packages/contracts/src/content/admin-workspace.ts packages/domain/src/content/admin-workspace.ts tests/integration/content/ot110a-admin-content-workspace.test.ts ops/codex-runs/W12-04/ORIGINAL-PROMPT.md ops/codex-runs/W12-04/ARCHIVE-VALIDATION.md ops/codex-runs/W12-04/START-HERE.md ops/codex-runs/W12-04/HOTSPOTS.json ops/codex-runs/W12-04/TEST-RESULTS.md ops/codex-runs/W12-04/STATE.json ops/codex-runs/W12-04/RESUME.md`
- `npm run brand:check`
- `npm run secret:scan`
- `npm run lint`

## Notes

- Provider credentials were unavailable, so this completes the provider-off implementation path with deterministic fixture proof.
- No production deploy, production publication, Vimeo mutation, Buffer live publish, broad provider read, or secret commit was performed.
- Repository-wide `npm run format` still reports a pre-existing broad formatting baseline; the W12-04 touched files pass targeted Prettier checks.
