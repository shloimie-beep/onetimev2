# Current-to-legacy package reconciliation

PR #133 at exact head `ff8aed26c6a21bf525d18a493e163a2af1288ad5` is historical evidence. Its package numbers must not be imported literally because current PR #183 assigns those same numbers to different hooks.

| Legacy PR #133 identity | Legacy hook                             | Current PR #183 canonical identity           | Treatment                                                                                                      |
| ----------------------- | --------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| historical `OTM-CP-001` | What if he looked forward to Mishnayos? | `OTM-CP-003` Look Forward to Mishnayos       | Preserve 9 legacy statics and package evidence; do not recreate or relabel without a separate import decision. |
| historical `OTM-CP-002` | A real rebbe changes the screen.        | `OTM-CP-004` A Real Rebbe Changes the Screen | Preserve 9 legacy statics and package evidence; do not recreate or relabel without a separate import decision. |
| historical `OTM-CP-003` | One perek. One clear accomplishment.    | `OTM-CP-005` One Perek. One Accomplishment.  | Preserve 9 legacy statics and package evidence; do not recreate or relabel without a separate import decision. |

Legacy Drive evidence remains immutable:

- 27 existing static derivatives total, nine per package;
- 20 clean clips per package;
- visible CTA remains the intentionally blocked placeholder `CTA — VERIFY BEFORE EXPORT`;
- original Drive files moved/renamed/modified/deleted: zero.

This packet therefore creates only current `OTM-CP-001` and `OTM-CP-002`. It does not merge PR #133 wholesale, write to its Drive folders, replay any provider effect, or claim the legacy outputs are current final creatives.
