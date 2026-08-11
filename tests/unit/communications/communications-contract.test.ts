import { describe, expect, it } from 'vitest';
import {
  communicationsCapabilities,
  communicationsListResponseSchema,
  type CommunicationsListResponse,
} from '../../../packages/contracts/src/communications/index.ts';
import {
  communicationHistorySourceTruthMatrix,
  dryRunCommunicationHistoryBackfill,
  unavailableProviderHistoryReport,
} from '../../../packages/domain/src/communications/history-ingestion.ts';
import {
  CommunicationsCursorError,
  decodeCommunicationsCursor,
  encodeCommunicationsCursor,
  hashCursorFilters,
  hashCursorScope,
} from '../../../packages/domain/src/communications/cursor.ts';
import { maskCommunicationsRecipient } from '../../../packages/domain/src/communications/masking.ts';
import {
  normalizeCommunicationsEvent,
  normalizeCommunicationsStatus,
} from '../../../packages/domain/src/communications/normalize.ts';
import { parseCommunicationsFilters } from '../../../packages/domain/src/communications/service.ts';

const fixedNow = new Date('2026-07-14T12:00:00.000Z');

describe('Communications V1A contract', () => {
  it('normalizes only audited local truth labels', () => {
    expect(normalizeCommunicationsStatus({ status: 'pending' })).toEqual({
      localState: 'queued',
      stateLabel: 'Queued',
      stateAt: null,
    });
    expect(
      normalizeCommunicationsStatus({
        status: 'sink_delivered',
        deliveredAt: '2026-07-14T12:01:00.000Z',
      }),
    ).toEqual({
      localState: 'draft_saved',
      stateLabel: 'Processed in test mode, not delivery',
      stateAt: '2026-07-14T12:01:00.000Z',
    });
    expect(
      normalizeCommunicationsStatus({
        status: 'pending',
        eventType: 'crm_single_recipient_reply_draft.v1',
      }),
    ).toEqual({
      localState: 'draft_saved',
      stateLabel: 'Draft saved, provider off',
      stateAt: null,
    });
    expect(normalizeCommunicationsStatus({ status: 'delivered' })).toEqual({
      localState: 'delivered',
      stateLabel: 'Delivered',
      stateAt: null,
    });
    expect(normalizeCommunicationsStatus({ status: 'suppressed' })).toEqual({
      localState: 'suppressed',
      stateLabel: 'Suppressed',
      stateAt: null,
    });
  });

  it('does not use Sent or Delivered labels for sink processing', () => {
    const labels = [
      normalizeCommunicationsStatus({ status: 'pending' }).stateLabel,
      normalizeCommunicationsStatus({ status: 'sink_delivered' }).stateLabel,
    ].join(' ');
    expect(labels).not.toMatch(/\bSent\b|\bDelivered\b/);
  });

  it('maps only audited event/channel pairs to public intent labels', () => {
    expect(normalizeCommunicationsEvent('family_signup_email_ack.v1', 'email')).toMatchObject({
      intentType: 'family_signup_email_ack',
      label: 'Family signup email acknowledgement',
      channel: 'email',
    });
    expect(normalizeCommunicationsEvent('future_delivery.v1', 'email')).toMatchObject({
      intentType: 'internal_lead_alert',
      label: 'Communication intent unavailable',
      channel: 'email',
    });
    expect(normalizeCommunicationsEvent('whatsapp_inbound_message.v1', 'whatsapp')).toMatchObject({
      intentType: 'whatsapp_inbound_message',
      label: 'Stored WhatsApp inbound message',
      channel: 'whatsapp',
    });
  });

  it('masks recipients without leaking raw email, domain, phone, or owner alias', () => {
    const email = 'parent.person@example.test';
    const phone = '+1 (212) 555-7890';
    const owner = 'owner@example.test';
    const maskedEmail = maskCommunicationsRecipient({ channel: 'email', email });
    const maskedPhone = maskCommunicationsRecipient({ channel: 'whatsapp', phone });
    const maskedOwner = maskCommunicationsRecipient({ channel: 'internal_email', email: owner });
    expect(maskedEmail).toBe('Email recipient');
    expect(maskedEmail).not.toContain('parent.person');
    expect(maskedEmail).not.toContain('example.test');
    expect(maskedPhone).toBe('WhatsApp recipient ending 7890');
    expect(maskedPhone).not.toContain('212555');
    expect(maskedOwner).toBe('Internal owner');
    expect(maskedOwner).not.toContain(owner);
  });

  it('enforces bounded date filters and safe filter values', () => {
    expect(parseCommunicationsFilters({}, fixedNow)).toMatchObject({
      from: '2026-06-14T12:00:00.000Z',
      to: '2026-07-14T12:00:00.000Z',
      limit: 25,
    });
    expect(() => parseCommunicationsFilters({ from: fixedNow.toISOString() }, fixedNow)).toThrow(
      /Provide both/,
    );
    expect(() =>
      parseCommunicationsFilters(
        {
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-07-14T00:00:00.000Z',
        },
        fixedNow,
      ),
    ).toThrow(/90 days/);
    expect(() => parseCommunicationsFilters({ channel: 'sms' }, fixedNow)).toThrow(/Channel/);
    expect(() => parseCommunicationsFilters({ direction: 'sideways' }, fixedNow)).toThrow(
      /Direction/,
    );
    expect(() => parseCommunicationsFilters({ source: 'mailbox' }, fixedNow)).toThrow(/Source/);
  });

  it('seals cursors and rejects tampering, expiration, and binding mismatch', () => {
    const filters = {
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-14T00:00:00.000Z',
      limit: 25,
    };
    const token = encodeCommunicationsCursor('test-secret', {
      v: 1,
      mode: 'global',
      scope_hash: hashCursorScope('test-secret', ['one_time', 'one_time_mishnah_class']),
      filters_hash: hashCursorFilters('test-secret', filters),
      last_created_at: '2026-07-14T00:00:00.000Z',
      last_id: '00000000-0000-4000-8000-000000000001',
      expires_at: '2026-07-14T12:30:00.000Z',
    });
    expect(token).not.toContain('00000000-0000-4000-8000-000000000001');
    expect(decodeCommunicationsCursor('test-secret', token, fixedNow).last_id).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(() => decodeCommunicationsCursor('wrong-secret', token, fixedNow)).toThrow(
      CommunicationsCursorError,
    );
    const tokenParts = token.split('.');
    const tokenTag = tokenParts[3];
    if (!tokenTag) throw new Error('Expected an encoded cursor authentication tag.');
    const tamperedTag = `${tokenTag.startsWith('A') ? 'B' : 'A'}${tokenTag.slice(1)}`;
    const tamperedToken = [...tokenParts.slice(0, 3), tamperedTag].join('.');
    expect(() => decodeCommunicationsCursor('test-secret', tamperedToken, fixedNow)).toThrow(
      CommunicationsCursorError,
    );
    expect(() =>
      decodeCommunicationsCursor('test-secret', token, new Date('2026-07-14T12:31:00.000Z')),
    ).toThrow(CommunicationsCursorError);
  });

  it('validates the successful DTO shape and excludes mailbox truth', () => {
    const response: CommunicationsListResponse = {
      success: true,
      availability: 'available',
      source_scope: 'canonical_communication_history',
      mailbox_complete: false,
      capabilities: communicationsCapabilities,
      applied_filters: {
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-14T00:00:00.000Z',
        limit: 25,
      },
      items: [
        {
          event_id: 'outbox:test',
          thread_id: 'contact:contact_public_test:email',
          thread_label: 'Contact outbound history',
          channel: 'email',
          direction: 'outbound',
          intent_type: 'family_signup_email_ack',
          event_label: 'Family signup email acknowledgement',
          local_state: 'queued',
          state_label: 'Queued',
          source: 'local_outbox_intent',
          source_label: 'Local outbound intent',
          provenance: 'local_database',
          participant_kind: 'contact',
          participant_label: 'Linked contact',
          recipient_masked: 'Email recipient',
          queued_at: '2026-07-10T00:00:00.000Z',
          occurred_at: '2026-07-10T00:00:00.000Z',
          state_at: null,
          contact_path: '/app/crm/contacts/contact_public_test',
          household_path: null,
          preview_redacted: 'Outbound intent stored locally. Provider delivery is not implied.',
          provider_reference_digest: null,
          import_batch_key: null,
          idempotency_key: 'delivery_test',
          draft_only: false,
          transport_available: false,
        },
      ],
      next_cursor: null,
    };
    expect(communicationsListResponseSchema.parse(response)).toEqual(response);
    expect(JSON.stringify(response)).not.toContain('payload');
    expect(Object.keys(response.items[0] ?? {})).not.toContain('subject');
    expect(Object.keys(response.items[0] ?? {})).not.toContain('body');
  });

  it('dry-runs historical imports without exposing raw private bodies', () => {
    const report = dryRunCommunicationHistoryBackfill({
      account_key: 'one_time',
      product_key: 'one_time_mishnah_class',
      source: 'manual_redacted_fixture',
      known_contact_keys: ['contact_a'],
      rows: [
        {
          source_row_id: 'row-1',
          channel: 'email',
          direction: 'outbound',
          occurred_at: '2026-07-14T10:00:00.000Z',
          contact_key: 'contact_a',
          provider_reference: 'provider-secret-ish-reference',
          idempotency_key: 'message-1',
          redacted_preview: 'Redacted email event',
        },
        {
          source_row_id: 'row-2',
          channel: 'whatsapp',
          direction: 'inbound',
          occurred_at: '2026-07-14T11:00:00.000Z',
          contact_key: 'missing_contact',
          body: 'raw private message body must not survive',
        },
      ],
    });
    expect(report.totals).toMatchObject({
      rows_seen: 2,
      importable_events: 1,
      conflicts: 2,
      unknown_contacts: 1,
      unsafe_raw_body_rows: 1,
    });
    expect(JSON.stringify(report)).not.toContain('raw private message body');
    expect(JSON.stringify(report)).not.toContain('provider-secret-ish-reference');
  });

  it('records provider-history limitations as a truth source, not an empty inbox', () => {
    const report = unavailableProviderHistoryReport({
      account_key: 'one_time',
      product_key: 'one_time_mishnah_class',
      provider: 'resend',
      reason: 'No historical Resend export was supplied.',
    });
    expect(report.totals.missing_history_rows).toBe(1);
    expect(communicationHistorySourceTruthMatrix.map((row) => row.kind)).toContain(
      'unavailable_unprovable_history',
    );
    expect(JSON.stringify(report)).toContain('not evidence of provider delivery');
  });

  it('flags out-of-order stored webhook dry-run rows without importing them', () => {
    const report = dryRunCommunicationHistoryBackfill({
      account_key: 'one_time',
      product_key: 'one_time_mishnah_class',
      source: 'stored_webhook_projection',
      known_contact_keys: ['contact_a'],
      rows: [
        {
          source_row_id: 'later',
          channel: 'whatsapp',
          direction: 'inbound',
          occurred_at: '2026-07-14T12:00:00.000Z',
          contact_key: 'contact_a',
        },
        {
          source_row_id: 'earlier',
          channel: 'whatsapp',
          direction: 'inbound',
          occurred_at: '2026-07-14T11:00:00.000Z',
          contact_key: 'contact_a',
        },
      ],
    });
    expect(report.totals.out_of_order_rows).toBe(1);
    expect(report.totals.importable_events).toBe(1);
    expect(report.conflicts.map((conflict) => conflict.reason)).toContain(
      'out_of_order_webhook_row',
    );
  });
});
