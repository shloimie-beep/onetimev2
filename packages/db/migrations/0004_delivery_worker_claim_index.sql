CREATE INDEX IF NOT EXISTS outbox_events_delivery_worker_sink_claim_idx
  ON onetime.outbox_events (
    account_key,
    product_key,
    transport_mode,
    event_type,
    channel,
    status,
    next_attempt_at,
    created_at,
    id
  )
  WHERE transport_mode = 'sink'
    AND status IN ('pending', 'processing')
    AND (
      (event_type = 'email_acknowledgement' AND channel = 'email')
      OR
      (event_type = 'whatsapp_confirmation' AND channel = 'whatsapp')
      OR
      (event_type = 'internal_lead_alert' AND channel = 'internal_email')
    );
