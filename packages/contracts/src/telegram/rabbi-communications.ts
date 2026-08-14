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
  'operation.class.status',
  'operation.content.status',
  'operation.vimeo.status',
  'operation.support.list',
  'operation.support.read',
  'operation.login_issues.list',
  'operation.readiness',
  'agent_task.list',
  'agent_task.read',
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

export const rabbiIssueCategories = [
  'login_access',
  'support_incident',
  'class_readiness',
  'content_processing',
] as const;
export type RabbiIssueCategory = (typeof rabbiIssueCategories)[number];

export const rabbiDiagnosticCapabilities = [
  'login_access_summary',
  'class_readiness_summary',
  'content_processing_summary',
  'vimeo_processing_summary',
  'support_incident_summary',
] as const;
export type RabbiDiagnosticCapability = (typeof rabbiDiagnosticCapabilities)[number];

export const rabbiAgentTaskStatuses = [
  'queued',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'dead_letter',
] as const;
export type RabbiAgentTaskStatus = (typeof rabbiAgentTaskStatuses)[number];

export type RabbiRiskClass = 'R0' | 'R1';
export type RabbiTaskPriority = 'low' | 'normal' | 'high';
export type RabbiRedactedSubjectRef = {
  kind: 'parent' | 'student' | 'account';
  ref: string;
};

export type RabbiReadRequest =
  | { capability: 'conversation.parent.list' }
  | { capability: 'conversation.parent.read_redacted'; conversationKey: string }
  | { capability: 'student.question.list' }
  | { capability: 'student.question.read'; questionKey: string }
  | { capability: 'internal_task.list' }
  | { capability: 'operation.class.status' }
  | { capability: 'operation.content.status' }
  | { capability: 'operation.vimeo.status' }
  | { capability: 'operation.support.list' }
  | { capability: 'operation.support.read'; incidentKey: string }
  | { capability: 'operation.login_issues.list' }
  | { capability: 'operation.readiness' }
  | { capability: 'agent_task.list' }
  | { capability: 'agent_task.read'; taskKey: string };

export type RabbiInternalTaskCreateRequest =
  | {
      capability: 'internal_task.create';
      title: string;
      detail: string;
      priority: RabbiTaskPriority;
    }
  | {
      capability: 'internal_task.create';
      priority: RabbiTaskPriority;
      supportIncident: {
        subject: RabbiRedactedSubjectRef;
        issueCategory: RabbiIssueCategory;
      };
    }
  | {
      capability: 'internal_task.create';
      priority: RabbiTaskPriority;
      agentTask: {
        subject: RabbiRedactedSubjectRef;
        issueCategory: RabbiIssueCategory;
        diagnosticCapability: RabbiDiagnosticCapability;
        riskClass: RabbiRiskClass;
      };
    };

export type RabbiInternalTaskUpdateRequest =
  | {
      capability: 'internal_task.update';
      taskKey: string;
      status: RabbiAgentTaskStatus;
      title?: string;
    }
  | {
      capability: 'internal_task.update';
      taskKey: string;
      supportIncident: {
        action: 'assign' | 'request_diagnostic' | 'add_note' | 'resolve' | 'block';
        diagnosticCapability?: RabbiDiagnosticCapability;
        note?: string;
      };
    }
  | {
      capability: 'internal_task.update';
      taskKey: string;
      agentTask: {
        status: RabbiAgentTaskStatus;
        branchPrRef?: string;
        resultSummary?: string;
      };
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
