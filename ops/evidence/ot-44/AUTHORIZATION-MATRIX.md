# OT-44 Authorization Matrix

Authorization is performed in `buildCommunicationsListResponse` before repository access.

| Identity | Result | Repository access |
| --- | --- | --- |
| unauthenticated | `401` | No |
| `owner` | `200` | Yes |
| `admin` | `200` | Yes |
| `crm_agent` | `403` | No |
| `viewer` | `403` | No |
| `member` | `403` | No |
| `public` | `403` | No |
| `unknown` | `403` | No |
| malformed role | `403` | No |

Scope source:

- `ReadOnlySessionScopePort` supplies `accountKey` and `productKey`.
- Browser query/header/body scope fields are ignored by the service.
- Contact-local mode uses the route path contact identifier only.
- Contact-local mode checks same-scope contact existence before outbox projection; missing or cross-scope contacts return `404`.

Focused proof:

- `tests/integration/communications/api.test.ts`
- Negative-role test confirms zero repository calls before denial.
- Forged query scope test confirms repository receives session scope.
- Missing-contact test confirms `404` before outbox list access.
