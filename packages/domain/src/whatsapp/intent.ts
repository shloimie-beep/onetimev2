import {
  whatsappCompiledIntentSchema,
  type WhatsAppCompiledIntent,
  type WhatsAppIntentType,
} from '../../../contracts/src/index.ts';

const CONFIDENT = 0.94;
const MEDIUM = 0.82;
const LOW = 0.68;
const THRESHOLD = 0.72;

export function compileWhatsAppIntent(
  text: string,
  context: {
    expected?:
      'guardian_name' | 'school_contact_name' | 'contact_preference' | 'reminder_preference';
  } = {},
): WhatsAppCompiledIntent {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const lower = trimmed.toLowerCase();

  if (!trimmed) return intent('conversation.unknown', LOW);

  if (matches(lower, ['stop', 'unsubscribe', 'opt out', 'cancel messages', 'do not text'])) {
    return intent('consent.stop', CONFIDENT);
  }

  if (matches(lower, ['start', 'resume', 'unstop', 'subscribe again'])) {
    return intent('consent.start', CONFIDENT);
  }

  if (/(stupid|idiot|kill|hate you|shut up|spam bot)/i.test(trimmed)) {
    return intent('abuse.detected', MEDIUM, {
      safety: { abuse_detected: true },
    });
  }

  if (/(link my account|connect my account|verify me|login to whatsapp)/i.test(trimmed)) {
    return intent('account.link_request', CONFIDENT, {
      safety: { account_link_requested: true },
    });
  }

  if (/(am i registered|did you get me|safe status)/i.test(trimmed)) {
    return intent('account.safe_status_request', CONFIDENT, {
      safety: { private_data_requested: true },
    });
  }

  if (
    /(class\s*link|zoom|recording|child|student|kid|learner|billing|payment|invoice|crm|ticket|portal|password|account details|my info|my data)/i.test(
      trimmed,
    )
  ) {
    const technicalOnly =
      /(broken|error|can't log in|cant log in|technical|support ticket|ticket)/i.test(trimmed) &&
      !/(class\s*link|zoom|recording|child|student|kid|learner|billing|payment|invoice|crm|my info|my data)/i.test(
        trimmed,
      );
    if (technicalOnly) {
      return intent('account.technical_help_request', CONFIDENT, {
        safety: { technical_ticket_requested: true },
      });
    }
    return intent('account.private_data_request', CONFIDENT, {
      safety: { private_data_requested: true },
    });
  }

  if (context.expected === 'contact_preference') {
    const preference = contactPreference(lower);
    if (preference) {
      return intent('lead.contact_preference', CONFIDENT, {
        entities: [{ kind: 'contact_preference', value: preference, confidence: CONFIDENT }],
      });
    }
  }

  if (context.expected === 'reminder_preference') {
    const reminder = reminderPreference(lower);
    if (reminder) {
      return intent('lead.reminder_preference', CONFIDENT, {
        entities: [{ kind: 'reminder_preference', value: reminder, confidence: CONFIDENT }],
      });
    }
  }

  if (context.expected === 'guardian_name') {
    const person = extractName(trimmed);
    if (person) {
      return intent('lead.guardian_name', CONFIDENT, {
        entities: [{ kind: 'person_name', value: person, confidence: CONFIDENT }],
      });
    }
  }

  if (context.expected === 'school_contact_name') {
    const person = extractName(trimmed);
    if (person) {
      return intent('lead.school_contact_name', CONFIDENT, {
        entities: [{ kind: 'person_name', value: person, confidence: CONFIDENT }],
      });
    }
  }

  const explicitPreference = contactPreference(lower);
  if (explicitPreference) {
    return intent('lead.contact_preference', MEDIUM, {
      entities: [{ kind: 'contact_preference', value: explicitPreference, confidence: MEDIUM }],
    });
  }

  const explicitReminder = reminderPreference(lower);
  if (explicitReminder) {
    return intent('lead.reminder_preference', MEDIUM, {
      entities: [{ kind: 'reminder_preference', value: explicitReminder, confidence: MEDIUM }],
    });
  }

  if (/(human|person|rabbi|call me|speak to someone|follow up)/i.test(trimmed)) {
    return intent('human.request', CONFIDENT);
  }

  if (/(school|yeshiva|principal|teacher|classroom|institution|program for our)/i.test(trimmed)) {
    const schoolName = extractSchoolName(trimmed);
    return intent('lead.school_interest', CONFIDENT, {
      entities: schoolName
        ? [{ kind: 'school_name', value: schoolName, confidence: MEDIUM }]
        : [{ kind: 'audience', value: 'school', confidence: CONFIDENT }],
    });
  }

  if (/(family|parent|guardian|my child|my kids|sign up|register|join|interested)/i.test(trimmed)) {
    return intent('lead.family_interest', CONFIDENT, {
      entities: [{ kind: 'audience', value: 'family', confidence: CONFIDENT }],
    });
  }

  if (/(hi|hello|shalom|hey|good morning|good afternoon|good evening)\b/i.test(trimmed)) {
    return intent('conversation.greeting', MEDIUM);
  }

  if (/(what|who|when|where|how|program|mishnah|mishnayos|whatsapp)/i.test(trimmed)) {
    return intent('program.question', MEDIUM);
  }

  return intent('conversation.unknown', LOW);
}

function intent(
  type: WhatsAppIntentType,
  confidence: number,
  override: {
    entities?: WhatsAppCompiledIntent['entities'];
    safety?: Partial<WhatsAppCompiledIntent['safety']>;
  } = {},
) {
  const actualType = confidence < THRESHOLD ? 'conversation.unknown' : type;
  return whatsappCompiledIntentSchema.parse({
    type: actualType,
    confidence,
    deterministic: true,
    entities: override.entities ?? [],
    safety: {
      private_data_requested: false,
      technical_ticket_requested: false,
      account_link_requested: false,
      abuse_detected: false,
      ...override.safety,
    },
  });
}

function matches(lower: string, exactOrPhrase: readonly string[]) {
  return exactOrPhrase.some((phrase) => lower === phrase || lower.includes(phrase));
}

function contactPreference(lower: string) {
  if (/(email|e-mail)/.test(lower)) return 'email';
  if (/(whatsapp|text|message)/.test(lower)) return 'whatsapp';
  if (/(phone|call)/.test(lower)) return 'phone';
  if (/(human|person|rabbi)/.test(lower)) return 'human';
  return null;
}

function reminderPreference(lower: string) {
  if (
    /^(yes|y|sure|ok|okay)\b/.test(lower) ||
    /remind me|send reminder|whatsapp reminder/.test(lower)
  ) {
    return 'whatsapp';
  }
  if (/^(no|n|not now|none)\b/.test(lower) || /no reminder|do not remind/.test(lower)) {
    return 'none';
  }
  return null;
}

function extractName(text: string) {
  const stripped = text
    .replace(/^(my name is|this is|i am|i'm|name:)\s+/i, '')
    .replace(/[^\p{L}\p{M}\s.'-]/gu, '')
    .trim();
  if (!stripped || stripped.length < 2 || stripped.length > 120) return null;
  if (/^(yes|no|whatsapp|email|phone|call|school|family)$/i.test(stripped)) return null;
  return stripped;
}

function extractSchoolName(text: string) {
  const match = /(school|yeshiva|institution)\s+(?:is\s+)?(?<name>[A-Za-z0-9 .'-]{2,120})/i.exec(
    text,
  );
  return match?.groups?.name?.trim() ?? null;
}
