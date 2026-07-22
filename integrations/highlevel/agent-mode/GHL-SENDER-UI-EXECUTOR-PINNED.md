# One Time HighLevel sender UI executor — pinned

Paste this entire document once into Agent Mode. It is the complete execution instruction; do not ask the operator to edit or supply a commit SHA.

## Immutable execution identity

- Repository: `shloimie-beep/onetimev2`
- Pull request: https://github.com/shloimie-beep/onetimev2/pull/103
- Branch: `codex/highlevel-sender-registry-v1-1`
- Immutable registry source (Commit A): `a87e06a6625edd0cff512eee533d204a169aa235`
- HighLevel location ID: `pBSnOK2nkdxp6gf9Rg3o`
- Registry schema: `one-time-highlevel@1.1.0`

Treat Commit A as the only source of truth for every registry, queue, and job read. Pin all reads to the full Commit A SHA above. The later Commit B contains only this executor and its private-job template; do not use Commit B as the registry source. Stop with `BLOCKED(registry identity mismatch)` if the repository, schema, location, or immutable SHA cannot be verified exactly. Never substitute a branch head and never ask the operator to paste a SHA.

## Canonical source paths

Read all of these from Commit A before opening or changing HighLevel:

- `integrations/highlevel/registry/AGENT-HANDOFF.md`
- `integrations/highlevel/registry/current.json`
- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/pipeline-registry.yaml`
- `integrations/highlevel/registry/event-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/rabbi-telegram-contract.yaml`
- `integrations/highlevel/registry/custom-values.yaml`
- `integrations/highlevel/registry/workflow-registry.yaml`
- `integrations/highlevel/registry/prompt-registry.yaml`
- `integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json`

## Non-negotiable safety

- Send no email, WhatsApp, SMS, Telegram, seed, test, or production message. `MESSAGES_SENT` must remain `0`.
- Do not click Send. For seed jobs, prepare and verify an unsent draft/configuration only.
- Do not publish or activate workflows or the bot.
- Do not enroll production contacts and do not create Student contacts or Student credential fields.
- Do not mutate Stripe, payments, Railway, DNS, mailbox routing, or production application state.
- Do not create unregistered assets, duplicates, guessed sender text, guessed pipeline stages, or guessed message classes.
- Do not delete or migrate existing opportunities. Preserve the `One Time Business` compatibility pipeline unless a later approved migration explicitly replaces it.
- Never expose PITs, API keys, passwords, contact data, or other secrets in results.
- Phase-2 `rabbi@` remains blocked until its registered mailbox, From-address, protected seed delivery, reply-to-Conversations, and result-recording prerequisites all pass in a separately authorized lane.

## Exact ordered jobs

Run these jobs serially and in this exact order. A blocked job blocks only itself and dependent later work; record the blocker and continue with independent safe verification where the job contract permits.

1. **GHL-UI-01 — create sender custom-value folder**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-01-create-sender-custom-value-folder.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-01.result.json`
2. **GHL-UI-02 — reconcile sender values**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-02-reconcile-sender-values.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-02.result.json`
3. **GHL-UI-03 — create or reconcile pipelines**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-03-create-or-reconcile-pipelines.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-03.result.json`
4. **GHL-UI-04 — update workflow sender identities**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-04-update-workflow-sender-identities.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-04.result.json`
5. **GHL-UI-05 — update OT-A1**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-05-update-ot-a1.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-05.result.json`
6. **GHL-UI-06 — verify sending domain**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-06-verify-sending-domain.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-06.result.json`
7. **GHL-UI-07 — phase-1 seed**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-07-phase-1-seed.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-07.result.json`
8. **GHL-UI-08 — office seed**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-08-office-seed.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-08.result.json`
9. **GHL-UI-09 — brand seed**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-09-brand-seed.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-09.result.json`
10. **GHL-UI-10 — capture workflow IDs**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-10-capture-workflow-ids.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-10.result.json`
11. **GHL-UI-11 — capture pipeline IDs**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-11-capture-pipeline-ids.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-11.result.json`
12. **GHL-UI-12 — save and readback verification**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-12-save-and-readback-verification.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-12.result.json`
13. **GHL-UI-13 — phase-2 rabbi acceptance**
   - Job: `integrations/highlevel/agent-mode/jobs/GHL-UI-13-phase-2-rabbi-acceptance.json`
   - Result: `integrations/highlevel/agent-mode/results/GHL-UI-13.result.json`

## Per-job execution protocol

For every job:

1. Load the exact job JSON from Commit A, verify its job ID, idempotency key, prerequisites, allowed assets, forbidden actions, and exact HighLevel UI path.
2. Verify the visible HighLevel location is exactly `pBSnOK2nkdxp6gf9Rg3o` before any action.
3. Perform only actions registered in the canonical source files. If an asset already matches, record `already_satisfied`; do not duplicate it.
4. Click Save for every permitted edit. Never click Send, Publish, Activate, Enroll, or any equivalent live-action control.
5. Reopen the saved screen and verify the visible persisted state against Commit A.
6. Capture only safe HighLevel asset IDs and visible statuses required by the job result schema. Do not capture message bodies, contact details, credentials, or secrets.
7. Return to the BNA Agent Action drop-off page at `/ops/agent-actions/highlevel/drop-off`.
8. Save the result JSON to the exact result path declared by the job, then reopen/read it and record the returned drop-off result ID with `readback_verified: true`.
9. Never finish with a chat-only completion claim. A job is not complete without saved HighLevel state when an edit was allowed, saved result JSON, and verified readback.

## Completion output

After all 13 jobs have terminal results, return one compact aggregate with:

- each job ID and terminal status;
- every safe HighLevel asset ID captured;
- exact blockers and their dependent jobs;
- `MESSAGES_SENT: 0`;
- `WORKFLOWS_PUBLISHED: 0`;
- `PRODUCTION_CONTACTS_ENROLLED: 0`;
- `STRIPE_MUTATIONS: 0`;
- `STUDENT_CONTACTS_CREATED: 0`;
- every drop-off result ID and readback-verification status.

Do not claim the executor is complete if any result exists only in chat or if any saved state was not reopened and verified.
