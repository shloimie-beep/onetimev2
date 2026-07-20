# One Time Campaign Seed Approval Packet

Status: ready_for_operator_approval
Generated: 2026-07-19T17:20:00.000Z
Snapshot hash: 6e215ab2d0493f3e4175ca1bfb24d07099293f8da63e02d793e5ba4250246bd5

## Audience

- Segment: one_time_real_crm_email_campaign_eligible
- Channel: email
- Email-campaign eligible: 1357
- Seed requested count: 1
- Broad requested count: 0
- WhatsApp eligible: 0
- Suppressed: 152
- Raw recipient list included: false

## Proposed Seed Copy

Template revision: rabbi-day-one-email-seed-v1
Subject: Join One Time Mishnayos with Rabbi Eli Scheller
Preheader: Live daily Mishnayos at 7:00 p.m. Israel time - free until Rosh Hashanah.

```text
Hello,

One Time Mishnayos with Rabbi Eli Scheller is open for signup.

Give your son a love for learning Torah with a live daily Mishnayos class at 7:00 p.m. Israel time, live from Eretz Yisrael.

Join now - free until Rosh Hashanah.

Sign up: https://join.onetimeonetime.com/signup

- One Time Mishnayos
```

## Required Approval

Seed send authorized now: false
Broad campaign authorized now: false

Operator approval statement required before seed send:

```text
APPROVE_ONE_TIME_CAMPAIGN_SEED:6e215ab2d0493f3e4175ca1bfb24d07099293f8da63e02d793e5ba4250246bd5:1357:email:seed-only
```

Operator confirmation required: ONE-TIME-CAMPAIGN-SEED-OK

Exact action after approval:

Send exactly one seed email to the protected operator-approved destination; do not send to the 1,357-person real audience until separate broad-campaign approval is recorded.

## Safety

- Production side effects: false
- Database writes performed: false
- External send performed: false
- Provider mutation count: 0
- Private destination included: false
- Raw values included: false
- Broad campaign sends: 0

## Source Evidence

- CRM apply: ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply.json
- CRM reconcile: ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-reconcile.json
- Production signup proof: ops/codex-runs/RABBI-DAY-ONE-CRM/production-signup-proof.json
- Runtime: rabbi-day-one-crm-ed77a04 / ed77a04dd24391d5b79be7f839d7f5752a57e0f9
- Latest production migration: 2204_w12_100_real_source_crm_apply
