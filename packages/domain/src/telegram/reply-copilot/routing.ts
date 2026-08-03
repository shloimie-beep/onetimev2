import {
  REPLY_COPILOT_ROUTE_TABLE_VERSION,
  type NormalizedGhlInboundEmail,
  type ReplyCopilotRoute,
  type ReplyCopilotRoutingDecision,
} from '../../../../contracts/src/telegram/reply-copilot.ts';

const ADMINISTRATIVE_RULES: ReadonlyArray<Readonly<{ code: string; pattern: RegExp }>> = [
  {
    code: 'access_or_signup',
    pattern: /\b(sign[ -]?up|register|access|login|log in|password|account|portal|username)\b/i,
  },
  {
    code: 'billing_or_subscription',
    pattern:
      /\b(bill(?:ing)?|refund|charge|payment|price|pricing|subscription|cancel(?:lation)?)\b/i,
  },
  {
    code: 'schedule_or_technical',
    pattern:
      /\b(schedule|time ?zone|device|zoom|technical|tech support|browser|microphone|camera|link (?:is|isn't|doesn't)|not working)\b/i,
  },
  {
    code: 'administration_or_delivery',
    pattern: /\b(dns|email delivery|deliverability|administration|admin|unsubscribe|spam)\b/i,
  },
  {
    code: 'sensitive_admin',
    pattern:
      /\b(complaint|legal|lawyer|privacy|data request|safety|abuse|harass|threat|emergency)\b/i,
  },
];

const RABBI_RULES: ReadonlyArray<Readonly<{ code: string; pattern: RegExp }>> = [
  {
    code: 'torah_or_mishnah_content',
    pattern:
      /\b(mishnah|mishna|mishnayos|torah|halach(?:a|ah|ic)|perek|masech(?:es|ta)|sugya|gemara|pasuk|rashi)\b/i,
  },
  {
    code: 'teaching_content',
    pattern:
      /\b(what (?:was|did you) teach|lesson|shiur|class content|learner'?s? question|learning question|explain|meaning of|understand|remember|review sheet|quiz(?:zes)?|mnemonic|color coding|colour coding)\b/i,
  },
  {
    code: 'rabbi_authorship_required',
    pattern:
      /\b(rabbi(?:'s)? (?:answer|view|voice)|ask (?:the )?rabbi|rabbi.*approve|torah answer)\b/i,
  },
];

export function routeReplyCopilotInbound(
  inbound: NormalizedGhlInboundEmail,
  aiSuggestion?: Readonly<{ route: ReplyCopilotRoute; confidence: number }>,
): ReplyCopilotRoutingDecision {
  const combined = `${inbound.subject}\n${inbound.body}`;
  for (const rule of ADMINISTRATIVE_RULES) {
    if (rule.pattern.test(combined)) return decision('SHLOIMIE', rule.code, true, 'hard_rule');
  }
  for (const rule of RABBI_RULES) {
    if (rule.pattern.test(combined)) return decision('RABBI', rule.code, false, 'hard_rule');
  }
  if (recipientAddress(inbound.to) === 'info@onetimeonetime.com') {
    return decision('SHLOIMIE', 'info_default', true, 'hard_rule');
  }
  if (aiSuggestion?.route === 'RABBI' && aiSuggestion.confidence >= 0.85) {
    return decision('RABBI', 'ai_high_confidence_unprotected', false, 'low');
  }
  return decision('SHLOIMIE', 'generic_or_low_confidence', false, 'low');
}

export function messageClassForRouting(decision: ReplyCopilotRoutingDecision) {
  return decision.reasonCode;
}

function decision(
  route: ReplyCopilotRoute,
  reasonCode: string,
  protectedAdministrativeClass: boolean,
  confidence: 'hard_rule' | 'low',
): ReplyCopilotRoutingDecision {
  return {
    route,
    reasonCode,
    protectedAdministrativeClass,
    confidence,
    routeTableVersion: REPLY_COPILOT_ROUTE_TABLE_VERSION,
  };
}

function recipientAddress(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/i)?.[0]?.toLowerCase() ?? value.toLowerCase();
}
