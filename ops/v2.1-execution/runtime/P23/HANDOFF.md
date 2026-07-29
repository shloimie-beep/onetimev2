# P23 Superseding Residual-Corrected Ready-for-Review Handoff

## Exact identity

- Branch: `codex/v21-p23-student-notifications`
- Reconciled residual claim:
  `433cc88b34d99099ca75f64876713406c6e43053`
- Reconciliation control:
  `3df02f221b14c937dd1b721013b5067245fb4493`
- Reconciliation acquisition parent:
  `4ca740bd8c2bbfcae7755038d88bdc616dd3444a`
- Residual-corrected implementation:
  `dafdd046b7048e67829b2f2a2496c8b830b23fec`
- Claim: `f7e3fb0e-a8d4-416b-8c79-786a696e2dc4`
- Released lease: `f7b63d5e-489c-40aa-a793-9a7210f91bca`
- Artifact digest:
  `d6a527d064c3289db0acb9f8482645e012bd0384990379b27644c55758a31dcc`
- Unchanged request aggregate:
  `f984e5ee374f4612bdc7e7f500791545acb7b98acef74703018a13b086596c4f`

## Residual-corrected result

Class change and cancellation actions now use canonical
`/app/student/calendar`. Notification actions accept only the exact canonical
static Student routes or the five approved class/library/question/support
patterns with one opaque safe identifier; arbitrary, nested, query, fragment,
traversal, provider, and malformed paths fail closed.

The controlled notification tabs now implement ArrowLeft/ArrowRight wrapping,
Home/End selection, default prevention, filter selection, and direct DOM focus
through the actual button refs. Keyboard focus remains on the selected tab
through the controlled rerender. Dependency evidence now truthfully distinguishes
exact task-head control bindings from the integration/interface heads that are
actual ancestors.

All prior concurrency, retention, privacy, sound, timezone, idempotency,
authorization, copy, and accessibility corrections remain intact. The two
structured requests are unchanged and unapplied. No migration, registration,
provider/send, or external effect occurred.

## Verification

- 3 focused files / 20 deterministic tests passed.
- Workspace TypeScript typecheck passed.
- Focused ESLint and Prettier passed.
- Exact residual owned-path scope and `git diff --check` passed.
- Secret scan passed across 2876 repository text files.
- Exact 13-artifact digest and unchanged two-request aggregate reproduced.
- Sole writer lease released at `2026-07-29T08:54:00Z`, before expiry.

Next action: C00 should review or integrate the superseding final after exact
remote-head, sole-parent, scope, digest, and effects verification.
