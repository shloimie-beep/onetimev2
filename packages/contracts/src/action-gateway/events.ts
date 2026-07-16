export const actionGatewayEventTypes = [
  'class.question.created',
  'class.question.selected',
  'support.ticket.received',
  'content.processing.status_changed',
  'lead.created',
  'task.created',
  'task.updated',
] as const;

export type ActionGatewayEventType = (typeof actionGatewayEventTypes)[number];

export type ActionGatewayEventV1 = {
  specversion: '1.0';
  id: string;
  type: ActionGatewayEventType;
  source: string;
  subject: string;
  time: string;
  datacontenttype: 'application/json';
  schema_version: 1;
  scope: { account_id: string; product_id: string };
  actor: {
    kind: 'user' | 'system';
    principal_id: string;
    role: 'one_time_owner' | 'one_time_admin' | 'system';
    transport: 'telegram' | 'web' | 'api' | 'system';
  };
  correlation_id: string;
  causation_id?: string | null;
  idempotency_key: string;
  trace_id: string;
  data: Record<string, unknown>;
};

const topLevelKeys = new Set([
  'specversion',
  'id',
  'type',
  'source',
  'subject',
  'time',
  'datacontenttype',
  'schema_version',
  'scope',
  'actor',
  'correlation_id',
  'causation_id',
  'idempotency_key',
  'trace_id',
  'data',
]);

const requiredDataKeys: Record<ActionGatewayEventType, string[]> = {
  'class.question.created': ['question_id', 'class_id', 'submitted_at', 'status'],
  'class.question.selected': [
    'question_id',
    'class_id',
    'selected_at',
    'selected_by_principal_id',
    'selection_revision',
    'status',
  ],
  'support.ticket.received': [
    'ticket_id',
    'subscriber_ref',
    'received_at',
    'channel',
    'status',
    'priority',
    'has_attachments',
  ],
  'content.processing.status_changed': [
    'content_id',
    'pipeline',
    'previous_status',
    'status',
    'changed_at',
    'attempt',
    'is_terminal',
  ],
  'lead.created': ['lead_id', 'created_at', 'source_channel', 'status'],
  'task.created': ['task_id', 'created_at', 'status', 'revision'],
  'task.updated': ['task_id', 'updated_at', 'revision', 'changed_fields', 'status'],
};

const allowedDataKeys: Record<ActionGatewayEventType, Set<string>> = {
  'class.question.created': new Set([
    'question_id',
    'class_id',
    'submitted_at',
    'status',
    'author_ref',
    'excerpt_redacted',
  ]),
  'class.question.selected': new Set([
    'question_id',
    'class_id',
    'selected_at',
    'selected_by_principal_id',
    'selection_revision',
    'status',
    'reason_code',
  ]),
  'support.ticket.received': new Set([
    'ticket_id',
    'subscriber_ref',
    'received_at',
    'channel',
    'status',
    'priority',
    'subject_redacted',
    'has_attachments',
  ]),
  'content.processing.status_changed': new Set([
    'content_id',
    'pipeline',
    'previous_status',
    'status',
    'changed_at',
    'attempt',
    'is_terminal',
    'error_code',
  ]),
  'lead.created': new Set([
    'lead_id',
    'created_at',
    'source_channel',
    'status',
    'display_label_redacted',
  ]),
  'task.created': new Set([
    'task_id',
    'created_at',
    'status',
    'revision',
    'assignee_principal_id',
    'due_at',
    'title_redacted',
  ]),
  'task.updated': new Set([
    'task_id',
    'updated_at',
    'revision',
    'changed_fields',
    'status',
    'assignee_principal_id',
    'due_at',
    'title_redacted',
  ]),
};

const subjectPattern: Record<ActionGatewayEventType, RegExp> = {
  'class.question.created': /^classes\/[^/]+\/questions\/[^/]+$/,
  'class.question.selected': /^classes\/[^/]+\/questions\/[^/]+$/,
  'support.ticket.received': /^support\/tickets\/[^/]+$/,
  'content.processing.status_changed': /^content\/[^/]+$/,
  'lead.created': /^leads\/[^/]+$/,
  'task.created': /^tasks\/[^/]+$/,
  'task.updated': /^tasks\/[^/]+$/,
};

const forbiddenKeyPattern =
  /(^|_)(email|phone|bot_token|webhook_secret|message_body|raw_body|raw_payload|token)($|_)/i;

