# OT-83 Security Authorization Matrix

| Requirement | Implementation/Evidence |
|---|---|
| Parent can revoke learner sessions | `revoke_sessions` operation added to parent student-access flow |
| Parent cannot impersonate student | Operation invalidates sessions only; no token exchange or view-as route added |
| Current student secret is never retrievable | No password/secret/token is returned by the operation; tests keep lifecycle rows free of proof tokens |
| Student session resolves to one learner | Existing `studentLearnerSubject` remains server-derived; mounted portal tests assert no sibling data |
| Reset/security change invalidates sessions | Existing reset/suspend tests remain; new revoke path uses `invalidateUserSessions` |
| Cross-household access denied | Existing portal service and mounted route tests remain green |
| Provider URL leakage blocked | Existing service and mounted tests assert no raw provider URLs in portal JSON |
| CSRF on writes | Existing router/mounted tests cover missing CSRF for protected writes |
| Audit events | Portal service records `student_access_revoke_sessions`; lifecycle records `student_sessions_revoked` |
| External mutations | No production/provider/deployment mutations performed |
