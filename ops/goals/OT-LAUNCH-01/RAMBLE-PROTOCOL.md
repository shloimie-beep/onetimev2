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

Stable intake fields: `schema_version`, `goal_id`, `received_at`, `source_ref`, `source_sha256`, `operator_wording`, `observed_problem`, `desired_user_outcome`, `acceptance_criteria`, `affected_track`, `decision`, `next_executable_task`, `privacy_review`.

Stable handoff fields: `schema_version`, `goal_id`, `track_id`, `task_id`, `owner`, `write_scope`, `result`, `evidence`, `remaining_work`, `blocker`, `sanitized_at`.
