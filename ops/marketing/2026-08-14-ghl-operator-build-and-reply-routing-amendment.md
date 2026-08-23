# One Time Mishnayos — GHL Operator Build and Reply Routing Amendment

**Date:** 2026-08-14  
**Status:** Current operator execution decision  
**Integration authority:** PR #131  
**Control/marketing source:** PR #183

## 1. Operator-led GHL execution

Shloimie will perform the live HighLevel configuration directly through the HighLevel AI builder and normal HighLevel UI, with ChatGPT supplying the exact staged instructions, pipeline design, tags, custom fields, workflow copy, safeguards, and review steps.

Codex/Work must not duplicate live HighLevel mutations while the operator-led build is active. Its responsibilities are limited to:

- reading the current PR #183 decisions;
- reconciling the One Time application event/bridge requirements;
- verifying exact HighLevel IDs and save/reopen readback supplied by the operator;
- updating `integrations/highlevel/registry/workflow-registry.yaml` and generated projections through the canonical repository process;
- testing the One Time → GHL household-scoped lifecycle event contract;
- reporting drift, conflicts, and missing product events;
- preserving zero Student GHL contacts.

The operator will paste the HighLevel AI audit/build result back into ChatGPT before broad enrollment or publication.

## 2. Current email identity truth

The verified program/lifecycle identity is:

```text
Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>
Reply-To: rabbielischeller@onetimeonetime.com
```

Existing evidence proves:

- SPF, DKIM, DMARC, MX, and CNAME readiness;
- workflow sender save/reopen;
- operator inbox delivery;
- reply round-trip into the correct HighLevel contact conversation;
- OT-01 remains Draft;
- broad enrollment remains disabled.

A successful test email was also delivered to the operator on 2026-08-14.

This evidence proves the HighLevel sending identity and tracked-reply path. It does not by itself prove that `rabbielischeller@onetimeonetime.com` is a standalone Gmail/Workspace mailbox with its own login.

## 3. Canonical reply workflow

The canonical shared customer-reply inbox is:

```text
HighLevel → Conversations → Team Inbox
```

When a recipient replies to a tracked workflow email, the reply should remain attached to the adult contact conversation. An authorized HighLevel user opens that conversation, selects the Email channel, verifies the From identity, and replies from the conversation thread.

Do not change the current Reply Address or email-service routing merely to create an external mailbox view until the live settings are read back. The current reply canary already proved that a reply reached the correct HighLevel conversation.

If Shloimie and Rabbi Eli also need copies in ordinary external inboxes, prefer a non-destructive configuration after readback:

- HighLevel Forwarding Address; or
- Forward to Assigned User; or
- a real Gmail/Google Workspace/Outlook mailbox connected through two-way sync for one-to-one mail.

Do not use a routing change that diverts replies away from HighLevel Conversations. Workflow/bulk email continues to use the sub-account email provider even when a personal inbox is connected for two-way one-to-one sync.

## 4. Inbox ownership and filters

Recommended operating model:

- HighLevel Conversations remains the canonical shared record.
- Adult contacts are assigned to the appropriate One Time user/team member.
- Rabbi/program replies are tagged or classified as `OT | Conversation | Rabbi`.
- Technical/account replies are tagged or classified as `OT | Conversation | Support`.
- The Team Inbox is filtered by channel `Email`, assigned user, unread/open state, and the relevant conversation tag/category.
- Replies, notes, and status changes remain attached to the same adult contact.
- Students are never created as HighLevel contacts.

A Gmail label/filter can organize copies that are actually forwarded to Gmail, but a Gmail filter cannot create routing. First confirm that forwarding or two-way sync is configured.

## 5. Pipeline and workflow source

The current intended design remains:

- `One Time | Audience & Reactivation` for Warm Lead, Old App Active, Old App Inactive, Prior Event/Interest, invitation, registration handoff, and suppression outcomes;
- `One Time | Family Lifecycle` for Family Account Created, Parent Companion Activated, Student Created, Activated Free Family, Engaged Free Family, Paid Active, Grace/Payment Issue, and Canceled/Former;
- no `Paid Continuation Pending` stage;
- checkout and continuation are timestamped fields/events;
- all stage movement is adult/household scoped and driven by verified One Time/Stripe state, not email opens or guessed activity;
- source/channel/creative identity is stored through UTMs, source fields, tags, and stable creative IDs;
- no Student GHL contacts.

Canonical detail and copy remain in:

- `ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-PARENT-COMPANION.md`;
- `ops/marketing/2026-08-13-parent-companion-pipeline-email-and-rabbi-voice-amendment.md`;
- `ops/marketing/2026-08-13-attribution-link-and-pipeline-design.md`.

## 6. Build safety

The HighLevel AI/UI build must proceed in this order:

1. Read-only inventory of current pipelines, stages, opportunity counts, workflows, tags, custom fields, senders, reply routing, and dependencies.
2. Create missing new pipelines/stages/fields/tags without renaming, moving, or deleting populated historical stages.
3. Build or update workflows in Draft only.
4. Save, reopen, and read back every trigger, condition, wait, sender, CTA, stop condition, and re-entry setting.
5. Run one operator-owned seed only after Shloimie reviews the audit and Draft configuration.
6. Publish or enroll a real audience only through a separate explicit operator approval.

No broad send, opportunity migration, workflow publication, Student contact creation, billing mutation, or provider-routing change is authorized by this amendment.
