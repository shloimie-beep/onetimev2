export const COMMUNICATION_FOUNDATION_SCHEMA_CONTRACT_VERSION = '1.0.0' as const;

export const COMMUNICATION_FOUNDATION_TABLES = {
  reminder_preference: 'onetime.communication_reminder_preference',
  decision: 'onetime.communication_decision',
  delivery_dedupe: 'onetime.communication_delivery_dedupe',
  workflow_readback: 'onetime.communication_workflow_readback',
  workflow_request: 'onetime.communication_workflow_request',
  website_lead_plan: 'onetime.communication_website_lead_plan',
} as const;

export const COMMUNICATION_FOUNDATION_REQUIRED_CONSTRAINTS = [
  'preference IN (email, whatsapp, both, none)',
  'UNIQUE (operation_id)',
  'UNIQUE (request_id)',
  'CHECK (subject_kind = adult)',
  'optimistic version fencing on mutable projections',
] as const;
