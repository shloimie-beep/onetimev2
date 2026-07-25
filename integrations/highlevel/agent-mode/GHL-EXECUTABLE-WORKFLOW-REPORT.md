# HighLevel Executable Workflow Report

This report is generated deterministically from `scripts/highlevel/agent-mode-executable-specs.ts`.
It authorizes no live HighLevel, Railway, contact, enrollment, provider, or message mutation.

| Queue job | Workflow | Exact GHL ID                         | Full folder ancestry                          | Application contract                     | Message class       |
| --------- | -------- | ------------------------------------ | --------------------------------------------- | ---------------------------------------- | ------------------- |
| GHL-UI-14 | OT-01    | 95a6f461-1a04-4260-b379-246fdcc45af7 | One Time / 00 - Intake & Data                 | adult.signup.submitted@1.0.0             | signup_confirmation |
| GHL-UI-15 | OT-07    | fb48c3bf-7154-44c9-825e-88afb5bb7942 | One Time / 30 - Portal Lifecycle              | parent.portal.invitation_requested@1.0.0 | portal_welcome      |
| GHL-UI-16 | OT-08    | eeca2efb-41be-40a7-bbc4-ee6fe8760dd9 | One Time / 30 - Portal Lifecycle              | parent.portal.activated@1.0.0            | portal_activated    |
| GHL-UI-17 | OT-09    | bc8af9fc-22d5-4b4f-b71a-121eeff87f5b | One Time / 40 - Learning Operations / Classes | class.reminder.requested@1.0.0           | class_reminder      |
| GHL-UI-18 | OT-10    | 1bca5210-a3b9-496b-b3cd-48c60c0e33ca | One Time / 40 - Learning Operations / Content | recording.available@1.0.0                | recording_available |

## Reused Repair Subjob

- GHL-UI-04/OT-E01-EMAIL-A-REPAIR remains inside GHL-UI-04 and targets existing workflow a34ea513-4612-4f53-8bd8-49e89e6610f9.
- Observed OT-E01 state remains DRIFTED until exact browser readback and a separately authorized bounded test prove ACTIVE_TESTED.
- Configuration permits zero contacts, enrollments, or sends and fails closed when the disabled action identity controls do not render.

## Preserved PR #115 State

- OT-C01 canonical email campaign remains Draft/not sent with zero selected recipients and zero sends.
- The same-name OT-C01 workflow wrapper remains protectively paused in Draft and explicitly DRIFTED.
- No Student contacts or credentials enter HighLevel.
