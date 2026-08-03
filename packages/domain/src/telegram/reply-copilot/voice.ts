import { createHash } from 'node:crypto';
import {
  NO_SUGGESTION_REVIEW_REQUIRED,
  REPLY_COPILOT_MODEL_VERSION,
  REPLY_COPILOT_PROMPT_VERSION,
  type NormalizedGhlInboundEmail,
  type ReplyCopilotRoutingDecision,
  type ReplyCopilotSuggestion,
  type ReplyCopilotVoiceExample,
} from '../../../../contracts/src/telegram/reply-copilot.ts';
import {
  CANONICAL_COPY_CATALOG,
  COPY_CATALOG_SEMANTIC_VERSION,
} from '../../communications/copy/catalog.ts';

export const RABBI_REPLY_VOICE_PROFILE = Object.freeze({
  version: `rabbi-reply-${COPY_CATALOG_SEMANTIC_VERSION}`,
  style: [
    'first-person',
    'direct',
    'conversational',
    'concrete',
    'short-paragraphs',
    'natural-torah-language-when-grounded',
  ] as const,
  groundedThemes: [
    'text on screen and color coding',
    'pictures and presentations',
    'stories, dialogue, mnemonics, and everyday examples',
    'questions and active participation',
    'review sheets, summaries, and quizzes',
    'serious preparation',
    'covering ground while understanding and remembering',
  ] as const,
  prohibited: [
    'halachic rulings',
    'invented Student facts',
    'promises',
    'invented dates, pricing, access state, or provider state',
    'world-famous claims',
    'claims of an exact historical newsletter voice',
  ] as const,
  approvedExampleIds: CANONICAL_COPY_CATALOG.filter(
    (entry) => entry.sender === 'rabbi_campaign' || entry.sender === 'rabbi_personal',
  ).map((entry) => entry.id),
});

const REVIEW_REQUIRED =
  /\b(psak|pasken|halachic ruling|permitted|forbidden|legal|lawyer|privacy|safety|abuse|refund|price|pricing|charge|payment|password|access state|account status|promise|guarantee)\b/i;
const GROUNDED_METHOD =
  /\b(color|colour|picture|presentation|story|dialogue|mnemonic|example|question|participation|review sheet|summary|quiz|remember|understand)\b/i;

export function suggestReplyCopilotResponse(input: {
  inbound: NormalizedGhlInboundEmail;
  routing: ReplyCopilotRoutingDecision;
}): ReplyCopilotSuggestion {
  const content = `${input.inbound.subject}\n${input.inbound.body}`;
  if (
    REVIEW_REQUIRED.test(content) ||
    input.routing.reasonCode === 'sensitive_admin' ||
    input.routing.reasonCode === 'generic_or_low_confidence'
  ) {
    return suggestion(NO_SUGGESTION_REVIEW_REQUIRED, 'review_required');
  }

  if (input.routing.route === 'RABBI') {
    if (GROUNDED_METHOD.test(content)) {
      return suggestion(
        'Thank you for asking. I use the text on screen, color coding, pictures, stories, questions, and review so the boys can understand the Mishnah and remember what they learned. I prepare the class carefully so we can cover ground without losing clarity.',
        'suggested',
      );
    }
    return suggestion(
      'Thank you for writing. I want to answer the exact learning question carefully. Please include the masechta, perek, and Mishnah you are asking about, and I’ll take a look.',
      'suggested',
    );
  }

  if (input.routing.reasonCode === 'access_or_signup') {
    return suggestion(
      'Thanks for letting us know. I’m going to check the account details and follow up with the next step.',
      'suggested',
    );
  }
  if (input.routing.reasonCode === 'billing_or_subscription') {
    return suggestion(NO_SUGGESTION_REVIEW_REQUIRED, 'review_required');
  }
  if (input.routing.reasonCode === 'schedule_or_technical') {
    return suggestion(
      'Thanks for the details. I’m going to check the class and technical setup and follow up once I have the exact answer.',
      'suggested',
    );
  }
  return suggestion(
    'Thanks for writing. I’m reviewing this and will follow up with the right information.',
    'suggested',
  );
}

export function proposeRabbiVoiceProfileRevision(
  examples: readonly ReplyCopilotVoiceExample[],
  minimumApprovedExamples = 12,
) {
  const eligible = examples.filter(
    (example) =>
      example.approvedForVoice &&
      (example.outcome === 'accepted_exact' || example.outcome === 'edited'),
  );
  if (eligible.length < minimumApprovedExamples) return null;
  const evidenceDigest = sha256(
    eligible
      .map((example) => `${example.messageClass}:${example.finalDigest}:${example.outcome}`)
      .sort()
      .join('\n'),
  );
  return {
    proposalKey: `voice_profile_proposal_${evidenceDigest.slice(0, 24)}`,
    baseVersion: RABBI_REPLY_VOICE_PROFILE.version,
    proposedVersion: `${RABBI_REPLY_VOICE_PROFILE.version}-proposal-${evidenceDigest.slice(0, 8)}`,
    evidenceDigest,
    approvedExampleCount: eligible.length,
    status: 'awaiting_explicit_admin_approval' as const,
    autoPromoted: false as const,
    rollbackVersion: RABBI_REPLY_VOICE_PROFILE.version,
  };
}

function suggestion(text: string, state: ReplyCopilotSuggestion['state']): ReplyCopilotSuggestion {
  return {
    state,
    text,
    digest: sha256(text),
    promptVersion: REPLY_COPILOT_PROMPT_VERSION,
    modelVersion: REPLY_COPILOT_MODEL_VERSION,
    voiceProfileVersion: RABBI_REPLY_VOICE_PROFILE.version,
  };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
