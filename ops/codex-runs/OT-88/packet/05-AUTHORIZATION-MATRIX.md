# OT-88 Authorization Matrix

## Actors

| Actor | Definition |
|---|---|
| `ANONYMOUS` | No valid One Time session. |
| `LEARNER_SELF` | Authenticated learner acting on their own profile/session. |
| `SIBLING_LEARNER` | Authenticated learner in the same household but not the target learner. |
| `OTHER_HOUSEHOLD_LEARNER` | Authenticated learner outside the target household. |
| `GUARDIAN` | Authenticated guardian authorized for household administration. |
| `RABBI_MODERATOR` | One Time Rabbi/moderator identity authenticated independently or mapped from the authorized OT-84 Telegram identity. |
| `SUPPORT` | Support/operator role under existing least-privilege controls. |
| `SCHEDULER` | Internal trusted job principal. |
| `OT84_GATEWAY` | Authenticated/signed OT-84 action gateway, not an arbitrary Telegram caller. |
| `PROVIDER_ADAPTER` | Internal server-side Zoom adapter with secret access. |
| `CANARY_OPERATOR` | Restricted operator allowed to run test-account canary only. |

## Decision notation

- **Allow** — permitted when listed conditions pass.
- **Deny** — always denied for that actor.
- **Conditional** — permitted only under the stated policy and existing role controls.
- **Internal** — no public route; callable only inside the application trust boundary.

## Primary matrix

