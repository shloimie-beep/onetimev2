# Next Full Production Release

Status: not deployed and not authorized.

## Candidate

- Repository: `shloimie-beep/onetimev2`
- Staging branch: `codex/full-app-staging-live`
- Verified application head: `68b4d075c85f4023177b9363e04e23763f01d4f5`
- Persistent staging: `https://ot99-web-staging.up.railway.app`
- Latest staging migration: `2213_learning_delivery_autotrim_transcripts`

The candidate includes the Tisha B'Av funnel, HighLevel reconciliation assets,
Vimeo autotrim/transcription, and the Rabbi Live Console. The current production
runtime contains only the narrow Tisha B'Av release through migration `2211`.

## Required Gates

1. Decide whether the unique PR #104 Vimeo content factory and PR #105 real Zoom
   host controls belong in the full release candidate.
2. Rebase the final candidate onto the canonical production base without pulling
   unrelated branches.
3. Run a fresh PostgreSQL 18 dump/restore rehearsal and verify migrations
   `2212` and `2213` against the restored production snapshot.
4. Reconcile protected production variables by name and presence without printing
   values.
5. Run build, typecheck, lint, unit, integration, end-to-end, secret scan, and
   authenticated Admin/Parent/Student acceptance.
6. Obtain explicit operator authorization for the full application production
   deployment.

No broad message, campaign send, charge, or real Student-data operation is part
of this release packet.
