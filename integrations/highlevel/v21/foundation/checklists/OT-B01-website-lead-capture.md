# OT-B01 Website Lead-Capture Checklist

Exact workflow: OT-B01 Website Lead-Capture Bot  
Folder: 60 - Bot Actions  
Exact trigger: an adult submits Family or School lead details through the public One Time website assistant  
message_class: signup_confirmation  
sender_key: brand

- Read `sender-registry.yaml` and `message-class-registry.yaml`.
- Do not type or guess sender values.
- Do not publish or enroll a production contact.
- Verify adult-only website origin, retention reference, idempotency, and zero Student/WhatsApp/access effects.
- Save, reopen, and compare the sanitized readback to the reviewed registry before any later activation request.
