# OPS-11 Staging Rollback

Status: `passed_with_railway_down_caveat`

Staging rollback and roll-forward were rehearsed against current deployment
history.

## Candidate Before Rehearsal

- Candidate source SHA:
  `1197673fa409bfc4c649c2683f782e86775caa5e`
- Staging version: `ops11-1197673`
- Staging web service: `ot99-web`
- Staging worker service: `ot99-worker`
- Candidate web deployment:
  `e91cedcb-00fe-4f4c-86fe-3f2e41aed0b0`
- Candidate web digest:
  `sha256:30285f6adce25a03c2305d6bede808e95e97e96f057fdedd592f338958250d4f`
- Candidate worker deployment:
  `f672ec47-493f-4492-81af-f861318568c4`
- Candidate worker digest:
  `sha256:cbd8a55e41bab2229ec5603efcba2262a91c8be773ffb176520db3a43b220a72`

## Railway Down Caveat

`railway down` on staging web/worker removed the latest deployments but did not
reactivate previous deployments. Staging returned Railway 404 until rolled
forward. This was recorded as a failed rollback primitive and was not used as
the production rollback plan.

## Source Rebuild Rollback Proof

Rollback was then rehearsed by deploying the known staged application source
`d13e9cd3117091e97ef973408d8742a13d1a9479` from a detached worktree.

- Rollback version: `ops10-d13e9cd`
- Rollback web deployment:
  `536e4a57-b1ea-42b8-9a97-44f08a735606`
- Rollback web digest:
  `sha256:bc5d91db5cd2010a8e9c5d340a94836816f143039b9685e23f8256673a2de413`
- Rollback worker deployment:
  `08dc4a1f-5c3a-4f26-9886-4ca2764b569f`
- Rollback worker digest:
  `sha256:fcbc376c0f0c117d80e9b71143d661f611a0b7c18e0efc2cd9afd77cb4d7ee1c`
- Rollback smokes passed: `/health`, `/ready`, `/version`, `/login`
- `/version` reported exact SHA
  `d13e9cd3117091e97ef973408d8742a13d1a9479`

## Final Roll-Forward

Staging was rolled forward again to source
`1197673fa409bfc4c649c2683f782e86775caa5e`.

- Final web deployment:
  `6e3b45dc-761c-4f4b-a844-f8e4c7aabe6a`
- Final web digest:
  `sha256:30285f6adce25a03c2305d6bede808e95e97e96f057fdedd592f338958250d4f`
- Final worker deployment:
  `914c18f8-4f59-4234-930a-932dd89790c4`
- Final worker digest:
  `sha256:cbd8a55e41bab2229ec5603efcba2262a91c8be773ffb176520db3a43b220a72`
- Final smokes passed: `/health`, `/ready`, `/version`, `/login`,
  `/forgot-password`, `/activate`, `/reset-password`
- `/version` reported `ops11-1197673` and exact SHA
  `1197673fa409bfc4c649c2683f782e86775caa5e`