| Resource/action | Anonymous | Learner self | Sibling learner | Other household learner | Guardian | Rabbi moderator | Support | Scheduler / OT84 / provider / canary |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| View public sign-in/class marketing | Allow | Allow | Allow | Allow | Allow | Allow | Allow | N/A |
| View own next-class safe card | Deny | **Allow** with active learner session | Deny for target | Deny | Conditional: schedule-only view if product already supports it; no learner launch data | Deny | Conditional coarse troubleshooting view | Internal service read as needed |
| View another learner’s next-class card | Deny | Deny | **Deny** | **Deny** | Conditional household schedule only; never provider or grant data | Deny | Conditional with audited support scope | Internal only under job need |
| Activate/deactivate named learner seat | Deny | Deny | Deny | Deny | **Allow** for own household under entitlement and 3-seat transaction | Deny | Conditional administrative workflow | Internal billing/admin service only |
| Activate fourth concurrent seat | Deny | Deny | Deny | Deny | **Deny** with stable seat-limit result | Deny | Deny unless explicit entitlement correction workflow | Internal rule always enforces max |
| Issue own launch grant | Deny | **Allow** after full policy | Deny | Deny | Deny | Deny | Deny | Internal service may issue only on behalf of an already authenticated learner request; no bypass |
| Issue launch grant for another learner | Deny | Deny | Deny | Deny | Deny | Deny | Deny | Deny except explicit test fixture inside provider-off tests; never public/runtime bypass |
| Consume own launch grant | Deny | **Allow** once, same learner/session, full reauthorization | Deny | Deny | Deny | Deny | Deny | Provider adapter receives internal call only after consume succeeds |
| Consume replayed/expired/revoked grant | Deny | **Deny** | Deny | Deny | Deny | Deny | Deny | Internal flow must not call Zoom |
| Receive Meeting SDK bootstrap | Deny | **Allow** only through consumed single-use launch route | Deny | Deny | Deny | Deny | Deny | Provider adapter creates it; tracing/logging cannot inspect body |
| Request learner host role/ZAK/OBF | Deny | **Deny** | Deny | Deny | Deny | Deny | Deny | Provider adapter cannot return host credentials to learner path |
| Submit question for current occurrence | Deny | **Allow** for self with seat/entitlement/window/rate/idempotency | Deny for target | Deny | Deny unless product separately supports guardian submission (not V1) | Deny | Deny | Internal moderation jobs cannot originate learner text |
| View own question safe state | Deny | **Allow** | Deny | Deny | Deny by default; child privacy | Deny | Conditional coarse state only, no body | Internal query as needed |
| View another learner’s question | Deny | Deny | **Deny** | **Deny** | **Deny** | **Allow** only through Rabbi moderation authorization | Conditional only if explicit audited escalation permits | Internal worker sees redacted payload only unless moderation service needs encrypted body |
| Read full question body | Deny | Conditional: own submitted text if UI needs echo; prefer not after submit | Deny | Deny | Deny | **Allow** in Rabbi-only moderation surface | Deny by default; break-glass only if existing policy | Moderation service decrypts only in bounded operation |
| Receive Telegram question alert | Deny | Deny | Deny | Deny | Deny | **Allow** only configured authorized Rabbi identity | Deny | OT84 sends only to authorized recipient ref |
| Apply `Feature next` | Deny | Deny | Deny | Deny | Deny | **Allow** via authenticated moderator/verified OT84 action | Deny by default | OT84 may relay; Question service authorizes and applies |
| Apply `Answered` / `Dismiss` | Deny | Deny | Deny | Deny | Deny | **Allow** via authenticated moderator/verified OT84 action | Deny by default | Same as above |
| Open Rabbi moderation deep link | Deny | Deny | Deny | Deny | Deny | **Allow** with separate short-lived moderator grant + Rabbi auth | Deny unless explicit moderator role | OT84 may present link but cannot reuse learner session |
| Automatic Zoom pin/spotlight | Deny | Deny | Deny | Deny | Deny | **Deny in V1** | Deny | `ZoomFeatureParticipantPort` returns disabled; future canary only |
| Change provider meeting config | Deny | Deny | Deny | Deny | Deny | Deny | Deny by default | `CANARY_OPERATOR` conditional in test environment; production mutation off |
| Read provider meeting ID/passcode/token | Deny | Deny as ordinary data | Deny | Deny | Deny | Deny | Deny | `PROVIDER_ADAPTER` internal secret access only; canary operator sees references/status, not values |
| View coarse provider readiness | Deny | **Allow** learner-safe enum | Deny for target | Deny | Conditional household-safe status | Conditional moderator-safe status | Conditional diagnostic enum | Internal detailed assessment without secrets |
| Schedule reminder intents | Deny | Deny | Deny | Deny | Deny | Deny | Deny | `SCHEDULER` **Allow** after eligibility; idempotent |
| Deliver reminder | Deny | Deny | Deny | Deny | Deny | Deny | Deny | `ReminderDeliveryPort` internal; sink by default, allowlisted canary only |
| Read audit events | Deny | Deny | Deny | Deny | Deny | Deny except own moderation confirmations | Conditional under existing audited security role | Internal audit service; no secrets/text |
| Run Zoom canary | Deny | Deny | Deny | Deny | Deny | Deny | Deny by default | `CANARY_OPERATOR` **Conditional**: test account, explicit allowlist, no production mutation |

## Launch-grant policy pseudocode

```text
function authorizeLaunchGrantIssue(session, occurrenceId, idempotencyKey, now):
    require session.isAuthenticated
    require session.actorType == LEARNER

    learner = learnerRepository.bySessionPrincipal(session.principalId)
    require learner.status == ACTIVE

    seat = seatRepository.activeSeatForLearner(learner.id)
    require seat != null
    require seat.learnerId == learner.id

    entitlement = entitlementRepository.byId(seat.entitlementId)
    require entitlement.householdId == seat.householdId
    require entitlement.status == ACTIVE
    require entitlement.startsAt <= now < entitlement.endsAtOrInfinity
    require activeSeatCount(entitlement.id) <= entitlement.maxActiveLearners

    occurrence = occurrenceRepository.byOpaqueId(occurrenceId)
    require occurrence.belongsToEntitledProduct(entitlement.productCode)
    require occurrence.status == SCHEDULED
    require occurrence.joinOpensAt <= now <= occurrence.joinClosesAt

    require not revocationService.blocks(learner, seat, entitlement, occurrence)
    require providerReadiness.allows(learner, occurrence)
    require csrfOriginSessionChecksPass(session)
    require issueRateLimit.allow(learner.id, occurrence.id)
    require idempotencyKeyIsValid(idempotencyKey)

    return ALLOW(policyVersion, learner.id, seat.id, entitlement.id, occurrence.id)
```

