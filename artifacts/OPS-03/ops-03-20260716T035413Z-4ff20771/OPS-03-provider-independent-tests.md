# OPS-03 Provider-Independent Tests

Commands recorded as passed before this artifact was generated:

- npm run typecheck PASS
- npm run lint PASS
- npm run unit PASS 101 tests
- npm run integration PASS 57 tests
- OPS-03 schema validation PASS
- npm run secret:scan PASS 348 files

Check matrix:

| Check | Outcome | Summary |
| --- | --- | --- |
| OPS-03-G01-STATE-FIRST | passed | Private state was persisted before conductor artifact generation. |
| OPS-03-G02-EXACT-COMMIT | passed | Local full commit exists; deployment binding remains a separate blocked gate. |
| OPS-03-G03-DEPLOYMENT-BINDING | blocked | No trusted staging deployment binding was available. |
| OPS-03-G05-BRANCH-AUDIT | passed | Branch audit used read-only git metadata. |
| OPS-03-G06-VERIFIED-COMMANDS | passed | Focused provider-independent verification command summaries are recorded. |
| OPS-03-G07-ONE-TARGET-GUARD | passed | Exactly-one alias and action validation is installed. |
| OPS-03-G10-AUTHORIZATION-VALIDATOR | passed | Provider-specific authorization validation is installed. |

