# One Time — Current Launch Handoff

**Updated:** 2026-08-16 17:20 Asia/Jerusalem  
**Class time:** 2026-08-16 19:00 Asia/Jerusalem  
**Status:** **EMERGENCY LAUNCH WINDOW — SAFE MINIMUM ONLY**  
**Sole product integration/deployment authority:** PR #131 / `codex/one-time-complete-production-launch-20260805`

This is the durable starting point for Codex, Kimi, or any replacement agent. Read this file first, then read only the files and PRs named below. Do not restart a repository-wide audit.

## Immediate goal

Launch the public Family signup as soon as the customer-facing journey is safe, send the already-prepared one-time GHL email to the approved adult Smart List, and hold the 7:00 PM class without exposing users to a broken account/classroom path.

The one-time campaign may launch before the full Family Lifecycle automation is enabled, provided the hard customer journey passes, the campaign test link is correct, GHL delivery/open/click tracking works, and signups are durably stored in One Time for later reconciliation. Do not publish unproven lifecycle workflows merely to meet the clock.

## Current authority and product truth

- PR #131 remains the only integration/deployment path.
- Always re-fetch the current PR #131 head; this file is updated during the launch window.
- Current production remains M5 `4a5a6e2058848b9513bc53ef733c78d02fe075bb` unless a later exact deployment readback proves otherwise.
- Current authoritative product decision: `ops/launch/2026-08-16-parent-first-learning-decision.md`.
- Parent-first candidate behavior: successful Family signup creates and authenticates the Parent learner immediately, permits Parent classroom/library/questions under the Parent identity, and preserves up to three separate child Student accounts.
- Current STATUS/EXECPLAN state says the Parent-first candidate is BUILT while release gates are running; production remains unchanged until a reviewed successor is integrated and deployed.
- Current STATUS/EXECPLAN also records Family GHL synchronization as disabled and basic protected Zoom/library acceptance as not yet proven. Re-read current remote state before relying on those facts.

Required reading:

1. `AGENTS.md`
2. `ops/launch/CURRENT-LAUNCH-HANDOFF.md`
3. `ops/launch/ONE-TIME-FULL-LAUNCH-STATUS.md`
4. `ops/launch/ONE-TIME-FULL-LAUNCH-EXECPLAN.md`
5. `ops/launch/2026-08-16-parent-first-learning-decision.md`
6. PR #131 current head, comments, checks, and active workers
7. PR #211 current exact state; PR #208 is superseded and must not merge
8. PR #215 is a nonblocking landing-image-only draft

## Current GHL truth

Production location: `pBSnOK2nkdxp6gf9Rg3o`

One-time launch campaign:

- Name: `OT-C02 Sunday Launch — Classes Start Today — 2026-08-16`
- Campaign ID: `6a8159a63762571813a261df`
- State: Draft, unscheduled, unsent
- Sender: `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>`
- Reply-To: `rabbielischeller@onetimeonetime.com`
- Subject: `One Time starts today`
- CTA: `GET FREE ACCESS`
- CTA destination: `https://join.onetimeonetime.com/?utm_source=ghl&utm_medium=email&utm_campaign=ot_launch_2026_free_access&utm_content=OT-C02-SUNDAY-LAUNCH-20260816`

Approved Smart List:

- Name: `OT | Sunday Launch Eligible | 2026-08-16`
- ID: `Gr4bIiGGGf0eBadxINbx`
- Current readback count: 1,335 adult contacts

Workflow state:

- 18 launch workflows are Draft.
- Production workflow publication: 0.
- Production workflow enrollment: 0.
- Historical opportunity migration: 0.
- Production campaign sends: 0.
- Student GHL contacts: 0.
- Billing workflows `OT-LC08` and `OT-LC10` remain blocked; billing is not a launch-day priority.
- Deleted `One Time Torah Questions` pipeline must remain absent. Torah questions are first-party One Time records routed directly to Rabbi Eli.

Do not migrate the old 1,377 opportunities before the launch email. The Smart List is sufficient for the one-time campaign.

## Launch-day gates

### HARD GO GATE — required before the 1,335-recipient send

