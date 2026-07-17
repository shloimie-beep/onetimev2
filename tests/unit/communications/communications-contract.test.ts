import { describe, expect, it } from 'vitest';
import {
  communicationsListResponseSchema,
  type CommunicationsListResponse,
} from '../../../packages/contracts/src/communications/index.ts';
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
    expect(normalizeCommunicationsStatus({ status: 'delivered' })).toEqual({
      localState: 'delivered',
      stateLabel: 'Delivered',
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
    expect(() =>
      decodeCommunicationsCursor('test-secret', `${token.slice(0, -2)}aa`, fixedNow),
    ).toThrow(CommunicationsCursorError);
    expect(() =>
      decodeCommunicationsCursor('test-secret', token, new Date('2026-07-14T12:31:00.000Z')),
    ).toThrow(CommunicationsCursorError);
  });

  it('validates the successful DTO shape and excludes mailbox truth', () => {
    const response: CommunicationsListResponse = {
      success: true,
      availability: 'available',
      source_scope: 'local_communication_intents_only',
      mailbox_complete: false,
      capabilities: {
        read: true,
        provider_acceptance: false,
        provider_delivery: false,
        inbound_import: false,
        replies: true,
        threads: false,
        subject_body_access: false,
        attachments: false,
        reminder_execution: false,
        compose: true,
        resend: false,
        campaigns: false,
        templates: false,
        integration_settings: false,
        channels: ['email'],
        intent_types: ['family_signup_email_ack'],
        local_states: ['queued', 'draft_saved', 'unknown'],
      },
      applied_filters: {
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-14T00:00:00.000Z',
        limit: 25,
      },
      items: [
        {
          channel: 'email',
          intent_type: 'family_signup_email_ack',
          event_label: 'Family signup email acknowledgement',
          local_state: 'queued',
          state_label: 'Queued',
          recipient_masked: 'Email recipient',
          queued_at: '2026-07-10T00:00:00.000Z',
          state_at: null,
          contact_path: '/app/crm/contacts/contact_public_test',
        },
      ],
      next_cursor: null,
    };
    expect(communicationsListResponseSchema.parse(response)).toEqual(response);
    expect(JSON.stringify(response)).not.toContain('payload');
    expect(Object.keys(response.items[0] ?? {})).not.toContain('subject');
    expect(Object.keys(response.items[0] ?? {})).not.toContain('body');
  });
});
