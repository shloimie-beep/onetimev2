import { describe, expect, it } from 'vitest';
import {
  whatsappConversationStates,
  whatsappIntentTypes,
} from '../../../packages/contracts/src/index.ts';
import { compileWhatsAppIntent } from '../../../packages/domain/src/index.ts';

describe('OT-85 WhatsApp intent and state contract', () => {
  it('keeps the packet state and intent enums stable', () => {
    expect(whatsappConversationStates).toEqual([
      'PUBLIC_IDLE',
      'QUALIFY_AUDIENCE',
      'CAPTURE_GUARDIAN_NAME',
      'CAPTURE_SCHOOL_CONTACT_NAME',
      'CAPTURE_CONTACT_PREFERENCE',
      'CAPTURE_FAMILY_REMINDER_PREFERENCE',
      'FAMILY_PERSIST_PENDING',
      'SCHOOL_PERSIST_PENDING',
      'HUMAN_HANDOFF_PENDING',
      'ACCOUNT_LINK_OFFERED',
      'ACCOUNT_LINK_PENDING',
      'ACCOUNT_LINKED',
      'SUPPRESSED',
      'CLOSED',
    ]);
    expect(whatsappIntentTypes).toContain('account.private_data_request');
    expect(whatsappIntentTypes).toContain('consent.stop');
  });

  it('classifies STOP and START before ordinary conversation handling', () => {
    expect(compileWhatsAppIntent('STOP').type).toBe('consent.stop');
    expect(compileWhatsAppIntent('start please').type).toBe('consent.start');
  });

  it('blocks private, class-link, billing, CRM, and technical-ticket requests', () => {
    const privateIntent = compileWhatsAppIntent('Can you send my child class link and billing?');
    expect(privateIntent.type).toBe('account.private_data_request');
    expect(privateIntent.safety.private_data_requested).toBe(true);

    const ticket = compileWhatsAppIntent('I cannot log in, create a support ticket');
    expect(ticket.type).toBe('account.technical_help_request');
    expect(ticket.safety.technical_ticket_requested).toBe(true);
  });

  it('uses context for lead field capture without dynamic dispatch', () => {
    expect(compileWhatsAppIntent('Miriam Parent', { expected: 'guardian_name' })).toMatchObject({
      type: 'lead.guardian_name',
      entities: [{ kind: 'person_name', value: 'Miriam Parent' }],
    });
    expect(
      compileWhatsAppIntent('WhatsApp is best', { expected: 'contact_preference' }),
    ).toMatchObject({
      type: 'lead.contact_preference',
      entities: [{ kind: 'contact_preference', value: 'whatsapp' }],
    });
  });

  it('falls back to unknown below the packet confidence threshold', () => {
    const unknown = compileWhatsAppIntent('...');
    expect(unknown.confidence).toBeLessThan(0.72);
    expect(unknown.type).toBe('conversation.unknown');
  });
});