export function validateActionGatewayEventV1(value: unknown) {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false as const, errors: ['event must be an object'] };

  for (const key of Object.keys(value)) {
    if (!topLevelKeys.has(key)) errors.push(`unknown top-level field: ${key}`);
  }
  for (const key of topLevelKeys) {
    if (key !== 'causation_id' && !(key in value)) errors.push(`missing top-level field: ${key}`);
  }

  const type = value.type;
  if (!isActionGatewayEventType(type)) errors.push('unsupported event type');
  if (value.specversion !== '1.0') errors.push('specversion must be 1.0');
  if (!isUuid(value.id)) errors.push('id must be a uuid');
  if (
    typeof value.source !== 'string' ||
    !/^onetime:\/\/[a-z0-9][a-z0-9./_-]*$/.test(value.source)
  ) {
    errors.push('source must be an onetime URI');
  }
  if (typeof value.time !== 'string' || Number.isNaN(Date.parse(value.time))) {
    errors.push('time must be an RFC3339 timestamp');
  }
  if (value.datacontenttype !== 'application/json') {
    errors.push('datacontenttype must be application/json');
  }
  if (value.schema_version !== 1) errors.push('schema_version must be 1');
  if (
    !isRecord(value.scope) ||
    !safeId(value.scope.account_id) ||
    !safeId(value.scope.product_id)
  ) {
    errors.push('scope must include account_id and product_id');
  }
  if (!isRecord(value.actor) || !safeId(value.actor.principal_id)) {
    errors.push('actor must include a safe principal_id');
  }
  if (isRecord(value.actor) && !['user', 'system'].includes(String(value.actor.kind))) {
    errors.push('actor.kind is invalid');
  }
  if (
    isRecord(value.actor) &&
    !['one_time_owner', 'one_time_admin', 'system'].includes(String(value.actor.role))
  ) {
    errors.push('actor.role is invalid');
  }
  if (
    isRecord(value.actor) &&
    !['telegram', 'web', 'api', 'system'].includes(String(value.actor.transport))
  ) {
    errors.push('actor.transport is invalid');
  }
  if (typeof value.correlation_id !== 'string' || value.correlation_id.length < 8) {
    errors.push('correlation_id is required');
  }
  if (typeof value.idempotency_key !== 'string' || value.idempotency_key.length < 8) {
    errors.push('idempotency_key is required');
  }
  if (typeof value.trace_id !== 'string' || value.trace_id.length < 8) {
    errors.push('trace_id is required');
  }
  if (!isRecord(value.data)) errors.push('data must be an object');

  if (isActionGatewayEventType(type) && isRecord(value.data)) {
    if (typeof value.subject !== 'string' || !subjectPattern[type].test(value.subject)) {
      errors.push(`subject does not match ${type}`);
    }
    for (const key of requiredDataKeys[type]) {
      if (!(key in value.data)) errors.push(`missing data field for ${type}: ${key}`);
    }
    for (const key of Object.keys(value.data)) {
      if (!allowedDataKeys[type].has(key)) errors.push(`unknown data field for ${type}: ${key}`);
    }
    validateTypedData(type, value.data, errors);
  }

  for (const key of collectKeys(value)) {
    if (forbiddenKeyPattern.test(key)) errors.push(`forbidden privacy key: ${key}`);
  }

  return errors.length ? { ok: false as const, errors } : { ok: true as const };
}

export function assertActionGatewayEventV1(value: unknown): asserts value is ActionGatewayEventV1 {
  const result = validateActionGatewayEventV1(value);
  if (!result.ok) throw new Error(result.errors.join('; '));
}

function validateTypedData(
  type: ActionGatewayEventType,
  data: Record<string, unknown>,
  errors: string[],
) {
  if (type === 'class.question.created' && data.status !== 'new')
    errors.push('question created status must be new');
  if (type === 'class.question.selected' && data.status !== 'selected')
    errors.push('question selected status must be selected');
  if (
    type === 'task.updated' &&
    (!Array.isArray(data.changed_fields) || data.changed_fields.length < 1)
  ) {
    errors.push('task.updated changed_fields must be non-empty');
  }
  for (const [key, value] of Object.entries(data)) {
    if (
      key.endsWith('_at') &&
      value !== null &&
      (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
    ) {
      errors.push(`${key} must be an RFC3339 timestamp`);
    }
    if (
      (key === 'revision' || key.endsWith('_revision') || key === 'attempt') &&
      (!Number.isInteger(value) || Number(value) < 0)
    ) {
      errors.push(`${key} must be an integer`);
    }
  }
}

function isActionGatewayEventType(value: unknown): value is ActionGatewayEventType {
  return typeof value === 'string' && actionGatewayEventTypes.includes(value as never);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function safeId(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)]);
}
