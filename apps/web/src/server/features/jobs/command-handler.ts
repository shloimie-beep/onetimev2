import type {
  ApiCommandEnvelope,
  ApiResult,
  ServerDerivedApiContext,
  TypedApiRouteContract,
} from '../../../../../../packages/contracts/src/api/index.ts';
import type { TransactionalOutboxIntent } from '../../../../../../packages/contracts/src/jobs/index.ts';
import { assertSafeRoutePath } from '../../../../../../packages/domain/src/jobs/index.ts';

export interface TypedCommandStore {
  executeTransactionalCommand<Response>(input: {
    scope: {
      product: 'one_time_mishnayos';
      runtime_tier: ServerDerivedApiContext['runtime_tier'];
      verification_environment_id: ServerDerivedApiContext['verification_environment_id'];
    };
    actor_ref: string;
    operation_scope: string;
    idempotency_key: string;
    canonical_request_hash: string;
    expected_version: number;
    mutate(client: unknown): Promise<{
      response: Response;
      resulting_version: number;
      outbox_intents: readonly TransactionalOutboxIntent[];
    }>;
  }): Promise<{
    disposition: 'applied' | 'replayed';
    response: Response;
    resulting_version: number;
    outbox_job_ids: readonly string[];
  }>;
}

export async function executeTypedJobCommand<Command, Response>(input: {
  contract: TypedApiRouteContract;
  context: ServerDerivedApiContext;
  envelope: ApiCommandEnvelope<Command>;
  store: TypedCommandStore;
  authorize(context: ServerDerivedApiContext, command: Command): boolean;
  mutate(
    client: unknown,
    context: ServerDerivedApiContext,
    command: Command,
  ): Promise<{
    response: Response;
    resulting_version: number;
    outbox_intents: readonly TransactionalOutboxIntent[];
  }>;
}): Promise<ApiResult<Response>> {
  assertSafeRoutePath(input.contract.path);
  if (
    input.contract.kind !== 'command' ||
    input.contract.scope_source !== 'server' ||
    input.contract.idempotency !== 'required' ||
    input.contract.concurrency !== 'expected_version' ||
    !input.contract.allowed_roles.includes(input.context.actor_role)
  ) {
    return failure(403, 'forbidden', input.envelope.correlation_id, false, null);
  }
  if (!input.authorize(input.context, input.envelope.command)) {
    return failure(403, 'forbidden', input.envelope.correlation_id, false, null);
  }
  try {
    const result = await input.store.executeTransactionalCommand({
      scope: {
        product: input.context.product,
        runtime_tier: input.context.runtime_tier,
        verification_environment_id: input.context.verification_environment_id,
      },
      actor_ref: input.context.actor_ref,
      operation_scope: input.contract.operation_id,
      idempotency_key: input.envelope.idempotency_key,
      canonical_request_hash: input.envelope.canonical_request_hash,
      expected_version: input.envelope.expected_version,
      mutate: (client) => input.mutate(client, input.context, input.envelope.command),
    });
    return {
      ok: true,
      status: 200,
      data: result.response,
      correlation_id: input.envelope.correlation_id,
      version: result.resulting_version,
      replayed: result.disposition === 'replayed',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('idempotency_conflict')) {
      return failure(409, 'idempotency_conflict', input.envelope.correlation_id, false, null);
    }
    if (message.includes('stale') || message.includes('nonmonotonic')) {
      return failure(
        409,
        'stale_version',
        input.envelope.correlation_id,
        false,
        input.envelope.expected_version,
      );
    }
    return failure(500, 'internal_error', input.envelope.correlation_id, true, null);
  }
}

function failure(
  status: number,
  code: 'forbidden' | 'idempotency_conflict' | 'stale_version' | 'internal_error',
  correlationId: string,
  retryable: boolean,
  currentVersion: number | null,
): ApiResult<never> {
  return {
    ok: false,
    status,
    error: {
      code,
      message: safeMessage(code),
      correlation_id: correlationId,
      retryable,
      current_version: currentVersion,
    },
  };
}

function safeMessage(code: string): string {
  if (code === 'forbidden') return 'This operation is not authorized.';
  if (code === 'idempotency_conflict') return 'The request key was already used differently.';
  if (code === 'stale_version') return 'The resource changed; refresh before retrying.';
  return 'The operation could not be completed.';
}
