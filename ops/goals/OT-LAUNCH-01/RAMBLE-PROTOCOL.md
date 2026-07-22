# OT-LAUNCH-01 ramble protocol

Use this when the operator supplies a voice note or stream-of-consciousness update. Preserve intent and cadence without turning private material into Git history.

1. Save one sanitized intake as `inputs/YYYYMMDDTHHMMSSZ-<slug>.yaml`.
2. Preserve the operator's wording as either a short sanitized quote or a protected-reference URI plus SHA-256. Never commit secrets, credentials, private destinations, customer or Student data, or raw email/message copy.
3. Extract, without silently expanding scope:
   - `observed_problem`: what the operator sees now;
   - `desired_user_outcome`: what a real role should be able to do or understand;
   - `acceptance_criteria`: exact observable success and forbidden behavior;
   - `affected_track`: one existing BOARD track, or a proposed track for conductor review;
   - `decision`: `needed` with the smallest explicit choice, or `not_needed` with why;
   - `next_executable_task`: one bounded action, evidence output, and write scope.
4. Keep ambiguity in `operator_wording` and label inferences. Do not translate uncertainty into completion, authorization, provider readiness, or a new canonical model.
5. The conductor assigns the track. A dispatched non-conductor writes `handoffs/<track-id>--<task-id>.json`; it never edits BOARD.yaml.
6. The conductor reads the handoff, updates BOARD evidence/blocker/next action once, and leaves reports as links to BOARD rather than copied status.

## Visual intent loop

When the ramble describes layout, copy placement, visual hierarchy, mobile/desktop behavior, or a screenshot:

1. Preserve a sanitized operator quote or protected screenshot/page reference and identify the exact route.
2. Convert the intent into observable breakpoint checks. Use stated sizes; otherwise include the nearest supported mobile and desktop widths and record any intermediate width implied by the problem.
3. Inspect the current deployed page and available screenshots before editing. Record the concrete mismatch, including overflow, empty space, clipping, ordering, text, contrast, or control-state behavior.
4. Automatically fix an obvious in-scope violation when the desired outcome is unambiguous. Do not pause for approval over routine spacing, responsive flow, exact supplied copy, or a failing acceptance check.
5. Retest every recorded breakpoint, capture sanitized proof, and verify the exact deployed URL/head when deployment belongs to the assigned track.
6. Ask the operator only when a real product decision remains, such as competing content, hierarchy, behavior, audience, or irreversible production scope. Keep the smallest explicit choice in `decision`.

Visual evidence never becomes a second status document. The intake and handoff carry evidence; BOARD remains the only current status map.

Stable intake fields: `schema_version`, `goal_id`, `received_at`, `source_ref`, `source_sha256`, `operator_wording`, `observed_problem`, `desired_user_outcome`, `acceptance_criteria`, `affected_track`, `decision`, `next_executable_task`, `privacy_review`.

Stable handoff fields: `schema_version`, `goal_id`, `track_id`, `task_id`, `owner`, `write_scope`, `result`, `evidence`, `remaining_work`, `blocker`, `sanitized_at`.
