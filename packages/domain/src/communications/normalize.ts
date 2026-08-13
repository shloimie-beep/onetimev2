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
  'crm_single_recipient_reply_draft.v1': {
    intentType: 'single_recipient_reply',
    label: 'Single-recipient reply draft',
    channel: 'email',
  },
  'account_password_reset.v1': {
    intentType: 'password_reset',
    label: 'Password reset email',
    channel: 'email',
  },
  'account_activation.v1': {
    intentType: 'account_activation',
    label: 'Account setup email',
    channel: 'email',
  },
  'student_pin_setup.v1': {
    intentType: 'student_pin_setup',
    label: 'Student PIN setup email',
    channel: 'email',
  },
  'student_pin_reset.v1': {
    intentType: 'student_pin_reset',
    label: 'Student PIN reset email',
    channel: 'email',
  },
  'whatsapp_inbound_message.v1': {
    intentType: 'whatsapp_inbound_message',
    label: 'Stored WhatsApp inbound message',
    channel: 'whatsapp',
  },
  'whatsapp_provider_delivery_event.v1': {
    intentType: 'whatsapp_provider_event',
    label: 'Stored WhatsApp provider status',
    channel: 'whatsapp',
  },
  'historical_import_event.v1': {
    intentType: 'historical_import_event',
    label: 'Historical communication import event',
    channel: 'email',
  },
  'history_unavailable.v1': {
    intentType: 'history_unavailable',
    label: 'Historical provider history unavailable',
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
  eventType?: string | undefined;
}): NormalizedOutboxStatus {
  if (input.eventType === 'crm_single_recipient_reply_draft.v1') {
    return {
      localState: 'draft_saved',
      stateLabel: 'Draft saved, provider off',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'pending') {
    return { localState: 'queued', stateLabel: 'Queued', stateAt: null };
  }
  if (input.status === 'provider_accepted') {
    return {
      localState: 'provider_accepted',
      stateLabel: 'Provider accepted',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'sent') {
    return { localState: 'provider_sent', stateLabel: 'Provider sent', stateAt: null };
  }
  if (input.status === 'delivered') {
    return {
      localState: 'delivered',
      stateLabel: 'Delivered',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'read') {
    return {
      localState: 'read',
      stateLabel: 'Read',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'durable' || input.status === 'received') {
    return { localState: 'received', stateLabel: 'Stored inbound', stateAt: null };
  }
  if (input.status === 'processed') {
    return { localState: 'processed', stateLabel: 'Processed locally', stateAt: null };
  }
  if (input.status === 'sink_delivered') {
    return {
      localState: 'sink_delivered',
      stateLabel: 'Processed by non-provider sink',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'failed') {
    return {
      localState: 'failed',
      stateLabel: 'Failed',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'bounced') {
    return {
      localState: 'bounced',
      stateLabel: 'Bounced',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'complained') {
    return {
      localState: 'complained',
      stateLabel: 'Complained',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'suppressed') {
    return { localState: 'suppressed', stateLabel: 'Suppressed', stateAt: null };
  }
  if (input.status === 'duplicate') {
    return { localState: 'duplicate', stateLabel: 'Duplicate ignored', stateAt: null };
  }
  if (input.status === 'retrying') {
    return {
      localState: 'retrying',
      stateLabel: 'Retry scheduled',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'expired') {
    return {
      localState: 'expired',
      stateLabel: 'Expired before delivery',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'superseded') {
    return {
      localState: 'superseded',
      stateLabel: 'Superseded by a newer link',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'provider_off') {
    return {
      localState: 'provider_off',
      stateLabel: 'Provider delivery off',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'cleared') {
    return {
      localState: 'cleared',
      stateLabel: 'Sensitive payload cleared',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  if (input.status === 'history_unavailable') {
    return {
      localState: 'history_unavailable',
      stateLabel: 'Provider history unavailable',
      stateAt: null,
    };
  }
  if (input.status === 'sink_delivered') {
    return {
      localState: 'draft_saved',
      stateLabel: 'Processed in test mode, not delivery',
      stateAt: input.deliveredAt ? toIso(input.deliveredAt) : null,
    };
  }
  return { localState: 'unknown', stateLabel: 'Unknown', stateAt: null };
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
  if (
    mapped &&
    (mapped.channel === channel || eventType === 'crm_single_recipient_reply_draft.v1')
  ) {
    return { ...mapped, channel: isCommunicationsChannel(channel) ? channel : mapped.channel };
  }
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
