# One Time Mishnayos — Attribution Links and GHL Pipeline Design

**Date:** 2026-08-13  
**Status:** Proposed current design; live GHL audit required before mutation  
**Campaign:** `ot_launch_2026_free_access`

## 1. Principle

Anonymous views and clicks are tracked through analytics/attribution. Opportunity stages begin only when an adult contact or durable Family account exists.

Do not create pipeline stages for Facebook, WhatsApp, YouTube, an event cohort, or a specific creative. Preserve those dimensions through first/latest attribution, UTMs, source metadata, tags, and stable creative IDs.

## 2. Stable URL pattern

```text
https://join.onetimeonetime.com/
  ?utm_source=<source>
  &utm_medium=<medium>
  &utm_campaign=ot_launch_2026_free_access
  &utm_content=<creative_id>
  &utm_term=<audience_or_context>
```

Keep values lowercase except the stable creative ID when case preservation is confirmed.

## 3. Channel link templates

### Facebook organic

```text
https://join.onetimeonetime.com/?utm_source=facebook&utm_medium=organic_social&utm_campaign=ot_launch_2026_free_access&utm_content=OTM-CR-202608-001-V01&utm_term=us_parents_boys_7_13
```

### Meta paid

Use HighLevel's current paid-social attribution convention:

```text
https://join.onetimeonetime.com/?utm_source=fb_ad&utm_medium=paid_social&utm_campaign=ot_launch_2026_free_access&utm_content=OTM-CR-202608-001-V01&utm_term=us_parents_boys_7_13
```

Record platform campaign/ad-set/ad IDs separately when available. Do not change the stable creative ID after launch.

### Instagram organic

```text
https://join.onetimeonetime.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=ot_launch_2026_free_access&utm_content=OTM-CR-202608-001-V01&utm_term=us_parents_boys_7_13
```

### YouTube Short

```text
https://join.onetimeonetime.com/?utm_source=youtube&utm_medium=organic_short&utm_campaign=ot_launch_2026_free_access&utm_content=OTM-CR-202608-001-V01&utm_term=us_parents_boys_7_13
```

### WhatsApp Status

```text
https://join.onetimeonetime.com/?utm_source=whatsapp&utm_medium=status&utm_campaign=ot_launch_2026_free_access&utm_content=OTM-CR-202608-001-V01&utm_term=rabbi_status
```

### WhatsApp direct forward

```text
https://join.onetimeonetime.com/?utm_source=whatsapp&utm_medium=forward&utm_campaign=ot_launch_2026_free_access&utm_content=OTM-CR-202608-001-V01&utm_term=direct_forward
```

### WhatsApp broadcast

```text
https://join.onetimeonetime.com/?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=ot_launch_2026_free_access&utm_content=OTM-CR-202608-001-V01&utm_term=permissioned_broadcast
```

### GHL email

```text
https://join.onetimeonetime.com/?utm_source=ghl&utm_medium=email&utm_campaign=ot_launch_2026_free_access&utm_content=EMAIL-ACT-001&utm_term=family_activation
```

### Rabbi direct referral

```text
https://join.onetimeonetime.com/?utm_source=rabbi_referral&utm_medium=direct_referral&utm_campaign=ot_launch_2026_free_access&utm_content=REF-RABBI-001&utm_term=personal
```

## 4. Required marketing registry fields

At minimum preserve:

```text
first_touch_source
first_touch_medium
first_touch_campaign
first_touch_content
latest_touch_source
latest_touch_medium
latest_touch_campaign
latest_touch_content
signup_source
signup_medium
signup_creative_id
activation_source
activation_creative_id
first_student_created_at
first_live_join_at
first_recording_start_at
activated_at
engaged_at
paid_at
```

Use HighLevel's built-in first/latest attribution where available and preserve One Time-side signup/activation lineage in the marketing registry.

## 5. Current repository pipeline conflict

The historical desired pipeline stages are:

1. Warm Leads
2. Free Event / Tisha B'Av Signups
3. Old App — Active
4. Old App — Inactive
5. New Funnel / Pre-Registered
6. Active Member
7. Canceled / Lost

That design mixes acquisition source/cohort with lifecycle state. The current locked decision also moves a committed free Family account directly to `Active Member`, which hides Student setup and activation.

## 6. Recommended replacement pipeline

Pipeline name remains:

```text
One Time Enrollment and Conversion
```

Stages:

1. **Lead Captured / Not Registered**
   - Adult contact exists.
   - No durable Family account.

2. **Free Account Created / Student Setup Pending**
   - Durable Family signup committed.
   - Zero Students.

3. **Student Created / Not Activated**
   - One or more Students exist.
   - No live join or recording start.

4. **Activated Free Family**
   - At least one Student joined live or started an approved recording.

5. **Engaged Free Family**
   - Family reached the approved repeat-use threshold.

6. **Paid Continuation Pending**
   - Checkout/continuation intent exists.
   - Paid active state is not yet verified.

7. **Paid Active**
   - Verified paid access is active.

8. **Grace / Payment Issue**
   - Verified payment failure/grace state.

9. **Canceled / Former**
   - Paid access ended or Family explicitly canceled.

## 7. Cohort/source handling

Use tags or source fields such as:

```text
OT | Source | Old App Active
OT | Source | Old App Inactive
OT | Source | Tisha B'Av 2026
OT | Source | Facebook Organic
OT | Source | Meta Paid
OT | Source | WhatsApp Status
OT | Source | WhatsApp Forward
OT | Source | WhatsApp Broadcast
OT | Source | YouTube
```

Do not use those as lifecycle stages.

## 8. Stage-to-email evaluation

- Stage 1: eligible pre-signup nurture only when adult marketing permission is valid.
- Stage 2: account confirmation and Student-setup reminder.
- Stage 3: first-class/recording activation email.
- Stage 4: brand vision, class reminders, and progress reinforcement.
- Stage 5: progress and paid-continuation preparation.
- Stage 6: checkout completion sequence.
- Stage 7: paid-member service/retention.
- Stage 8: essential payment/grace communication.
- Stage 9: reactivation only when valid marketing permission exists.

Stage movement is not sufficient proof by itself. Each workflow rechecks the authoritative product/billing/consent state.

## 9. Live-audit requirements before change

Read back and record:

- exact live pipeline ID;
- every stage ID, name, and position;
- opportunity count in each stage;
- all workflows triggered by stage or pipeline;
- all custom values and forms writing opportunities;
- existing tags/source fields;
- whether duplicate opportunities are permitted;
- rollback method;
- one operator-owned canary plan.

No live stage rename, reorder, deletion, workflow publication, contact enrollment, or customer email is authorized by this document.