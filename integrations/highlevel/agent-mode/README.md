# HighLevel Agent Mode Queue

Generated: 2026-07-23T19:38:50.147Z
Location: pBSnOK2nkdxp6gf9Rg3o

Run these jobs in order. Every job defaults to no-send, no-publish, no production workflow enrollment, no live payment mutation, and no Student contacts.

GHL-UI-14 through GHL-UI-18 contain reviewed executable contracts. Their configuration phase remains no-send/no-enrollment; a later controlled test requires separate explicit authorization, one operator-owned adult maximum, one email maximum, and zero broad sends.

GHL-UI-04 contains the keyed OT-E01 Email A repair subjob. It is not a duplicate job or workflow and remains DRIFTED until exact readback plus a separately authorized bounded test pass.

Deterministic executable report: integrations/highlevel/agent-mode/GHL-EXECUTABLE-WORKFLOW-REPORT.md

Agent Mode must save UI work, verify the saved state, return to the BNA Agent Action drop-off page, save the result JSON, verify the readback result ID, and avoid unsaved chat-only completion claims.

| Order | Job                                         | File                                                                                    | Result                                                          |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | GHL-UI-01 create sender custom-value folder | integrations/highlevel/agent-mode/jobs/GHL-UI-01-create-sender-custom-value-folder.json | integrations/highlevel/agent-mode/results/GHL-UI-01.result.json |
| 2     | GHL-UI-02 reconcile sender values           | integrations/highlevel/agent-mode/jobs/GHL-UI-02-reconcile-sender-values.json           | integrations/highlevel/agent-mode/results/GHL-UI-02.result.json |
| 3     | GHL-UI-03 create or reconcile pipelines     | integrations/highlevel/agent-mode/jobs/GHL-UI-03-create-or-reconcile-pipelines.json     | integrations/highlevel/agent-mode/results/GHL-UI-03.result.json |
| 4     | GHL-UI-04 update workflow sender identities | integrations/highlevel/agent-mode/jobs/GHL-UI-04-update-workflow-sender-identities.json | integrations/highlevel/agent-mode/results/GHL-UI-04.result.json |
| 5     | GHL-UI-05 update OT-A1                      | integrations/highlevel/agent-mode/jobs/GHL-UI-05-update-ot-a1.json                      | integrations/highlevel/agent-mode/results/GHL-UI-05.result.json |
| 6     | GHL-UI-06 verify sending domain             | integrations/highlevel/agent-mode/jobs/GHL-UI-06-verify-sending-domain.json             | integrations/highlevel/agent-mode/results/GHL-UI-06.result.json |
| 7     | GHL-UI-07 phase-1 seed                      | integrations/highlevel/agent-mode/jobs/GHL-UI-07-phase-1-seed.json                      | integrations/highlevel/agent-mode/results/GHL-UI-07.result.json |
| 8     | GHL-UI-08 office seed                       | integrations/highlevel/agent-mode/jobs/GHL-UI-08-office-seed.json                       | integrations/highlevel/agent-mode/results/GHL-UI-08.result.json |
| 9     | GHL-UI-09 brand seed                        | integrations/highlevel/agent-mode/jobs/GHL-UI-09-brand-seed.json                        | integrations/highlevel/agent-mode/results/GHL-UI-09.result.json |
| 10    | GHL-UI-10 capture workflow IDs              | integrations/highlevel/agent-mode/jobs/GHL-UI-10-capture-workflow-ids.json              | integrations/highlevel/agent-mode/results/GHL-UI-10.result.json |
| 11    | GHL-UI-11 capture pipeline IDs              | integrations/highlevel/agent-mode/jobs/GHL-UI-11-capture-pipeline-ids.json              | integrations/highlevel/agent-mode/results/GHL-UI-11.result.json |
| 12    | GHL-UI-12 save and readback verification    | integrations/highlevel/agent-mode/jobs/GHL-UI-12-save-and-readback-verification.json    | integrations/highlevel/agent-mode/results/GHL-UI-12.result.json |
| 13    | GHL-UI-13 phase-2 rabbi acceptance          | integrations/highlevel/agent-mode/jobs/GHL-UI-13-phase-2-rabbi-acceptance.json          | integrations/highlevel/agent-mode/results/GHL-UI-13.result.json |
| 14    | GHL-UI-14 activate OT-01                    | integrations/highlevel/agent-mode/jobs/GHL-UI-14-activate-ot-01.json                    | integrations/highlevel/agent-mode/results/GHL-UI-14.result.json |
| 15    | GHL-UI-15 activate OT-07                    | integrations/highlevel/agent-mode/jobs/GHL-UI-15-activate-ot-07.json                    | integrations/highlevel/agent-mode/results/GHL-UI-15.result.json |
| 16    | GHL-UI-16 activate OT-08                    | integrations/highlevel/agent-mode/jobs/GHL-UI-16-activate-ot-08.json                    | integrations/highlevel/agent-mode/results/GHL-UI-16.result.json |
| 17    | GHL-UI-17 activate OT-09                    | integrations/highlevel/agent-mode/jobs/GHL-UI-17-activate-ot-09.json                    | integrations/highlevel/agent-mode/results/GHL-UI-17.result.json |
| 18    | GHL-UI-18 activate OT-10                    | integrations/highlevel/agent-mode/jobs/GHL-UI-18-activate-ot-10.json                    | integrations/highlevel/agent-mode/results/GHL-UI-18.result.json |
