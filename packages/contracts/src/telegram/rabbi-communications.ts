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

export type RabbiReadRequest =
  | { capability: 'conversation.parent.list' }
  | { capability: 'conversation.parent.read_redacted'; conversationKey: string }
  | { capability: 'student.question.list' }
  | { capability: 'student.question.read'; questionKey: string }
  | { capability: 'internal_task.list' };

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
  | {
      capability: 'internal_task.create';
      title: string;
      detail: string;
      priority: 'low' | 'normal' | 'high';
    }
  | {
      capability: 'internal_task.update';
      taskKey: string;
      status: 'queued' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
      title?: string;
    };

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
