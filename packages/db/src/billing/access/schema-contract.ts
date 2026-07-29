export const BILLING_ACCESS_SCHEMA_CONTRACT_VERSION = '1.0.0' as const;

export const BILLING_ACCESS_SCHEMA_CONTRACT = {
  projection_table: 'onetime.billing_access_projection',
  receipt_table: 'onetime.billing_event_receipt',
  projection_key: ['household_id'],
  receipt_idempotency_key: ['provider', 'event_id'],
  protected_reference_fields: ['provider_customer_ref_hash'],
  forbidden_fields: [
    'raw_provider_payload',
    'invoice',
    'charge',
    'payment_method',
    'card',
    'email',
  ],
  mutation_policy: 'migration_only',
  runtime_schema_creation: false,
} as const;
