# GHL Phase 2C — Partial Verification and Sunday Send Hold

**Date:** 2026-08-15  
**Location:** `pBSnOK2nkdxp6gf9Rg3o`  
**Status:** Workflow verification in progress; all lifecycle/audience workflows remain Draft; no production send authorized

## Reported current work

The HighLevel browser agent reported:

- all 18 planned workflows exist and remain Draft;
- `OT-01` had no trigger and was changed to a Pipeline Stage Changed trigger for `One Time | Family Lifecycle / Family Account Created — Parent Not Activated`;
- `OT-01` subject was corrected to `Your One Time access is ready`;
- `OT-01` CTA uses `{{ custom_values.ot_parent_companion_url }}`;
- `OT-LC02` through `OT-LC07` subjects were checked;
- `OT-LC05` CTA uses `{{ custom_values.ot_parent_companion_url }}` and contains no potentially empty statistics;
- `OT-LC12` subject was corrected to `This week in One Time`, its missing body was added, and its CTA uses `{{ custom_values.ot_parent_updates_url }}`;
- Audience workflow verification was in progress;
- the historical pipeline readback was in progress and had not yet produced a final exact deduplicated migration manifest.

## Locked hold

No audience or lifecycle workflow is to be Published, scheduled, enrolled, or allowed to send on 2026-08-15.

The Sunday launch announcement is a separate one-time campaign, not activation of the new lifecycle workflows and not authorization for the historical Pipeline A migration.

## Sunday one-time announcement

Prepare one Draft one-time email campaign for Sunday, 2026-08-16:

- campaign name: `OT-C02 Sunday Launch — Classes Start Today — 2026-08-16`;
- sender: `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>`;
- Reply-To: `rabbielischeller@onetimeonetime.com`;
- CTA: `GET FREE ACCESS` → `{{ custom_values.ot_landing_url }}`;
- intended send time: 5:00 PM `Asia/Jerusalem`, two hours before the 7:00 PM class;
- build and audience preview now, but do not schedule or send without a separate explicit operator authorization.

## Audience rule

`Everyone we have` means the exact marketable adult audience, not every contact record.

Include only deduplicated adult contacts with:

- a valid email;
- current email-marketing permission;
- no email DND, unsubscribe, complaint, hard bounce, or suppression;
- a recognized One Time audience/cohort/source relationship.

Exclude:

- Student identities;
- system/vendor/inbox-ingestion contacts;
- operator QA/test contacts;
- explicit Not Interested / Suppressed records;
- invalid or ambiguous records.

Return exact included and excluded counts before scheduling.

## Effects still prohibited

- lifecycle/audience workflow publication: 0;
- workflow enrollment: 0;
- customer sends on 2026-08-15: 0;
- historical opportunity creation/movement: 0;
- broad migration authorization: none;
- Student GHL contacts: 0;
- billing/provider/routing changes: 0.