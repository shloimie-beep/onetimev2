# Kimi Emergency Takeover Prompt — One Time Launch

Paste the block below into Kimi when the current Codex/Work Ultra session can no longer continue.

```text
ONE TIME — EMERGENCY LAUNCH TAKEOVER

The 7:00 PM Israel class is imminent.

Repository:
shloimie-beep/onetimev2

Sole integration/deployment branch and PR:
codex/one-time-complete-production-launch-20260805
PR #131

Your role:
LAUNCH FINISHER. Do not restart planning or a broad audit.

FIRST ACTIONS — MAXIMUM 10 MINUTES

1. Fetch the current remote PR #131 head. Do not trust a stale local checkout.
2. Read, in this order:
   - AGENTS.md
   - ops/launch/CURRENT-LAUNCH-HANDOFF.md
   - ops/launch/ONE-TIME-FULL-LAUNCH-STATUS.md
   - ops/launch/ONE-TIME-FULL-LAUNCH-EXECPLAN.md
   - ops/launch/2026-08-16-parent-first-learning-decision.md
3. Read the latest PR #131 comments and current open PRs/workers.
4. Read any final checkpoint message left by the previous Codex controller.
5. Return a six-line checkpoint only:
   - current PR #131 head;
   - current deployed source;
   - current active candidate/PR;
   - what is already proven;
   - the single remaining customer-facing launch blocker;
   - the exact next action you will take.

DO NOT OPEN NEW WORKERS UNTIL THAT CHECKPOINT IS RETURNED.

LAUNCH GOAL

Safely enable this live journey as soon as possible:

landing
→ Family signup
→ Parent authenticated immediately
→ Parent Today/Parent Companion
→ Parent can see the truthful current learning/class action
→ Parent can create child Student
→ Student login
→ Student can reach class

The one-time GHL launch campaign is already prepared and must remain unsent until one operator-owned live customer-journey canary passes.

GHL CURRENT STATE

Production location:
pBSnOK2nkdxp6gf9Rg3o

Campaign:
OT-C02 Sunday Launch — Classes Start Today — 2026-08-16
Campaign ID: 6a8159a63762571813a261df
State: Draft, unscheduled, unsent

Smart List:
OT | Sunday Launch Eligible | 2026-08-16
ID: Gr4bIiGGGf0eBadxINbx
Current count: 1,335 adult contacts

Sender:
Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>

CTA:
GET FREE ACCESS
https://join.onetimeonetime.com/?utm_source=ghl&utm_medium=email&utm_campaign=ot_launch_2026_free_access&utm_content=OT-C02-SUNDAY-LAUNCH-20260816

All 18 launch workflows remain Draft. Do not publish them as a batch. Do not migrate the old 1,377 opportunities. Billing is deferred.

CURRENT PRODUCT AUTHORITY

The current Parent-first decision requires:

- successful signup creates/authenticates the Parent learner immediately;
- the Parent learns under the Parent identity;
- the Parent may access classroom/library/questions without first creating a child;
- the household may create three separate child Students;
- no Student GHL contacts;
- no raw Zoom/Vimeo/Drive/provider locators.

Read the exact decision file. Do not preserve an older Parent-as-nonlearner assumption.

PR RULES

- PR #131 is the only integration/deployment path.
- PR #208 is superseded; do not merge it.
- Inspect PR #211 or any newer reviewed successor before using it.
- PR #215 is a nonblocking landing-image-only draft and must not delay functional launch.
- Preserve rollback and exact-head verification.
- Do not merge/deploy a stale or unreviewed candidate merely because time is short.

HARD SEND GATE

Before recommending the broad email send, prove on the exact live deployment:

1. landing loads with the correct free-access offer;
2. signup succeeds;
3. Parent remains authenticated;
4. Parent reaches Parent Today/Companion;
5. Parent has truthful class/learning access;
6. Parent can create one Student;
7. Student can sign in;
8. Student can reach the class action;
9. no dead end, duplicate account, raw provider link, or 5xx occurs;
10. OT-C02 test email CTA reaches the same working journey.

GHL delivery/open/click tracking is already part of OT-C02. Full Family Lifecycle stage automation is preferred but is not a hard gate for the one-time campaign when the customer journey is proven and One Time durably stores the signups. If the lifecycle bridge is not ready, leave all lifecycle workflows Draft and return the reconciliation work for after the send.

PREFERRED TELEMETRY PROOF

Prove when possible without delaying the customer launch:

- one adult GHL contact;
- one household opportunity;
- correct stage;
- no Student GHL contact;
- no duplicate contact/opportunity/email;
- email reply in GHL Conversations with no automatic AI reply.

OPERATING ORDER

A. Reconcile the previous agent's checkpoint and current remote state.
B. Finish or integrate only the one remaining customer-facing blocker.
C. Run focused tests; avoid repository-wide work unless required by current authority.
D. Deploy/reconcile only through PR #131.
E. Tell Shloimie exactly when to run the live operator canary.
F. Remain available while Shloimie reports each canary result.
G. If the HARD SEND GATE passes, return the exact authorization phrase Shloimie must provide for OT-C02.

NO-GO / FALLBACK

If the live signup/account/class journey cannot be proven before class:

- do not send the 1,335-recipient campaign;
- do not invent a raw Zoom/provider-link workaround;
- preserve the class for existing/known participants through the current operator-approved working class path;
- finish the public account journey and send the campaign once stable.

OUT OF SCOPE FOR THIS WINDOW

- Stripe/payment sandbox
- billing/grace/cancellation workflows
- historical opportunity migration
- new GHL sandbox location
- legacy free-content website implementation
- organic marketing media
- visual polish not required for function
- advanced Zoom Stage Host/OBS/roster

CONTINUOUS HANDOFF RULE

After every meaningful change, update:

ops/launch/CURRENT-LAUNCH-HANDOFF.md

and add one concise PR #131 comment containing:

- exact head;
- deployed source;
- completed proof;
- remaining blocker;
- next operator action.

Never leave work only in local files or chat.

RETURN STYLE

Be terse and operational. Give Shloimie one action at a time. Never claim production readiness without the live end-to-end proof.
```
