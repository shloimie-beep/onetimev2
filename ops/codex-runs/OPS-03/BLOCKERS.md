# OPS-03 Blockers

Current status: no terminal blocker recorded before staging redeploy.

## Resolved Incident

- During the first PG16 service attempt, one generated database credential was printed by an environment-inspection command.
- Remediation: the attempted service and volume were abandoned and deleted.
- Retained staging database: replacement service `ot99-pg16`, volume `ot99-pg16-volume`, with a separately generated password that was never printed or committed.
- No retained application service uses the abandoned credential.

## Watch Items

- Local Docker is not installed on this Windows host, so Docker build proof must come from Railway's remote Dockerfile deployment.
- Repository-wide `npm run format` is noisy on the starting SHA; branch-owned files pass Prettier. The OPS-03 run did not reformat unrelated baseline files.
