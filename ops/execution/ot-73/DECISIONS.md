# OT-73 Decisions

## DEC-OT73-001: Shared barrel preserved

The prompt forbids editing shared barrels. `packages/domain/src/index.ts` still exports `campaignTicker` and `campaign` from the pre-existing public domain surface. The corrected addendum restores `campaignTicker()` behavior through the existing export without changing the barrel.

## DEC-OT73-002: Corrected addendum supersedes ticker removal

The first OT-73 prompt said to remove the campaign ticker. The corrected landing addendum is newer and explicitly restores the moving free-until-Rosh-Hashanah countdown ticker. No reset or discard was performed; the dirty OT-73 worktree was patched forward.

## DEC-OT73-003: Login route

The canonical `/login` route is already a functional auth page in `apps/web/src/server/app.ts`, so `Member Login` remains a plain white link to `/login`. No holding-page seam was needed.

## DEC-OT73-004: DM Serif Display font provenance

OT-73 self-hosts the Latin WOFF2 delivered by Google Fonts and stores the SIL Open Font License text alongside it. The runtime CSS points only to the local asset; there is no third-party runtime font request.
