# OT-15 Former Member Reactivation Checklist

Exact workflow: OT-15 Former Member Reactivation  
Folder: 10 - Enrollment & Nurture  
Exact trigger: approved former/canceled adult segment enters the approved reactivation launch  
message_class: warm_enrollment_campaign  
sender_key: rabbi_campaign

- Read `sender-registry.yaml` and `message-class-registry.yaml`.
- Do not type or guess sender values.
- Do not publish, enroll a production contact, or send.
- Verify former/canceled adult audience, active-Parent and School exclusion, permission, suppression, copy, waits, exits, and dedupe.
- Verify every requested WhatsApp action is `channel_skipped_not_configured` with zero provider calls.
