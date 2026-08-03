export const API_CONTRACT_VERSION = '1.0.0' as const;

export const API_ACTOR_ROLES = ['admin', 'parent', 'student'] as const;
export type ApiActorRole = (typeof API_ACTOR_ROLES)[number];

export const API_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'stale_version',
  'idempotency_conflict',
  'rate_limited',
  'provider_off',
  'acceptance_unknown',
  'internal_error',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiHttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export interface ApiCommandEnvelope<Command> {
  command: Command;
  correlation_id: string;
  idempotency_key: string;
  canonical_request_hash: string;
  expected_version: number;
}

export interface ApiQueryEnvelope<Query> {
  query: Query;
  correlation_id: string;
}

export interface ServerDerivedApiContext {
  product: 'one_time_mishnayos';
  runtime_tier: 'isolated_staging' | 'production';
  verification_environment_id:
    | 'ci'
    | 'provider_sandbox'
    | 'persistent_staging'
    | 'production_read_only'
    | 'production_operator_canary'
    | 'production_broad';
  actor_role: ApiActorRole;
  actor_ref: string;
  account_ref: string;
  household_ref: string | null;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  correlation_id: string;
  retryable: boolean;
  current_version: number | null;
}

export type ApiResult<Response> =
  | {
      ok: true;
      status: number;
      data: Response;
      correlation_id: string;
      version: number | null;
      replayed: boolean;
    }
  | {
      ok: false;
      status: number;
      error: ApiErrorBody;
    };

export interface TypedApiRouteContract {
  contract_version: typeof API_CONTRACT_VERSION;
  operation_id: string;
  method: ApiHttpMethod;
  path: string;
  kind: 'command' | 'query';
  allowed_roles: readonly ApiActorRole[];
  scope_source: 'server';
  idempotency: 'required' | 'not_applicable';
  concurrency: 'expected_version' | 'read_only';
  request_schema_ref: string;
  success_schema_ref: string;
  error_codes: readonly ApiErrorCode[];
  contains_pii_or_bearer_in_url: false;
}

export function defineTypedApiRouteContract(
  contract: Omit<TypedApiRouteContract, 'contract_version'>,
): TypedApiRouteContract {
  return {
    ...contract,
    contract_version: API_CONTRACT_VERSION,
  };
}
