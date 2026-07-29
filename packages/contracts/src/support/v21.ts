export const SUPPORT_CONTRACT_VERSION = '2.1.0' as const;

export const SUPPORT_ACTOR_ROLES = ['admin', 'parent', 'student'] as const;
export type SupportActorRole = (typeof SUPPORT_ACTOR_ROLES)[number];

export const SUPPORT_CONVERSATION_KINDS = ['technical_support', 'rabbi_question'] as const;
export type SupportConversationKind = (typeof SUPPORT_CONVERSATION_KINDS)[number];

export const SUPPORT_CATEGORIES = [
  'billing',
  'support',
  'access',
  'technical',
  'system',
  'class_question',
  'torah_question',
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_LIFECYCLE_STATES = [
  'open',
  'in_progress',
  'waiting_on_requester',
  'resolved',
  'closed',
] as const;
export type SupportLifecycleState = (typeof SUPPORT_LIFECYCLE_STATES)[number];

export type SupportAdminCapability = 'support_operator' | 'rabbi_operator';

export type SupportPrincipal = {
  product: 'one_time_mishnayos';
  actorId: string;
  role: SupportActorRole;
  householdId: string | null;
  studentId: string | null;
  adminCapabilities: readonly SupportAdminCapability[];
};

export type CreateSupportConversationInput = {
  kind: SupportConversationKind;
  category: SupportCategory;
  subject: string;
  body: string;
  idempotencyKey: string;
};

export type SupportMessage = {
  messageId: string;
  authorId: string;
  authorRole: SupportActorRole;
  body: string;
  createdAt: string;
};

export type SupportAuditEvent = {
  eventId: string;
  action:
    'created' | 'assigned' | 'status_changed' | 'admin_replied' | 'adult_ghl_conversation_linked';
  actorId: string;
  at: string;
  fromStatus: SupportLifecycleState | null;
  toStatus: SupportLifecycleState | null;
};

export type SupportTicket = {
  ticketId: string;
  product: 'one_time_mishnayos';
  kind: SupportConversationKind;
  category: SupportCategory;
  requesterId: string;
  requesterRole: 'parent' | 'student';
  requesterHouseholdId: string;
  requesterStudentId: string | null;
  subject: string;
  status: SupportLifecycleState;
  assigneeAdminId: string | null;
  ghlConversationId: string | null;
  messages: readonly SupportMessage[];
  audit: readonly SupportAuditEvent[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SupportRequesterView = Omit<SupportTicket, 'ghlConversationId'> & {
  ghlConversationLinked: boolean;
};

export type SupportAdminView = SupportTicket;

export type SupportTelegramDestination = 'shloimie_support' | 'rabbi_questions';

export type SupportTelegramNotificationIntent = {
  intentId: string;
  idempotencyKey: string;
  transport: 'telegram';
  namespace: 'OT';
  destination: SupportTelegramDestination;
  event: 'ticket_created' | 'ticket_assigned' | 'ticket_status_changed';
  ticketId: string;
  ticketVersion: number;
  requesterRole: 'parent' | 'student';
  kind: SupportConversationKind;
  category: SupportCategory;
  status: SupportLifecycleState;
  redactedSummary: string;
  containsPrivateBody: false;
  containsStudentIdentity: false;
  providerIsSourceOfTruth: false;
};

export type SupportIdempotencyRecord = {
  scope: string;
  key: string;
  requestHash: string;
  ticketId: string;
};

export interface SupportRepository {
  load(ticketId: string): Promise<SupportTicket | null>;
  save(ticket: SupportTicket, expectedVersion: number | null): Promise<void>;
  list(): Promise<readonly SupportTicket[]>;
  findIdempotency(scope: string, key: string): Promise<SupportIdempotencyRecord | null>;
  saveIdempotency(record: SupportIdempotencyRecord): Promise<void>;
}

export interface SupportNotificationIntentPort {
  record(intent: SupportTelegramNotificationIntent): Promise<void>;
}
