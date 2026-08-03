# Evidence

- PR #99 head verified through GitHub and local fetch.
- Clean isolated worktree created on the exact requested branch.
- Raw source preserved at `RAW.md` with SHA-256 `4d21cf954d5ed121d3d184387c2a1ce68bd08c9bd93c0b99db3d9f7146ccfdc3`.
- Intent gate passed with spec fingerprint `f9ae235ee4556b9e9cc633e3ffe7b1181c0639e4869645bfdf2d2fefedc44877` and evidence in `INTENT-VALIDATION.json`.
- Canonical schema `one-time-highlevel@1.1.0` contains five sender profiles, 35 message classes, three canonical pipelines plus one preserved compatibility pipeline, one event definition, the communications contract, and the Rabbi Telegram contract.
- All 19 canonical workflows resolve exactly one registered sender key and message class; generated prompts and checklists declare the exact workflow, folder, trigger, sender, transport, and no-send/no-publish boundary.
- HighLevel API apply created 13 custom fields, 9 tags, 33 resolved custom values, and 3 canonical pipelines. Safe IDs are recorded in `integrations/highlevel/registry/api-created-asset-ids.json`.
- Final idempotent API readback verified 33 active fields plus one deprecated field, 37 active tags plus one deprecated tag, 33 resolved custom values, all three canonical pipelines, and the preserved `One Time Business` pipeline.
- API effects: contacts created 0, workflow enrollments 0, messages sent 0, Stripe mutations 0. Workflow UI setup remains separately queued and unpublished.
- Agent Mode queue/export contains 13 contiguous, ordered, pinned-source jobs with Save, reopen, safe-ID capture, drop-off save, and readback requirements.
