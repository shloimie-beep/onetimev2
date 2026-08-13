import type { AppConfig } from '../../../config/src/index.ts';
import type {
  RabbiCommunicationActor,
  RabbiReadRequest,
} from '../../../contracts/src/telegram/rabbi-communications.ts';
import type {
  BotActionRequest,
  CanonicalOneTimeActor,
} from '../../../contracts/src/telegram/types.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { createOneTimeTelegramApplicationAdapter } from './application-adapter.ts';

export type RabbiTelegramOperationsReader = {
  read(
    actor: RabbiCommunicationActor,
    request: Extract<RabbiReadRequest, { capability: `operation.${string}` }>,
  ): Promise<string>;
};

/**
 * Deliberately exposes only read-only, already-redacted application views to the
 * Rabbi bot. It never calls a provider, creates a notification, or accepts a
 * provider/meeting reference.
 */
export function createRabbiTelegramOperationsReader(input: {
  pool: DbPool;
  config: AppConfig;
}): RabbiTelegramOperationsReader {
  const adapter = createOneTimeTelegramApplicationAdapter(input);
  return {
    async read(actor, request) {
      const applicationActor: CanonicalOneTimeActor = {
        ...actor,
        membershipKey: 'rabbi_telegram_private_chat',
        membershipStatus: 'active',
        userStatus: 'active',
        capabilities: adapter.supportedCapabilities(),
      };
      const action = operationAction(request);
      return adapter.readAction?.(applicationActor, action) ?? 'This operation is unavailable.';
    },
  };
}

function operationAction(
  request: Extract<RabbiReadRequest, { capability: `operation.${string}` }>,
): BotActionRequest {
  switch (request.capability) {
    case 'operation.class.readiness':
      return deterministicRead('class.status.read', { ref: request.occurrenceKey });
    case 'operation.content.processing.read':
      return deterministicRead('content.pipeline.read', { filter: 'vimeo' });
    case 'operation.incident.list':
      return deterministicRead('support.ticket.decision_needed', {});
    case 'operation.incident.read':
      return deterministicRead('support.ticket.read_redacted', { ref: request.incidentKey });
  }
}

function deterministicRead(
  capability:
    | 'class.status.read'
    | 'content.pipeline.read'
    | 'support.ticket.decision_needed'
    | 'support.ticket.read_redacted',
  args: BotActionRequest['args'],
): BotActionRequest {
  return {
    capability,
    args,
    source: 'deterministic',
    confirmationMode: 'none',
    riskClass: 'R0',
  };
}
