ALTER TABLE onetime.account_lifecycle_delivery_outbox
  DROP CONSTRAINT IF EXISTS account_lifecycle_delivery_outbox_final_delivery_state_check;

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  DROP CONSTRAINT IF EXISTS account_lifecycle_delivery_outbox_constraint_9;

ALTER TABLE onetime.account_lifecycle_delivery_outbox
  ADD CONSTRAINT account_lifecycle_delivery_outbox_final_delivery_state_check
  CHECK (
    final_delivery_state IS NULL
    OR final_delivery_state IN ('delivered', 'bounced', 'complained', 'failed', 'suppressed')
  );

SELECT 1;
