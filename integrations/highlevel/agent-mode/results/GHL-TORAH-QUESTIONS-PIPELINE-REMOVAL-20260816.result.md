# GHL Result — Torah Questions Pipeline Removed

**Date:** 2026-08-16  
**Location:** `pBSnOK2nkdxp6gf9Rg3o`  
**Source:** Operator report  
**Status:** Operator-deleted; dependency readback still required

## Operator action

Shloimie deleted the HighLevel pipeline:

- Name: `One Time Torah Questions`
- Former pipeline ID: `wabcK1pPBuqj1T4cjpI7`

The preceding GHL audit showed zero opportunities in every stage of that pipeline, so no opportunity migration is expected.

## Replacement decision

No GHL pipeline replaces it.

All Student and Parent Torah questions route directly into the One Time application and Rabbi Eli Scheller's Admin question queue. Rabbi answers through the application or the governed Telegram projection of the same authoritative record.

## Former stages — drift audit only

- New — `003652bd-73a8-4b8d-9f35-f4c37854fec8`
- Shloimie Review — `58f3ebc9-c3b8-45cd-a54a-f855722b8d30`
- Assigned to Rabbi — `9518925f-656f-4d2b-a559-32b42ac8be71`
- Rabbi Reviewing — `e526a96d-0e87-4835-8be3-e885fe5e9c67`
- Answer Sent — `d68b0149-4017-4483-b823-e0de121e3b8b`
- Waiting on Follow-Up — `ec263678-3b92-4b00-9de8-0b68608f9de3`
- Closed — `75989802-095c-45ed-9271-4ba6c53cb96b`

These IDs must not be reused.

## Required readback

Before closing the GHL cleanup:

- verify the pipeline is absent;
- verify no workflow, form, webhook, dashboard, report, tag rule, custom field, or automation references the former pipeline/stages;
- verify the canonical workflow registry does not recreate it;
- verify no Student contact or question opportunity is created from One Time.

## External-effect ledger

- Pipeline deletions: 1, operator-reported
- Opportunities migrated: 0 expected
- Contacts changed: 0 reported
- Emails sent: 0 reported
- Workflows published: 0 reported
- Student contacts created: 0 reported
