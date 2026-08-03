# OT-15 Former Member Reactivation

Build in HighLevel Draft state only. Do not publish, enroll production contacts, or send messages.

Exact workflow: OT-15 Former Member Reactivation  
Folder: 10 - Enrollment & Nurture  
Exact trigger: approved former/canceled adult segment enters the approved reactivation launch  
message_class: warm_enrollment_campaign  
sender_key: rabbi_campaign

Read `sender-registry.yaml`, `message-class-registry.yaml`, and the canonical workflow registry. Do not type or guess sender identity.

Require a permitted former/canceled adult who is not an active Parent or School contact. Recheck permission and suppression before the launch, day 4, and day 9 emails. Exit on signup, suppression, active membership, School classification, or completion. WhatsApp remains dormant and never blocks email.
