# ${TASK_ID} Handoff

## Identity

- Branch: `${TASK_BRANCH}`
- Start SHA: `${AUTHORIZED_START_SHA}`
- Implementation SHA before this handoff metadata commit: `${IMPLEMENTATION_COMMIT_SHA}`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `${TASK_PACKET_SHA256}`
- Context digest: `${TASK_CONTEXT_SHA256}`
- Source package digest: `${SPEC_PACKAGE_SHA256}`

## Completed behavior

${COMPLETED_BEHAVIOR}

## Remaining work

${REMAINING_WORK}

## Exact next action

${EXACT_NEXT_ACTION}

## Coverage

- Requirements: ${REQUIREMENT_STATUS}
- Acceptance cases: ${CASE_STATUS}

## Changed files and migrations

${CHANGED_FILES_AND_MIGRATIONS}

## Verification

${COMMANDS_AND_RESULTS}

## External effects

${AUTHORITY_COUNTS_CLEANUP}

## Security, privacy, and data handling

${SECURITY_PRIVACY_NOTES}

## Blockers, deviations, and recovery

${BLOCKERS_DEVIATIONS_RECOVERY}
