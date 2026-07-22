# Zoom Meeting SDK credential incident

- Containment completed: `2026-07-22T09:57:14.9878373Z`
- Scope: the Development client secret of the admin-managed Zoom General app used only by Railway PR environment `onetimev2-pr-105`.
- Production impact: none.
- Persistent staging impact: none.

## Incident

During provider-console verification, the Zoom Marketplace page unexpectedly rendered the then-current Meeting SDK client secret in browser-automation output. SDK joins were stopped immediately. No Zoom meeting, customer, production system, or persistent staging configuration was changed during containment.

## Rotation and invalidation

The secret was regenerated in Zoom Marketplace before testing resumed. The provider's regeneration confirmation explicitly stated that the previous secret no longer works, and the newly copied value was confirmed to differ from the invalidated value without emitting either value or a fragment. Only `ZOOM_MEETING_SDK_CLIENT_SECRET` on the isolated PR #105 web service was updated. Railway redeployed the PR environment, after which both `/ready` and `/health` returned HTTP 200.

The replacement secret moved through Zoom's native **Copy** control and the protected Railway variable editor. It was not read back from the provider DOM, printed, committed, attached to the PR, or stored in a screenshot or run artifact.

## Cleanup and audit

- Checked the Git diff and untracked-file list; no credential-bearing change or incidental artifact was present before this incident record was added.
- Ran the repository secret scanner successfully across 1,783 text files.
- Checked task-local screenshots, run artifacts, and controlled terminal outputs. No incident screenshot was created, and no credential value or recognizable fragment was persisted.
- Inspected PR #105's body, discussion comments, and review threads through the connected GitHub view. No SDK secret, token, private URL, or recognizable credential fragment was present.
- Cleared transient operating-system and browser clipboards and discarded in-memory copies after the protected Railway update.
- The original automation output cannot be retroactively altered. Its credential is contained because provider-side regeneration invalidated it before any testing resumed.

## Migration convergence

PR #105 adds no migration. Its base's historical Zoom migration is byte-identical to persistent staging's applied `2212_rabbi_live_console_zoom_obs` ledger entry. This branch must integrate application changes only and must not reintroduce or rename the historical `2210` Zoom migration.
