# Zoom disposable scope-mismatch diagnostic task

Task ID: `OT-LAUNCH-01-ZOOM-SCOPE-MISMATCH-DIAGNOSTIC-TOOL-01`

This is a repository-only source task. It does not authorize a Zoom request,
cleanup retry, DELETE, deployment, environment change, or operator decision.

## Exact base and branch

- Repository: `shloimie-beep/onetimev2`
- Base: `2d22f46a40364c670d20fa197e78ead2a2f79c8e`
- Branch: `codex/zoom-disposable-scope-diagnostic-20260727`
- Queue item: `Q04-ZOOM-001`
- Locks: `OT-PRODUCT` only; never `ZOOM-PROVIDER`

PR #125 exact head `eeb31101e0d8f8a395a1c3833129b1afde4fd845`
is the current provider evidence. It proves:

- journal `cleanup_required`, sequence 4, no tombstone;
- exact reconciliation scope mismatch before `beforeDelete`;
- OAuth 1, GET 1, POST/PATCH/DELETE 0;
- runner and `/canary` volume preserved;
- no staging or production effect.

Do not repeat cleanup and do not create another meeting.

## Smallest exact repair

Add one mutation-impossible diagnostic command on the repair descendant that:

1. uses the existing reconciliation preflight, signed-journal validation,
   keyholder inputs, exclusive state lock, and
   `inspectExactMeeting(..., reconciliationOriginalExecutionHead)` path;
2. performs no journal append or transition;
3. exposes no raw meeting ID, host ID, topic, agenda, timestamp, email,
   alternative-host value, credential, token, URL, provider payload, or
   reversible digest;
4. returns only:
   - journal phase and sequence;
   - `meeting_id_matches_expected`;
   - `type_is_single_meeting`;
   - `host_matches_expected`;
   - `topic_matches_expected`;
   - `agenda_matches_expected`;
   - `start_delta_class` as `exact`, `within_reviewed_tolerance`,
     `outside_reviewed_tolerance`, or `unparseable`;
   - `duration_matches_expected`;
   - `registrant_notifications_explicitly_disabled`;
   - `general_email_notification_safe`;
   - `no_alternative_hosts`;
   - `join_before_host_disabled`;
   - `reconciliation_scope`;
   - request counts;
5. hard-fails if POST, PATCH, or DELETE is attempted or any protected value
   enters stdout, stderr, a test snapshot, or Git;
6. keeps the existing cleanup command and every reconciliation predicate
   unchanged.

Add focused tests for each mismatch class, redaction, request budgets, no
journal write, and no DELETE path. Add one exact later provider-executor prompt
that permits only one OAuth plus one GET after separate Board authority and
requires POST/PATCH/DELETE all equal zero.

## Required validation

- focused Zoom provider and diagnostic-command tests;
- typecheck;
- scoped formatting;
- secret scan;
- `git diff --check`;
- exact changed-file allowlist;
- zero provider, deployment, environment, journal, staging, or production
  effects.

## Stop conditions

Stop if the classifier cannot be made mutation-impossible, a safe predicate
requires exposing protected data, the repair would weaken a predicate, the
exact repair base is unavailable, or another writer owns the touched files.

Return the commit, draft PR, validation summary, changed files, zero-effect
counters, and the separately gated read-only executor prompt. End with
`NEXT_QUEUE_STATE: WAITING_FOR_01_OT_CONTROL`.
