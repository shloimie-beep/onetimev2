# One Time GHL Phase 2 — Workflow Build Readiness Result

**Date:** 2026-08-14  
**Location:** `pBSnOK2nkdxp6gf9Rg3o`  
**Status:** Fields/custom values complete; workflow implementation still pending in UI  
**Source:** Operator-supplied HighLevel AI result

## Confirmed completed effects

- Updated four existing custom values to verified product routes.
- Created `OT Parent Updates URL`.
- Created four opportunity DATE fields for Parent portal/welcome-video activation.
- No contacts enrolled.
- No customer emails sent.
- No opportunities created or moved.
- No workflows published.
- No Student contacts created.
- No reply-routing, two-way-sync, billing, or historical-pipeline mutation.

## Confirmed route/custom-value state

- `OT Parent Companion URL` → `https://app.onetimeonetime.com/app/parent`
- `OT Add Student URL` → `https://app.onetimeonetime.com/app/parent/students/new`
- `OT Student Login URL` → `https://app.onetimeonetime.com/login`
- `OT Support URL` → `https://app.onetimeonetime.com/app/parent/support`
- `OT Parent Updates URL` → `https://app.onetimeonetime.com/app/parent/updates`
- `OT Continue URL` remains blocked as `NEEDS_VERIFIED_GHL_CHECKOUT_ROUTE`.

## Welcome-video opportunity fields

- `OT Parent Portal Opened At`
- `OT Welcome Video Started At`
- `OT Welcome Video Completed At`
- `OT Add Student Clicked At`

The detailed 25/50/75 percent milestones remain in One Time analytics, not GHL.

## Workflow implementation truth

The HighLevel AI/API skill exposed workflow listing only and did not expose create/update/folder write operations. Therefore:

- No audience or lifecycle workflow was created.
- `OT-01 Family Account Confirmation` was not updated.
- `OT-R01 Customer Replied - Internal Routing` was not updated.
- Workflow folders were not created.
- The supplied workflow definitions are implementation specifications only.

The next execution must use a browser-capable HighLevel UI worker or direct operator UI work. It must never claim a workflow exists until save → reopen → exact readback succeeds.

## Historical migration preview caveat

The 1,377-opportunity migration preview uses exact source-stage opportunity totals, but several DND, suppression, valid-email, and eligibility counts were estimated from location-wide rates rather than exact full pagination by source stage.

No historical migration or canary is authorized from estimated counts. Before any real migration effect, the operator/worker must:

1. fully paginate each source stage;
2. compute exact unique-contact, duplicate, DND, suppression, email, permission, and existing-target-opportunity counts;
3. return an exact deduplicated manifest;
4. use operator-owned synthetic contacts for workflow testing;
5. obtain a separate explicit authorization for any real historical opportunity creation.

## Current blockers

- `OT-LC08 Free Access Deadline` — blocked on verified checkout URL.
- `OT-LC10 Grace — Payment Issue` — blocked on verified billing-repair URL.
- Workflow create/update must be completed through the UI.
- The final One Time → GHL product-event bridge must be reconciled in PR #131.

## Next safe action

Use the dedicated HighLevel UI execution prompt to create the workflow folders, update OT-01 and OT-R01 in place, build the Draft audience/lifecycle workflows, save/reopen every workflow, and return exact IDs with zero enrollments, sends, publications, or historical opportunity movement.