1. Landing page loads with the current free-access offer.
2. Family signup submits successfully.
3. Parent remains authenticated and reaches Parent Today/Parent Companion.
4. Parent can open the truthful current protected learning/class action.
5. Parent can create at least one child Student.
6. Student can sign in.
7. Student can reach the current class action.
8. No dead end, duplicate account, raw provider link, or 5xx occurs.
9. OT-C02 test email arrives with correct sender, copy, CTA, and UTM link.
10. Clicking the test CTA reaches the same working live journey.

If these pass, Shloimie may authorize the one-time campaign even when the full GHL lifecycle bridge is not yet enabled. GHL will still record campaign delivery/open/click, and One Time must preserve the actual Family signups for later reconciliation.

### PREFERRED TELEMETRY GATE — prove now when possible, but do not publish unsafe workflows

1. One adult GHL contact is created/updated.
2. Exactly one household opportunity exists in `One Time | Family Lifecycle`.
3. Correct first stage is applied.
4. `OT-01` sends exactly once in an operator canary.
5. No Student GHL contact is created.
6. A reply returns to the same adult contact in GHL Conversations with no automatic AI customer reply.

If this telemetry gate is not ready, keep all lifecycle workflows Draft. Do not block the one-time campaign solely to finish nonessential automation when the customer journey is proven and signup data is durable.

### Deferred today

- Stripe/payment sandbox
- paid/grace/canceled workflows
- historical pipeline migration
- GHL sandbox sub-account
- legacy free-content website implementation
- marketing-media production
- graphics/landing-image refinements that are not required for a functional signup
- advanced Zoom Stage Host/OBS/roster features

## Emergency sequence

### Immediate — checkpoint, do not keep expanding

Current Codex/controller must:

- stop starting new branches/workers;
- push every current commit;
- report exact current branch/PR/deployed source;
- report one remaining customer-facing launch blocker only;
- name any open change that must merge/deploy;
- leave a clean remote checkpoint;
- update this handoff if its facts changed.

### Integrate only the minimum accepted candidate

- Do not merge PR #208.
- Use PR #211 or a newer reviewed successor only if exact-head review/checks and controller authority allow it.
- Ignore PR #215 unless the image is the only remaining blocker; it should not delay functional launch.
- Do not spend the window on billing, a new sandbox, or broad refactors.
- Deploy only after exact reconciliation and rollback are ready.

### Operator-owned live canary

Use one new operator-owned Family identity and one synthetic/operator-owned Student.

Prove:

`landing → signup → Parent authenticated → Parent experience → Add Student → Student login → class action`

Then send one OT-C02 test email, click the CTA, and repeat the journey.

### GO / NO-GO

**GO** when the HARD GO GATE passes.

Then Shloimie may explicitly authorize only the one-time campaign:

`OT-C02 SEND AUTHORIZED — 2026-08-16 — SHLOIMIE`

That does not authorize publishing the 18 lifecycle workflows or migrating historical opportunities.

**NO-GO** if any hard customer-facing gate remains:

- signup fails or loops;
- Parent is not authenticated;
- Parent/Student reaches a dead end;
- class action is unavailable or exposes a raw provider link;
- duplicate account occurs;
- OT-C02 test CTA is wrong.

If NO-GO, hold the 1,335-recipient blast. Run the 7:00 PM class for existing/known participants through the current already-working operator-approved class path, and send the public campaign as soon as the app journey is stable. Do not damage the launch by sending a broken signup path.

## Agent ownership

The replacement agent is a launch finisher, not a planner.

It must:

- ingest current remote state;
- preserve current work;
- identify the single customer-facing critical path;
- finish, integrate, deploy, and prove only the minimum launch journey;
- checkpoint continuously in this file and PR #131 comments;
- return one operator action at a time.

It must not:

- restart broad audits;
- redo GHL setup already completed;
- work on billing;
- create a new GHL sandbox before launch;
- migrate historical opportunities;
- publish broad workflows;
- expose secrets, Student data, or raw provider links;
- create Student GHL contacts;
- spend the final window on nonfunctional visual polish.

## Current operator action

1. Paste the short checkpoint prompt into the current Codex window.
2. While Codex checkpoints, send the OT-C02 test email to the operator inbox.
3. When Codex credits end, paste the Kimi takeover prompt from `ops/launch/2026-08-16-kimi-emergency-takeover-prompt.md` into Kimi.
