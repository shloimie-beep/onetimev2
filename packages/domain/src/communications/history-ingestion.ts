import { createHash } from 'node:crypto';

export type CommunicationHistorySourceTruthKind =
  | 'locally_stored_outbound_intent'
  | 'sink_test_processing'
  | 'provider_status_truth'
  | 'stored_inbound_webhook'
  | 'importable_provider_export'
  | 'unavailable_unprovable_history';

export type CommunicationHistorySourceTruthRow = {
  kind: CommunicationHistorySourceTruthKind;
  source: string;
  truthful_claim: string;
  forbidden_claims: string[];
  implementation_status: 'implemented_projection' | 'adapter_contract' | 'blocked_by_provider';
};

export const communicationHistorySourceTruthMatrix: CommunicationHistorySourceTruthRow[] = [
  {
    kind: 'locally_stored_outbound_intent',
    source: 'onetime.outbox_events',
    truthful_claim: 'One Time stored an outbound intent or provider-off reply draft locally.',
    forbidden_claims: ['sent', 'delivered', 'read by recipient'],
    implementation_status: 'implemented_projection',
  },
  {
    kind: 'sink_test_processing',
    source: 'onetime.outbox_events.status=sink_delivered',
    truthful_claim: 'The synthetic sink processed the local intent in test mode.',
    forbidden_claims: ['provider accepted', 'provider delivered'],
    implementation_status: 'implemented_projection',
  },
  {
    kind: 'provider_status_truth',
    source: 'onetime.whatsapp_delivery_events',
    truthful_claim: 'A stored provider status event was received for a known outbox message.',
    forbidden_claims: ['complete mailbox history', 'message body is available'],
    implementation_status: 'implemented_projection',
  },
  {
    kind: 'stored_inbound_webhook',
    source: 'onetime.whatsapp_inbox_events',
    truthful_claim: 'An inbound WhatsApp webhook was durably stored with encrypted body data.',
    forbidden_claims: ['raw body is safe for evidence', 'all historical inbound messages exist'],
    implementation_status: 'implemented_projection',
  },
  {
    kind: 'importable_provider_export',
    source: 'redacted Resend or WhatsApp export fixture',
    truthful_claim: 'A redacted export row can be dry-run and deduped before any import.',
    forbidden_claims: ['production import completed', 'raw private body may be committed'],
    implementation_status: 'adapter_contract',
  },
  {
    kind: 'unavailable_unprovable_history',
    source: 'missing Resend or WhatsApp historical provider access',
    truthful_claim: 'Provider history is unavailable until an export/API readback is supplied.',
    forbidden_claims: ['history is empty', 'history is complete'],
    implementation_status: 'blocked_by_provider',
  },
];

export type CommunicationHistoryDryRunRow = {
  source_row_id: string;
  channel: 'email' | 'whatsapp' | 'internal_email';
  direction: 'inbound' | 'outbound' | 'internal';
  occurred_at: string;
  contact_key?: string | null | undefined;
  household_key?: string | null | undefined;
  provider_reference?: string | null | undefined;
  idempotency_key?: string | null | undefined;
  state?: string | null | undefined;
  redacted_preview?: string | null | undefined;
  subject?: string | null | undefined;
  body?: string | null | undefined;
};

export type CommunicationHistoryDryRunInput = {
  account_key: string;
  product_key: string;
  source:
    'resend_export' | 'whatsapp_export' | 'stored_webhook_projection' | 'manual_redacted_fixture';
  rows: CommunicationHistoryDryRunRow[];
  known_contact_keys?: readonly string[] | undefined;
  known_household_keys?: readonly string[] | undefined;
};

export type CommunicationHistoryDryRunReport = {
  mode: 'dry_run';
  account_key: string;
  product_key: string;
  source: CommunicationHistoryDryRunInput['source'];
  totals: {
    rows_seen: number;
    importable_events: number;
    duplicate_rows: number;
    conflicts: number;
    unknown_contacts: number;
    unknown_households: number;
    unsafe_raw_body_rows: number;
    missing_history_rows: number;
    out_of_order_rows: number;
  };
  import_batch_fingerprint: string;
  event_fingerprints: string[];
  limitations: string[];
  conflicts: Array<{ source_row_id_digest: string; reason: string }>;
};

