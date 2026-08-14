# GHL Phase 2B — Draft Workflow UI Build Result

**Date:** 2026-08-14  
**Location:** `pBSnOK2nkdxp6gf9Rg3o`  
**Source:** Operator-supplied HighLevel AI browser/UI readback  
**Status:** Draft workflow build reported complete; exact-ID terminal manifest and operator-owned canary remain required

## Reported completed work

The HighLevel browser/UI agent reports that all 18 planned workflows now exist and remain Draft:

### Audience & Reactivation

- `OT-AUD01 Warm Lead Invitation`
- `OT-AUD02 Old App Active Relaunch`
- `OT-AUD03 Old App Inactive Reactivation`
- `OT-AUD04 Prior Interest Invitation`
- `OT-AUD05 Registered Family Handoff`

### Family Lifecycle

- `OT-01 Family Account Confirmation` — updated in place
- `OT-LC02 Parent Activated — Student Setup`
- `OT-LC03 Student Created — First Learning`
- `OT-LC04 Activated Free — Build the Habit`
- `OT-LC05 Engaged Free — Progress`
- `OT-LC06 Parent Activation Help`
- `OT-LC07 Student Activation Help`
- `OT-LC08 Free Access Deadline` — blocked shell only
- `OT-LC09 Paid Active Welcome`
- `OT-LC10 Grace — Payment Issue` — blocked shell only
- `OT-LC11 Canceled / Former Reactivation`
- `OT-LC12 Weekly Parent Progress`

### Reply Routing

- `OT-R01 Customer Replied - Internal Routing` — updated in place

## Specific UI readback reported

- `OT-LC08` is a Draft shell with a Pipeline Stage Changed trigger filtered to `One Time | Family Lifecycle`; it has no customer email action because the continuation route remains unresolved.
- `OT-LC10` is a Draft shell triggered by `One Time | Family Lifecycle / Grace / Payment Issue`; it has no customer email action because the secure billing-repair route remains unresolved.
- `OT-LC09` was reopened and showed the Rabbi sender, Paid Active trigger, and subject `Your One Time Family access is active`.
- `OT-LC11` was reopened and showed the Rabbi sender, Canceled / Former trigger, and subject `The door is open when you're ready`.
- `OT-LC12` was reopened and showed Thursday 12:00 scheduling, account timezone `Asia/Jerusalem`, Allow Re-entry ON, Allow Multiple Opportunities ON, and Stop on Response OFF.

## Reported external effects

- Workflows built or updated: 18
- Workflows published: 0
- Contacts enrolled: 0
- Customer emails sent: 0
- Opportunities moved: 0
- Opportunities created: 0
- Historical migration effects: 0
- Billing changes: 0
- Reply-routing/provider-setting changes: 0
- Student contacts created: 0

## Remaining blockers

1. `OT Continue URL` still equals `NEEDS_VERIFIED_GHL_CHECKOUT_ROUTE`.
2. `OT-LC08` and `OT-LC10` must remain blocked and Draft until exact checkout and billing-repair routes are verified.
3. Exact workflow IDs and full save/reopen settings for every workflow still need one terminal manifest.
4. Email bodies should be normalized against the approved source copy using HighLevel's text builder rather than manual block-by-block editing.
5. One operator-owned synthetic canary must prove sending, stage logic, suppression, and reply routing before any workflow publication or historical migration.
6. The 1,377 historical opportunities remain untouched. A full exact deduplicated migration manifest—not estimated eligibility—must precede any canary involving historical contacts.
7. One Time application lifecycle events and the household-scoped GHL projection still require PR #131 integration; GHL must not infer product use from opens or clicks.

## Next authority

Use:

`ops/marketing/prompts/2026-08-14-ghl-phase-2c-text-builder-validation-and-canary.md`

No broad publication, enrollment, historical migration, or billing effect is authorized by this result.