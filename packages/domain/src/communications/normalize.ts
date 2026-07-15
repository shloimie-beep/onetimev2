import type {
  CommunicationsChannel,
  CommunicationsIntentType,
  CommunicationsLocalState,
} from '../../../contracts/src/communications/index.ts';

export const communicationsEventMap: Record<
  string,
  { intentType: CommunicationsIntentType; label: string; channel: CommunicationsChannel }
> = {
  'family_signup_email_ack.v1': {
    intentType: 'family_signup_email_ack',
    label: 'Family signup email acknowledgement',
    channel: 'email',
  },
  'family_signup_whatsapp_confirmation.v1': {
    intentType: 'family_signup_whatsapp_confirmation',
    label: 'Family signup WhatsApp confirmation',
    channel: 'whatsapp',
  },
  internal_lead_alert: {
    intentType: 'internal_lead_alert',
    label: 'Internal owner alert',
    channel: 'internal_email',
  },
};

export type NormalizedOutboxStatus = {
  localState: CommunicationsLocalState;
  stateLabel: string;
  stateAt: string | null;
};

export function normalizeCommunicationsStatus(input: {
  status: string | null | undefined;
  deliveredAt?: string | Date | null | undefined;
}): NormalizedOutboxStatus {
  if (input.status === 'pending') {
    return { localState: 'intent_queued', stateLabel: 'Queued locally', stateAt: null };
  }
  if (input.status === 'sink_delivered') {
    return {
      localState: 'sink_processed',
      stateLabel: 'Processed in test mode',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  return { localState: 'status_unavailable', stateLabel: 'Status unavailable', stateAt: null };
}

export function normalizeCommunicationsEvent(
  eventType: string,
  channel: string,
): {
  intentType: CommunicationsIntentType;
  label: string;
  channel: CommunicationsChannel;
} {
  const mapped = communicationsEventMap[eventType];
  if (mapped && mapped.channel === channel) return mapped;
  return {
    intentType: 'internal_lead_alert' as const,
    label: 'Communication intent unavailable',
    channel: isCommunicationsChannel(channel) ? channel : 'internal_email',
  };
}

export function eventTypeForIntent(intentType: CommunicationsIntentType) {
  for (const [eventType, mapped] of Object.entries(communicationsEventMap)) {
    if (mapped.intentType === intentType) return eventType;
  }
  return null;
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isCommunicationsChannel(value: string): value is CommunicationsChannel {
  return value === 'email' || value === 'whatsapp' || value === 'internal_email';
}