export function dryRunCommunicationHistoryBackfill(
  input: CommunicationHistoryDryRunInput,
): CommunicationHistoryDryRunReport {
  const contactKeys = new Set(input.known_contact_keys ?? []);
  const householdKeys = new Set(input.known_household_keys ?? []);
  const seen = new Set<string>();
  const eventFingerprints: string[] = [];
  const conflicts: CommunicationHistoryDryRunReport['conflicts'] = [];
  let duplicateRows = 0;
  let unknownContacts = 0;
  let unknownHouseholds = 0;
  let unsafeRawBodyRows = 0;
  let missingHistoryRows = 0;
  let outOfOrderRows = 0;
  let previousOccurredAt = '';

  for (const row of input.rows) {
    const fingerprint = rowFingerprint(input, row);
    const rowDigest = digest(row.source_row_id);
    const hasRawBody = hasUnsafeRawBody(row);
    const contactUnknown = Boolean(row.contact_key) && !contactKeys.has(String(row.contact_key));
    const householdUnknown =
      Boolean(row.household_key) && !householdKeys.has(String(row.household_key));
    let rowHasConflict = false;

    if (seen.has(fingerprint)) {
      duplicateRows += 1;
      conflicts.push({ source_row_id_digest: rowDigest, reason: 'duplicate_import_identity' });
      continue;
    }
    seen.add(fingerprint);

    if (hasRawBody) {
      unsafeRawBodyRows += 1;
      rowHasConflict = true;
      conflicts.push({ source_row_id_digest: rowDigest, reason: 'raw_body_or_subject_present' });
    }
    if (contactUnknown) {
      unknownContacts += 1;
      rowHasConflict = true;
      conflicts.push({ source_row_id_digest: rowDigest, reason: 'unknown_contact_key' });
    }
    if (householdUnknown) {
      unknownHouseholds += 1;
      rowHasConflict = true;
      conflicts.push({ source_row_id_digest: rowDigest, reason: 'unknown_household_key' });
    }
    if (row.state === 'history_unavailable') {
      missingHistoryRows += 1;
    }
    if (
      input.source === 'stored_webhook_projection' &&
      previousOccurredAt &&
      row.occurred_at < previousOccurredAt
    ) {
      outOfOrderRows += 1;
      rowHasConflict = true;
      conflicts.push({ source_row_id_digest: rowDigest, reason: 'out_of_order_webhook_row' });
    }
    previousOccurredAt = row.occurred_at;
    if (!rowHasConflict) {
      eventFingerprints.push(fingerprint);
    }
  }

  return {
    mode: 'dry_run',
    account_key: input.account_key,
    product_key: input.product_key,
    source: input.source,
    totals: {
      rows_seen: input.rows.length,
      importable_events: eventFingerprints.length,
      duplicate_rows: duplicateRows,
      conflicts: conflicts.length,
      unknown_contacts: unknownContacts,
      unknown_households: unknownHouseholds,
      unsafe_raw_body_rows: unsafeRawBodyRows,
      missing_history_rows: missingHistoryRows,
      out_of_order_rows: outOfOrderRows,
    },
    import_batch_fingerprint: digest(
      JSON.stringify({
        account_key: input.account_key,
        product_key: input.product_key,
        source: input.source,
        event_fingerprints: eventFingerprints,
      }),
    ),
    event_fingerprints: eventFingerprints,
    limitations: limitationsFor(input.source),
    conflicts,
  };
}

export function unavailableProviderHistoryReport(input: {
  account_key: string;
  product_key: string;
  provider: 'resend' | 'whatsapp';
  reason: string;
}): CommunicationHistoryDryRunReport {
  const row: CommunicationHistoryDryRunRow = {
    source_row_id: `${input.provider}:history_unavailable`,
    channel: input.provider === 'resend' ? 'email' : 'whatsapp',
    direction: input.provider === 'resend' ? 'outbound' : 'inbound',
    occurred_at: new Date(0).toISOString(),
    state: 'history_unavailable',
    redacted_preview: input.reason,
  };
  return dryRunCommunicationHistoryBackfill({
    account_key: input.account_key,
    product_key: input.product_key,
    source: input.provider === 'resend' ? 'resend_export' : 'whatsapp_export',
    rows: [row],
  });
}

function rowFingerprint(
  input: CommunicationHistoryDryRunInput,
  row: CommunicationHistoryDryRunRow,
) {
  return digest(
    JSON.stringify({
      account_key: input.account_key,
      product_key: input.product_key,
      source: input.source,
      source_row_id: row.source_row_id,
      channel: row.channel,
      direction: row.direction,
      occurred_at: row.occurred_at,
      contact_key: row.contact_key ?? null,
      household_key: row.household_key ?? null,
      provider_reference_digest: row.provider_reference ? digest(row.provider_reference) : null,
      idempotency_key: row.idempotency_key ?? null,
      state: row.state ?? null,
    }),
  );
}

function hasUnsafeRawBody(row: CommunicationHistoryDryRunRow) {
  return Boolean(row.body?.trim() || row.subject?.trim());
}

function limitationsFor(source: CommunicationHistoryDryRunInput['source']) {
  if (source === 'resend_export') {
    return [
      'Resend historical message bodies are not available unless a redacted export is supplied.',
      'Dry-run rows are fingerprints only; this report is not evidence of provider delivery.',
    ];
  }
  if (source === 'whatsapp_export') {
    return [
      'WhatsApp historical provider access is not assumed.',
      'Dry-run rows are fingerprints only; this report is not evidence of complete chat history.',
    ];
  }
  return ['Dry-run reports do not mutate production data or send messages.'];
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
