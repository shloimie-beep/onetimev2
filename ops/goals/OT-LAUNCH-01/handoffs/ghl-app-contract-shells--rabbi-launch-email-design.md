# OT-LAUNCH-01 Rabbi launch email design packet

This is a proposed, repository-only task packet for the existing
`ghl_app_contract_shells` Board track. It creates no new status model and
authorizes no HighLevel mutation, contact enrollment, or message send.

## Recommended execution

- Model: Terra
- Reasoning: high
- Worktree: clean checkout of the exact pushed
  `codex/full-app-staging-live` head
- Output: one reviewable Git diff and one sanitized handoff

## Outcome

Prepare one governed Rabbi-authored new-program email and the exact sender
acceptance job needed to use the existing `rabbi_campaign` identity without
guessing addresses, mixing audiences, or sending to customers.

## Canonical sender boundary

- `rabbi_campaign`: visible Rabbi-authored migration, warm enrollment,
  teaching, and launch communication. Preferred From identity is
  `Rabbi Eli Scheller | One Time Mishnayos <rabbi@onetimeonetime.com>`.
  It remains pending until mailbox/routing, HighLevel From acceptance, one
  operator-owned seed delivery, and reply-to-GHL readback all pass.
- `rabbi_personal`: later Rabbi-authored Torah answers and follow-up through
  the same accepted Rabbi address and GHL conversation boundary.
- `office`: `info@onetimeonetime.com` for support, access, billing,
  cancellation, complaints, and Parent administration.
- `brand`: `info@onetimeonetime.com` for neutral program, class, content,
  receipt, and portal notices.
- `account_security`: One Time/Resend only for activation, password, email
  verification, login challenge, and security-token messages.

The public Rabbi identity does not require a second operational inbox if
`rabbi@` is safely routed into the same governed GHL Conversations workflow.
The exact Reply-To remains fail-closed until that route is proven.

## Email content brief

Write one concise, personal email in Rabbi Eli Scheller's voice:

- announce that One Time Mishnayos has a new program and application;
- explain the outcome as helping boys build clarity, memory, consistency, and
  a love for Mishnah through live learning from Eretz Yisrael;
- invite the reader to see the current program and controlled pilot;
- use the current main One Time signup/program page, never the expired Tisha
  route or a raw Zoom/provider link;
- make no claim that the recipient attended an event, is paying, is likely to
  pay, or already has portal access;
- avoid false urgency, fabricated scarcity, and unverified pricing;
- sign as Rabbi Eli Scheller / One Time Mishnayos;
- include the correct permission and unsubscribe treatment for the selected
  audience.

Do not commit the final raw customer email body in the ramble intake or
sanitized handoff. Put reviewed copy only in the existing canonical HighLevel
prompt/checklist path after the message class and audience are selected.

## Audience rules

Use one content concept but preserve separate delivery contracts:

1. `existing_subscriber_migration` / OT-02A is only for exact adults the
   operator identifies as prior One Time customers who need an operational
   migration notice.
2. `prelaunch_nurture` / OT-02B is only for adults with independently proven
   general-marketing permission.
3. Tisha registrants remain event-purpose only unless separate marketing
   permission exists.
4. Historic payment, attendance, event registration, portal presence,
   deliverability, or an old tag never creates marketing permission.
5. Students and children never enter GHL or any email audience.
6. The historic approximately 88 contacts remain outside this task until the
   operator supplies the selected adult list.

## Work

1. Read, in order:
   - `AGENTS.md`
   - `ops/goals/CURRENT.yaml` and its complete goal files
   - `.agents/skills/one-time-goal-executor/SKILL.md`
   - `.agents/skills/one-time-ghl-ui-job/SKILL.md`
   - `integrations/highlevel/registry/sender-registry.yaml`
   - `integrations/highlevel/registry/message-class-registry.yaml`
   - `integrations/highlevel/registry/communications-contract.json`
   - `integrations/highlevel/registry/workflow-registry.yaml`
   - `integrations/highlevel/agent-mode/jobs/GHL-UI-13-phase-2-rabbi-acceptance.json`
   - the OT-02A and OT-02B prompt/checklist pairs
2. Reconcile the requested sender boundary against those canonical files.
   Reuse existing keys and jobs. Do not create a second sender registry,
   campaign, workflow, or communications contract.
3. Propose the smallest exact Git diff that:
   - makes the desired Rabbi sender and reply-routing prerequisites explicit;
   - turns GHL-UI-13 or one reviewed successor into an executable
     acceptance job;
   - permits exactly one protected operator-owned sender seed and one reply
     readback only after separate exact authority;
   - keeps every customer audience, workflow publication, enrollment, and
     broad send at zero;
   - adds the reviewed content brief to the correct OT-02A/OT-02B canonical
     paths without mixing their eligibility rules.
4. Return a sanitized handoff naming the exact files, unresolved decisions,
   job ID, expected readback, and the next browser-only executor prompt.

## Done when

- No duplicate sender, message class, workflow, campaign, or status model is
  introduced.
- A fresh task can identify the exact preferred Rabbi From identity and every
  acceptance prerequisite without consulting local chat history.
- `info@` and the security sender retain their existing responsibilities.
- The migration and marketing audiences remain distinct and fail closed.
- One bounded browser executor job can later prove From acceptance, one
  operator-owned delivery, and one reply reaching GHL.
- Customer sends, contact mutations, workflow publications/enrollments,
  Stripe mutations, access mutations, and production changes equal zero in
  this design task.

## Copy-paste task prompt

Act as the repository-only executor for
`OT-LAUNCH-01-GHL-RABBI-LAUNCH-EMAIL-DESIGN`.

Read this entire packet and every canonical source it lists. Produce the
smallest reviewable Git diff that makes the existing Rabbi campaign sender
acceptance and one Rabbi-authored new-program email implementation-ready.
Reuse `rabbi_campaign`, `office`, `brand`, `account_security`, OT-02A, OT-02B,
and GHL-UI-13; do not create a parallel registry, workflow, campaign, or
status model.

Do not open or mutate HighLevel. Do not send, enroll, publish, activate,
create contacts, reconcile the historic contact list, infer consent or
attendance, change Stripe or access, alter production, or commit raw customer
data. Return the exact diff, validation, sanitized handoff, and the separate
browser-executor prompt required for the later bounded sender canary.
