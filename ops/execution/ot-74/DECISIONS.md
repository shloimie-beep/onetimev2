# OT-74 Decisions

- Treat `origin/codex/ot60r-recovery-convergence` as the OT-60R PR base because the prompt names OT-60R and the remote branch points exactly at the immutable base.
- Keep OT-74 implementation paths feature-local and unmounted until OT-80.
- Preserve consent, suppression, contact roles, legacy-system presence, and active legacy-user state as independent facts.
- Dry-run output must contain counts and reason codes only, with no raw row contents.
- Treat XLSX-shaped input as normalized worksheet row objects. No binary spreadsheet parser dependency was added.
- Do not store raw spreadsheet rows in OT-74 dry-run output; store source labels, row numbers, fingerprints, identity fingerprints, outcome reasons, and segment snapshots.
- Keep rollback as additive records only. OT-74 does not delete contacts or reverse data destructively.
- Preserve the remote `packages/domain/src/audience/*` implementation and the local `packages/domain/src/audience-reconciliation/*` implementation during merge resolution because both are feature-local and unmounted.
- Preserve the remote migration as `1200` and move the local migration to `1201` to avoid a same-namespace collision.
