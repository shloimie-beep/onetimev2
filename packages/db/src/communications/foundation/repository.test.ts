import { describe, expect, it, vi } from 'vitest';
import type { CommunicationChannelPlan } from '../../../../contracts/src/communications/foundation/index.ts';
import {
  createPostgresCommunicationFoundationRepository,
  type CommunicationFoundationSqlClient,
} from './index.ts';

describe('P28 parameterized communication repository', () => {
  it('fences preference and decision projections and uses a unique delivery reservation', async () => {
    const calls: { text: string; values: readonly unknown[] }[] = [];
    const client: CommunicationFoundationSqlClient = {
      query: vi.fn(async (text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const repository = createPostgresCommunicationFoundationRepository({
      connect: async () => client,
    });
    expect(
      await repository.saveReminderPreference({
        adult_id: 'adult-1',
        preference: 'whatsapp',
        expected_version: 2,
      }),
    ).toBe(true);
    const plan: CommunicationChannelPlan = {
      operation_id: 'message-1',
      adult_id: 'adult-1',
      purpose: 'optional_reminder',
      reminder_preference: 'whatsapp',
      email: {
        disposition: 'send',
        provider: 'GHL',
        suppression_recheck_required: true,
      },
      whatsapp: {
        disposition: 'channel_skipped_not_configured',
        provider_calls: 0,
        truthful_status: 'WhatsApp is unavailable; email remains active',
      },
      essential_email_cannot_be_disabled: false,
      whatsapp_provider_calls: 0,
    };
    expect(
      await repository.persistDecision({
        record: {
          operation_id: 'message-1',
          adult_id: 'adult-1',
          purpose: 'optional_reminder',
          plan,
          suppression_snapshot_id: 'suppression-1',
          status: 'planned',
        },
        expected_version: 0,
      }),
    ).toBe(true);
    expect(
      await repository.reserveEmailDelivery({
        operation_id: 'message-1',
        suppression_snapshot_id: 'suppression-2',
      }),
    ).toBe(true);
    expect(calls.every(({ values }) => values.length > 0)).toBe(true);
    expect(calls.every(({ text }) => !text.includes('CREATE TABLE'))).toBe(true);
    expect(calls.some(({ text }) => text.includes('version = $4'))).toBe(true);
    expect(calls.some(({ text }) => text.includes('ON CONFLICT (operation_id, channel)'))).toBe(
      true,
    );
  });
});
