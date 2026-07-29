import type {
  CreateSupportConversationInput,
  SupportLifecycleState,
  SupportPrincipal,
} from '../../../../../../packages/contracts/src/support/v21.ts';
import { createSupportLifecycleService } from '../../../../../../packages/domain/src/support/v21-index.ts';

export type SupportLifecycleService = ReturnType<typeof createSupportLifecycleService>;

export function createAuthenticatedSupportFacade(service: SupportLifecycleService) {
  return {
    create(principal: SupportPrincipal, command: CreateSupportConversationInput) {
      return service.create(principal, command);
    },
    listMine(principal: SupportPrincipal) {
      return service.listForRequester(principal);
    },
    readMine(principal: SupportPrincipal, ticketId: string) {
      return service.read(principal, ticketId);
    },
    listAdmin(principal: SupportPrincipal) {
      return service.listForAdmin(principal);
    },
    readAdmin(principal: SupportPrincipal, ticketId: string) {
      return service.readAdmin(principal, ticketId);
    },
    assign(
      principal: SupportPrincipal,
      input: { ticketId: string; assigneeAdminId: string; expectedVersion: number },
    ) {
      return service.assign({ principal, ...input });
    },
    transition(
      principal: SupportPrincipal,
      input: { ticketId: string; to: SupportLifecycleState; expectedVersion: number },
    ) {
      return service.transition({ principal, ...input });
    },
    reply(
      principal: SupportPrincipal,
      input: {
        ticketId: string;
        body: string;
        idempotencyKey: string;
        expectedVersion: number;
      },
    ) {
      return service.reply({ principal, ...input });
    },
    linkAdultGhlConversation(
      principal: SupportPrincipal,
      input: { ticketId: string; ghlConversationId: string; expectedVersion: number },
    ) {
      return service.linkAdultGhlConversation({ principal, ...input });
    },
  };
}
