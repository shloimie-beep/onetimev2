const patterns: Array<{ marker: string; pattern: RegExp }> = [
  {
    marker: '[REDACTED:jwt]',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    marker: '[REDACTED:secret]',
    pattern:
      /\b(?:password|passwd|pwd|secret|token|api[_-]?key|cookie|session|authorization)\s*[:=]\s*[^\s"'<>]{3,}/gi,
  },
  {
    marker: '[REDACTED:email]',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    marker: '[REDACTED:card]',
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
  },
  {
    marker: '[REDACTED:phone]',
    pattern: /(?<![A-Za-z0-9])(?:\+?\d[\d .()/-]{7,}\d)(?![A-Za-z0-9])/g,
  },
  {
    marker: '[REDACTED:address]',
    pattern:
      /\b\d{1,6}\s+[A-Za-z0-9.' -]{2,60}\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|boulevard|blvd)\b/gi,
  },
];

export type RedactionResult = {
  text: string;
  changed: boolean;
  count: number;
};

export function redactSupportText(value: string): RedactionResult {
  let text = value;
  let count = 0;
  for (const { marker, pattern } of patterns) {
    text = text.replace(pattern, () => {
      count += 1;
      return marker;
    });
  }
  return { text, changed: count > 0, count };
}

export function supportPrivacy(fields: string[], redactionCount: number) {
  return {
    redaction_policy: 'ot89-redaction-v1' as const,
    content_state: 'sanitized_user_text' as const,
    contains_raw_secrets: false as const,
    contains_direct_contact_details: false as const,
    redacted_fields: [...new Set(fields)] as Array<
      | 'ticket.title'
      | 'ticket.message'
      | 'ticket.issue_details.steps_to_reproduce'
      | 'ticket.issue_details.expected_behavior'
      | 'ticket.issue_details.actual_behavior'
      | 'attachments.normalized_filename'
    >,
    redaction_count: Math.min(redactionCount, 1000),
  };
}
