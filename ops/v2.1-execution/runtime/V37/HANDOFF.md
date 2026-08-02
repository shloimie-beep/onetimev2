# V37 Handoff

## Identity

- Branch: `codex/v21-verify-ea45b0ab10ec-v37`
- Candidate: `ea45b0ab10ec540444e274cad90400ab02d1820efabd5df06bf1318f3b82876d`
- Product source: `0a5ef2e1e6ba88b151334f2aa78bee9cd8949365`
- Start SHA: `031cfde117028c8c199c7bc47e46e18a8227139d`
- Claim: `7bf24561-9b95-480b-8172-49b6498bff07`
- READY digest: `30d6912c416db8490f9e018cf6d0d833bd02a784efb8c234dc4e01ddb6e3139c`
- Result summary digest: `c33427d8f950cab2627067c6996d37583bd77541e7b5088abe079c92d3d46571`

## Completed behavior

All 55 assigned cases have candidate-bound immutable attempts and CURRENT pointers. Accepted source evidence from F01, F03, F04, P08, P09, P10, and P11 was reused, current/delta candidate checks were run, and current production landing/version/public-entry routes were inspected using GET-only requests.

## Exact counts

- Expected/attempted: 55/55
- Passed: 44
- Failed: 5
- Blocked: 6
- Stale/waived: 0/0
- Unexpected external effects: 0
- Cleanup open: 0

Failed cases:

- `OTV2-FOUNDATION-001-AC01`
- `OTV2-FOUNDATION-208-AC01`
- `OTV2-AUTH-019-AC01`
- `OTV2-SIGNUP-177-AC01`
- `OTV2-SIGNUP-228-BEFORE-EXPIRY`

Blocked cases:

- `OTV2-FOUNDATION-003-AC01`
- `OTV2-FOUNDATION-004-AC01`
- `OTV2-FOUNDATION-006-AC01`
- `OTV2-FOUNDATION-216-AC01`
- `OTV2-SIGNUP-178-SCHOOL-INQUIRY-NO-ACCESS`
- `OTV2-SIGNUP-229-PUBLIC-SCHOOL-INQUIRY`

## Verification

- Repository, source ancestry, candidate manifest, READY digest, and 200/200 locked checksums passed.
- Client build and workspace typecheck passed.
- Current/delta focused suites produced 31 passing files and 193 passing tests.
- Two candidate integration files reproducibly fail four tests: authenticated `/app/parent` returns 404 and the fixed-name PortalFeatures asset returns 404.
- The landing/signup Playwright run was blocked before browser execution because the current CI seed omits required `class_occurrences.join_opens_at`.
- Result validation passed for 55 attempts, 55 pointers, five reproductions, exact SHA-256 links, all environment allowlists, candidate/source binding, YAML parse, zero-effect reconciliation, and scope.

## Production readback

`app.onetimeonetime.com` did not resolve for `/`, `/version`, `/family`, `/signup`, `/school`, or `/admin`. `join.onetimeonetime.com/version` returned deployment `f8ba23d3-311b-4277-a85d-6695611fedfd`, version `0d69de15`, and Railway git commit `ed77a04d`, none matching the candidate. Its landing still exposes an offline WhatsApp assistant, and `/signup` remains the legacy combined Family-or-School lead form without an account password.

## Owners and recovery

- `P34`: establish the candidate-bound production application origin/deployment.
- `I36`: repair the Parent shell/asset composition and the stale CI browser fixture.
- `F01` with `I36`: remove the emitted experience-preview asset and remaining prohibited live WhatsApp surface.
- `C00`/`R44`: provide later explicit effect authority for the two provider-effect School cases; this V37 run correctly did not execute them.

## External effects and lease

Read-only authority only. Attempted 0, succeeded 0, reconciled 0; no deploy, DNS, contact, send, enrollment, billing, cleanup, operator canary, or production effect occurred. Lease `e48f2ded-422e-4705-aaaf-4ab389636664` was released in runtime state at `2026-08-02T12:12:04Z`.

## Exact next action

C00 should validate the pushed V37 evidence head and queue it for I36 aggregation. Failed and blocked cases remain release blockers and are not waived.
