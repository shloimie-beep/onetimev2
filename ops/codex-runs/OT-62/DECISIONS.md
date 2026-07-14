# OT-62 Decisions

- Decision: Preserve only.
  - Rationale: OT-RUN-RECOVERY-01 forbids product implementation changes.
  - Consequence: Future windows resume from preserved packets instead of chat memory.

- Decision: Do not treat stop-report templates as populated attempt evidence.
  - Rationale: The discovered BLOCKED/STOP lines are prompt instructions unless a separate populated report is found.
  - Consequence: ATTEMPT-REPORT.md records ATTEMPT_REPORT_NOT_FOUND.

- Decision: External/provider/production actions remain unauthorized.
  - Rationale: Recovery scope permits GitHub publication of recovery artifacts only.
  - Consequence: Future implementation must obtain exact task-specific authorization before irreversible or provider-side actions.