```text
function authorizeLaunchGrantConsume(session, presentedGrant, now):
    require session.isAuthenticated
    require session.actorType == LEARNER

    grant = grantRepository.findByOpaqueHandleAndDigest(presentedGrant)
    require grant.status == ISSUED
    require now < grant.expiresAt

    learner = learnerRepository.bySessionPrincipal(session.principalId)
    require grant.learnerId == learner.id

    # Repeat all live relationship, entitlement, occurrence, revocation,
    # readiness, origin, and rate-limit checks. Issuance is not sufficient.
    issueDecision = authorizeEquivalentLivePolicy(learner, grant.occurrenceId, now)
    require issueDecision.allowed
    require grant.seatId == issueDecision.seatId

    consumed = grantRepository.compareAndSet(
        grant.id, expected=ISSUED, next=CONSUMED, consumedAt=now
    )
    require consumed

    return ALLOW(grant.attendanceAttemptId)
```

## Question policy pseudocode

```text
function authorizeQuestionSubmit(session, occurrenceId, text, idempotencyKey, now):
    require session.actorType == LEARNER
    learner, seat, entitlement = resolveActiveLearnerChain(session)
    occurrence = resolveAuthorizedOccurrence(entitlement, occurrenceId)

    require occurrence.acceptsQuestionsAt(now)
    require seat.status == ACTIVE
    require entitlement.status == ACTIVE
    require not revocationService.blocks(...)
    require questionRateLimit.allow(learner.id, occurrence.id)
    require contentPolicy.validShortQuestion(text)
    require idempotencyKeyIsValid(idempotencyKey)

    return ALLOW(learner.id, seat.id, occurrence.id)
```

```text
function authorizeQuestionRead(session, questionId):
    question = questionRepository.byOpaqueId(questionId)

    if session.actorType == LEARNER:
        learner = resolveLearner(session)
        require question.learnerId == learner.id
        return LEARNER_SAFE_PROJECTION_ONLY

    if session.actorType == RABBI_MODERATOR:
        require moderatorAssignmentAllows(session.actorId, question.occurrenceId)
        return MODERATOR_PROJECTION

    deny
```

## OT-84 action policy

A Telegram action is authorized only when all checks pass:

1. request is received through the repository’s established OT-84 gateway endpoint;
2. gateway signature/authentication is valid;
3. action payload version is supported;
4. external Telegram identity maps to the configured active Rabbi One Time actor;
5. opaque question ID exists and belongs to an occurrence the Rabbi may moderate;
6. action is allowed from the current question state;
7. idempotency key has not already produced a conflicting transition; and
8. rate/abuse controls pass.

Telegram display names, usernames, chat IDs, callback data, or forwarded message content alone are never authorization.

## Support boundary

Support tooling must use safe projections. Default support access may show:

- application occurrence ID;
- learner/household opaque IDs if policy permits;
- entitlement/seat/readiness state;
- attendance attempt state and safe failure category;
- question state without body; and
- audit reason codes.

It must not show:

- provider meeting number/UUID/passcode;
- SDK signature/secret/client secret;
- registrant/ZAK/OBF/host token;
- raw join URL;
- launch bearer token;
- child question body;
- Telegram payload/chat ID unless separately authorized; or
- cookies, headers, or raw request/response bodies.

## Denial behavior

Authorization denials return stable application categories, not resource-existence detail that enables enumeration.

Examples:

- `NOT_ELIGIBLE` for cross-household/sibling/seat/entitlement denials where finer disclosure is unnecessary;
- `SEAT_LIMIT_REACHED` only to the authorized guardian managing their own household;
- `JOIN_NOT_AVAILABLE` for cancelled/outside-window/provider-unready states in learner-safe contexts;
- `GRANT_EXPIRED_OR_USED` for replay/expiry without distinguishing token state to an unauthenticated party;
- `QUESTION_NOT_AVAILABLE` for unauthorized question access; and
- `MODERATION_ACTION_NOT_AVAILABLE` for invalid/unauthorized Telegram transitions.

Every allow/deny/error decision emits a redacted audit event with application IDs, policy version, and coarse reason.
