# One Time Standalone Integration Notes

This repository is standalone. Integration configuration must use the
standalone names below and must not copy BNA legacy alias families, cron wiring,
provider activation flags, or raw class-link storage.

## Delivery Sink Configuration

- `ONE_TIME_EMAIL_FROM`: configured sender label/address for transactional
  email request construction.
- `ONE_TIME_EMAIL_REPLY_TO`: optional reply-to address for transactional email.
- `ONE_TIME_DELIVERY_OWNER_ALERT_EMAIL`: protected owner destination for the
  internal signup alert event.
- `ONE_TIME_PROTECTED_CLASS_TARGET_URL`: protected dispatch-time Family class
  target. The worker may resolve it only while building an eligible Family
  delivery request; it must not be written into source fixtures, outbox JSON,
  CRM DTOs, logs, audit metadata, screenshots, or evidence.

The worker remains `sink` only. Real Resend, WAPI, Telegram, payment, Railway,
DNS, production database, recurrence producer, class-table, and live transport
activation are outside OT-36.
