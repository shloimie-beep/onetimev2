import type {
  BotEnvironment,
  BotKey,
  CanonicalUserKey,
  ChatRef,
  ProviderUserRef,
} from './types.ts';

export const rabbiCommunicationCapabilities = [
  'conversation.parent.list',
  'conversation.parent.read_redacted',
  'conversation.parent.reply.preview',
  'conversation.parent.reply.confirm',
  'student.question.list',
  'student.question.read',
  'student.question.reply.preview',
  'student.question.reply.confirm',
  'student.question.close',
  'internal_task.list',
  'internal_task.create',
  'internal_task.update',
  'operation.class.readiness',
  'operation.content.processing.read',
  'operation.incident.list',
  'operation.incident.read',
  'agent_task.list',
] as const;

export type RabbiCommunicationCapability = (typeof rabbiCommunicationCapabilities)[number];

export const rabbiPreviewCapabilities = [
  'conversation.parent.reply.preview',
  'student.question.reply.preview',
  'student.question.close',
  'internal_task.create',
  'internal_task.update',
] as const satisfies readonly RabbiCommunicationCapability[];

export type RabbiPreviewCapability = (typeof rabbiPreviewCapabilities)[number];

export type RabbiCommunicationActor = {
  userKey: CanonicalUserKey;
  displayLabel: string;
  accountKey: string;
  productKey: string;
  role: 'owner' | 'admin';
  securityVersion: number;
};

export const rabbiAgentTaskKinds = [
  'login_access',
  'support_incident',
  'class_readiness',
  'content_processing',
] as const;
export type RabbiAgentTaskKind = (typeof rabbiAgentTaskKinds)[number];

export const rabbiAgentTaskStatuses = [
  'queued',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
] as const;
export type RabbiAgentTaskStatus = (typeof rabbiAgentTaskStatuses)[number];

export type RabbiReadRequest =
  | { capability: 'conversation.parent.list' }
  | { capability: 'conversation.parent.read_redacted'; conversationKey: string }
  | { capability: 'student.question.list' }
  | { capability: 'student.question.read'; questionKey: string }
  | { capability: 'internal_task.list' }
  | { capability: 'operation.class.readiness'; occurrenceKey: string }
  | { capability: 'operation.content.processing.read' }
  | { capability: 'operation.incident.list' }
  | { capability: 'operation.incident.read'; incidentKey: string }
  | { capability: 'agent_task.list' };

export type RabbiInternalTaskCreateRequest = {
  capability: 'internal_task.create';
  priority: 'low' | 'normal' | 'high';
  title?: string;
  detail?: string;
  agentKind?: RabbiAgentTaskKind;
};

export type RabbiInternalTaskUpdateRequest = {
  capability: 'internal_task.update';
  taskKey: string;
  status: RabbiAgentTaskStatus;
  title?: string;
  agentTask?: true;
};

export type RabbiPreviewRequest =
  | {
      capability: 'conversation.parent.reply.preview';
      conversationKey: string;
      replyText: string;
    }
  | {
      capability: 'student.question.reply.preview';
      questionKey: string;
      answerText: string;
    }
  | { capability: 'student.question.close'; questionKey: string }
  | RabbiInternalTaskCreateRequest
  | RabbiInternalTaskUpdateRequest;

export type RabbiConfirmationPayload = RabbiPreviewRequest;

export type RabbiPreview = {
  confirmationKey: string;
  capability: RabbiPreviewCapability;
  summary: string;
  actionDigest: string;
  expiresAt: string;
};

export type RabbiCommunicationResult = {
  status:
    | 'completed'
    | 'confirmed'
    | 'already_completed'
    | 'cancelled'
    | 'expired'
    | 'denied'
    | 'unsupported'
    | 'stale'
    | 'provider_off'
    | 'failed';
  publicMessage: string;
  resultRef?: string;
};

export type RabbiConfirmationContext = {
  botKey: BotKey;
  environment: BotEnvironment;
  providerUserRef: ProviderUserRef;
  chatRef: ChatRef;
  actor: RabbiCommunicationActor;
  mappingKey: string;
  mappingVersion: number;
};

export type RabbiProviderReply = {
  conversationRef: string;
  channel: 'email' | 'sms' | 'whatsapp';
  body: string;
  idempotencyKey: string;
};

export type RabbiConversationProvider = {
  mode: 'disabled' | 'synthetic' | 'provider';
  sendReply(input: RabbiProviderReply): Promise<{
    providerMessageRef: string;
    conversationRef: string;
  }>;
};

export const RABBI_TELEGRAM_SYNTHETIC_STUDENT_ANSWER =
  'Rabbi Telegram synthetic answer: review the fictional Mishnah terms and bring one prepared example.';
