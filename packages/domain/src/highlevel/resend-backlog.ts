import { stableDigest } from './normalization.ts';

export type ResendBacklogMessageRef = {
  messageId: string;
  from: string;
  subject: string;
  receivedAt: string;
  hasAttachments: boolean;
  bodyDigest?: string | undefined;
};

export type ResendBacklogInventoryRow = {
  messageIdHash: string;
  senderDomain: string;
  date: string;
  classification: 'lead_parent' | 'support' | 'internal' | 'spam' | 'newsletter' | 'unknown';
  hasAttachments: boolean;
};

export function classifyResendBacklogMessage(input: ResendBacklogMessageRef) {
  const subject = input.subject.toLowerCase();
  const from = input.from.toLowerCase();
  if (from.endsWith('@onetimeonetime.com')) return 'internal' as const;
  if (/\b(unsubscribe|newsletter|digest)\b/.test(subject)) return 'newsletter' as const;
  if (/\b(viagra|crypto|lottery|winner)\b/.test(subject)) return 'spam' as const;
  if (/\b(help|support|bug|login|access)\b/.test(subject)) return 'support' as const;
  if (/\b(sign ?up|parent|mishnah|class|join)\b/.test(subject)) return 'lead_parent' as const;
  return 'unknown' as const;
}

export function buildResendBacklogInventory(input: {
  receivingEnabled: boolean;
  messages: readonly ResendBacklogMessageRef[];
}) {
  const deduped = new Map<string, ResendBacklogMessageRef>();
  for (const message of input.messages) deduped.set(message.messageId, message);
  const rows: ResendBacklogInventoryRow[] = [...deduped.values()].map((message) => ({
    messageIdHash: stableDigest(message.messageId).slice(0, 32),
    senderDomain: senderDomain(message.from),
    date: message.receivedAt.slice(0, 10),
    classification: classifyResendBacklogMessage(message),
    hasAttachments: message.hasAttachments,
  }));
  const countsByClass = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.classification] = (counts[row.classification] ?? 0) + 1;
    return counts;
  }, {});
  return {
    receivingEnabled: input.receivingEnabled,
    windowDays: 14,
    publicOutputContainsBodies: false,
    attachmentDownloads: 0,
    privateReferencesRequired: true,
    rows,
    countsByClass,
  };
}

export function planResendBackfill(input: {
  inventory: ReturnType<typeof buildResendBacklogInventory>;
  ghlCredentialsReady: boolean;
}) {
  return {
    ready: input.ghlCredentialsReady && input.inventory.receivingEnabled,
    createMissingContactOnlyUnderAcceptedRules: true,
    addHistoricalInboundMessage: true,
    preserveOriginalDateSubjectAndMessageId: true,
    suppressNewLeadAndNewMessageAutomations: true,
    importTag: 'OT | Resend Backlog Import',
    idempotentReplay: true,
    excluded: input.inventory.rows.filter((row) =>
      ['spam', 'newsletter', 'internal'].includes(row.classification),
    ).length,
  };
}

function senderDomain(value: string) {
  const domain = value.split('@')[1]?.trim().toLowerCase();
  return domain && /^[a-z0-9.-]+$/.test(domain) ? domain : 'unknown';
}
