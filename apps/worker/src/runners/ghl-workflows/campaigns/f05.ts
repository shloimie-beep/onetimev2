import { createHash } from 'node:crypto';

import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type {
  JobScope,
  ProviderDispatchOutcome,
  ProviderJobHandler,
  ProviderJobRecord,
  TransactionalOutboxIntent,
} from '../../../../../../packages/contracts/src/jobs/index.ts';
import { createPostgresJobFoundationRepository } from '../../../../../../packages/db/src/jobs/index.ts';
import { governedCampaignProviderContactRefHash } from '../../../../../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import {
  buildOt16Notice,
  ot16OperationId,
  planOt16Checkpoint,
  type Ot16CheckpointDays,
} from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { runFoundationJobBatch } from '../../foundation/runner.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../../registry/index.ts';
import {
  inspectDefaultOt16Authority,
  OT16_CANONICAL_LOCATION_ID,
  OT16_OPERATION_TYPE,
  OT16_REGISTRY_BINDING_KEY,
  resolveOt16ProviderWorkflowId,
  type Ot16AuthorityDecision,
} from './adapters.ts';
import { createPostgresOt16CampaignReadModel } from './postgres.ts';
import type { CampaignEmailDispatchReceipt, CampaignEmailPort } from './runner.ts';

const OT16_F05_BATCH_SIZE = 20;
const OT16_F05_FINALIZATION_BATCH_SIZE = 100;
const RETRY_AFTER_MS = 5 * 60 * 1_000;

type Ot16DispatchInput = Parameters<CampaignEmailPort['dispatchThroughF05']>[0];
type Ot16Context = Ot16DispatchInput & {
  job_id: string;
  product: JobScope['product'];
  runtime_tier: JobScope['runtime_tier'];
  verification_environment_id: JobScope['verification_environment_id'];
  request_digest: string;
};

type F05Dependencies = {
  inspectAuthority?: (context: WorkerRunnerContext) => Promise<Ot16AuthorityDecision>;
  resolveWorkflowId?: (safeProviderReference: string) => Promise<string | null>;
  provider?: Ot16EnrollmentProvider;
  clock?: () => Date;
  random?: () => number;
  foundation?: ReturnType<typeof createPostgresJobFoundationRepository>;
};

export interface Ot16EnrollmentProvider {
  enroll(
    input: {
      operationId: string;
      normalizedEmail: string;
      expectedContactRefHash: string;
      workflowId: string;
    },
    signal: AbortSignal,
  ): Promise<ProviderDispatchOutcome>;
}

export function createOt16F05EmailPort(
  context: WorkerRunnerContext,
  dependencies: F05Dependencies = {},
): CampaignEmailPort {
  const foundation = dependencies.foundation ?? createPostgresJobFoundationRepository(context.pool);
  const provider = dependencies.provider ?? createHighLevelOt16EnrollmentProvider(context.config);

  return {
    async dispatchThroughF05(input, signal) {
      if (signal.aborted) throw new Error('ot16_f05_dispatch_aborted');
      const dispatchContext = validateDispatchInput(context, input);
      await foundation.executeTransactionalCommand({
        scope: scope(context),
        actor_ref: dispatchContext.adult_id,
        operation_scope: OT16_OPERATION_TYPE,
        idempotency_key: dispatchContext.operation_id,
        canonical_request_hash: dispatchContext.request_digest,
        expected_version: 0,
        async mutate() {
          return {
            response: { job_id: dispatchContext.job_id },
            resulting_version: 1,
            outbox_intents: [outboxIntent(dispatchContext)],
          };
        },
        async afterOutbox(client, jobIds) {
          if (jobIds.length !== 1 || jobIds[0] !== dispatchContext.job_id) {
            throw new Error('ot16_f05_outbox_identity_mismatch');
          }
          await client.query(
            `INSERT INTO onetime.ot16_f05_dispatch_context
               (operation_id, job_id, adult_id, household_id, product, runtime_tier,
                verification_environment_id, expiry_at, checkpoint_days, sender_key,
                transport, subject, body, cta_label, content_digest,
                safe_provider_reference, request_digest)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            contextValues(dispatchContext),
          );
          await client.query(
            `INSERT INTO onetime.provider_operation_binding
               (job_id, registry_binding_key, provider_account_ref_hash, effect_kind,
                household_id)
             VALUES ($1,$2,$3,'mutation',$4)`,
            [
              dispatchContext.job_id,
              OT16_REGISTRY_BINDING_KEY,
              sha256(OT16_CANONICAL_LOCATION_ID),
              dispatchContext.household_id,
            ],
          );
        },
      });

      if (signal.aborted) throw new Error('ot16_f05_dispatch_aborted_after_enqueue');
      const runtime = createOt16JobRuntime(context, provider, dependencies);
      await runFoundationJobBatch({
        repository: foundation,
        handlers: [runtime.handler],
        logger: foundationLogger(context),
        options: {
          owner: `${context.workerInstanceKey}:ot16-sync`,
          scope: scope(context),
          batch_size: 1,
          dispatch_timeout_ms: providerDispatchTimeout(context.config),
          random: dependencies.random ?? Math.random,
          clock: dependencies.clock ?? (() => new Date()),
          job_ids: [dispatchContext.job_id],
        },
      });
      return readDispatchReceipt(context, dispatchContext.job_id);
    },
  };
}

export async function runOt16F05Worker(
  context: WorkerRunnerContext,
  dependencies: F05Dependencies = {},
): Promise<WorkerRunnerResult> {
  const authority = await (dependencies.inspectAuthority ?? inspectDefaultOt16Authority)(context);
  if (!authority.ready) {
    return {
      enabled: false,
      providerCallsPerformed: false,
      summary: { disabledReason: authority.reason, claimed: 0, finalized: 0 },
    };
  }
  const provider = dependencies.provider ?? createHighLevelOt16EnrollmentProvider(context.config);
  const runtime = createOt16JobRuntime(context, provider, dependencies);
  const dispatch = await runFoundationJobBatch({
    repository: dependencies.foundation ?? createPostgresJobFoundationRepository(context.pool),
    handlers: [runtime.handler],
    logger: foundationLogger(context),
    options: {
      owner: `${context.workerInstanceKey}:ot16-f05`,
      scope: scope(context),
      batch_size: Math.min(OT16_F05_BATCH_SIZE, context.config.oneTimeOt16PerRunBudget),
      dispatch_timeout_ms: providerDispatchTimeout(context.config),
      random: dependencies.random ?? Math.random,
      clock: dependencies.clock ?? (() => new Date()),
      ...(context.config.oneTimeOt16TransportMode === 'canary'
        ? { job_ids: context.config.oneTimeOt16CanaryOperationIds.map(ot16F05JobId) }
        : {}),
    },
  });
  const finalized = await finalizeOt16Decisions(context, OT16_F05_FINALIZATION_BATCH_SIZE);
  return {
    enabled: true,
    providerCallsPerformed: runtime.providerCalls() > 0,
    summary: { ...dispatch, finalized },
  };
}

export function createHighLevelOt16EnrollmentProvider(
  config: AppConfig,
  fetchImplementation: typeof fetch = fetch,
): Ot16EnrollmentProvider {
  return {
    async enroll(input, signal) {
      if (!config.highLevelPrivateIntegrationsToken) {
        return permanent('ot16_provider_configuration_missing');
      }
      const search = new URL('/contacts/', config.highLevelApiBaseUrl);
      search.searchParams.set('locationId', config.highLevelLocationId);
      search.searchParams.set('query', input.normalizedEmail);
      search.searchParams.set('limit', '100');
      const matches = await providerJsonRequest(config, fetchImplementation, search, signal, {
        method: 'GET',
      });
      if (!matches.ok) return readFailure(matches);
      const root = record(matches.value);
      const contacts = Array.isArray(root?.contacts) ? root.contacts : null;
      if (!contacts) return retry('ot16_provider_contact_search_invalid');
      const exact = contacts
        .map(record)
        .filter((contact): contact is Record<string, unknown> => Boolean(contact))
        .filter((contact) => normalizeEmail(contact.email) === input.normalizedEmail);
      if (exact.length === 0) return retry('ot16_provider_contact_missing');
      if (exact.length !== 1) return permanent('ot16_provider_contact_ambiguous');
      const providerContactId = requiredProviderText(exact[0]?.id);
      if (!providerContactId) return retry('ot16_provider_contact_identity_invalid');
      if (
        governedCampaignProviderContactRefHash(config.highLevelLocationId, providerContactId) !==
        input.expectedContactRefHash
      ) {
        return permanent('ot16_provider_contact_identity_mismatch');
      }

      const current = await providerJsonRequest(
        config,
        fetchImplementation,
        new URL(`/contacts/${encodeURIComponent(providerContactId)}`, config.highLevelApiBaseUrl),
        signal,
        { method: 'GET' },
      );
      if (!current.ok) return readFailure(current);
      const contactRoot = record(current.value);
      const contact = record(contactRoot?.contact) ?? contactRoot;
      if (
        !contact ||
        normalizeEmail(contact.email) !== input.normalizedEmail ||
        contact.locationId !== config.highLevelLocationId
      ) {
        return permanent('ot16_provider_contact_readback_mismatch');
      }
      const dnd = providerEmailDnd(contact);
      if (dnd === 'unknown') return retry('ot16_provider_suppression_unknown');
      if (dnd === 'suppressed') return permanent('ot16_provider_contact_suppressed');

      const enrollment = await providerTextRequest(
        config,
        fetchImplementation,
        new URL(
          `/contacts/${encodeURIComponent(providerContactId)}/workflow/${encodeURIComponent(input.workflowId)}`,
          config.highLevelApiBaseUrl,
        ),
        signal,
        {
          method: 'POST',
          body: '{}',
          headers: { 'Idempotency-Key': input.operationId },
        },
      );
      if (!enrollment.ok) return mutationFailure(enrollment);
      return {
        kind: 'accepted',
        provider_acceptance_digest: sha256(
          stableJson({
            operation_id: input.operationId,
            provider_contact_ref_hash: input.expectedContactRefHash,
            provider_response_digest: sha256(enrollment.value),
            provider_workflow_ref_hash: sha256(input.workflowId),
          }),
        ),
        completed_locally: true,
      };
    },
  };
}

function createOt16JobRuntime(
  context: WorkerRunnerContext,
  provider: Ot16EnrollmentProvider,
  dependencies: F05Dependencies,
): { handler: ProviderJobHandler; providerCalls(): number } {
  let calls = 0;
  const handler: ProviderJobHandler = {
    operation_type: OT16_OPERATION_TYPE,
    async dispatch(job, signal) {
      try {
        const dispatchContext = await readDispatchContext(context, job);
        if (!dispatchContext) return permanent('ot16_f05_context_invalid');
        if (
          dispatchContext.expiry_at !==
          requiredIso(context.config.oneTimeFreeAccessExpiresAt, 'canonical_expiry')
        ) {
          return permanent('ot16_f05_canonical_expiry_mismatch');
        }
        const authority = await (dependencies.inspectAuthority ?? inspectDefaultOt16Authority)(
          context,
        );
        if (!authority.ready) return retry(`ot16_authority_${authority.reason}`);
        if (authority.safeProviderReference !== dispatchContext.safe_provider_reference) {
          return permanent('ot16_f06_reference_mismatch');
        }
        const workflowId = await (dependencies.resolveWorkflowId ?? resolveOt16ProviderWorkflowId)(
          dispatchContext.safe_provider_reference,
        );
        if (!workflowId) return retry('ot16_provider_workflow_identity_unavailable');

        const readModel = createPostgresOt16CampaignReadModel({
          pool: context.pool,
          runtimeTier: dispatchContext.runtime_tier,
          verificationEnvironmentId: dispatchContext.verification_environment_id,
          canonicalExpiryAt: dispatchContext.expiry_at,
        });
        const suppression = await readModel.suppression.readCurrent(dispatchContext.adult_id);
        const candidate = await readModel.eligibility.readCurrent(dispatchContext.adult_id);
        const plan = planOt16Checkpoint({
          operation_id: dispatchContext.operation_id,
          checkpoint_days: dispatchContext.checkpoint_days,
          expiry_at: dispatchContext.expiry_at,
          candidate,
          suppression,
        });
        if (plan.state !== 'deliver_email') {
          return permanent(`ot16_send_time_${plan.state}`);
        }
        if (
          plan.adult_id !== dispatchContext.adult_id ||
          candidate.subject.kind !== 'adult' ||
          candidate.subject.household_id !== dispatchContext.household_id ||
          !noticeMatchesContext(plan.notice, dispatchContext)
        ) {
          return permanent('ot16_send_time_context_mismatch');
        }
        const identity = await readProviderIdentity(context, dispatchContext);
        if (!identity) return retry('ot16_provider_identity_unavailable');
        calls += 1;
        return provider.enroll(
          {
            operationId: dispatchContext.operation_id,
            normalizedEmail: identity.normalizedEmail,
            expectedContactRefHash: identity.providerContactRefHash,
            workflowId,
          },
          signal,
        );
      } catch {
        return retry('ot16_f05_preflight_unavailable');
      }
    },
  };
  return { handler, providerCalls: () => calls };
}

async function readProviderIdentity(
  context: WorkerRunnerContext,
  dispatchContext: Ot16Context,
): Promise<{ normalizedEmail: string; providerContactRefHash: string } | null> {
  const selected = await context.pool.query<Record<string, unknown>>(
    `SELECT adult.normalized_email, identity.verified_contact_ref_hash, identity.state
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.adult_ghl_identity_link AS identity
         ON identity.adult_id = adult.adult_id
        AND identity.product_key = adult.product_key
        AND identity.runtime_tier = adult.runtime_tier
        AND identity.verification_environment_id = adult.verification_environment_id
      WHERE adult.adult_id = $1
        AND adult.product_key = $2
        AND adult.runtime_tier = $3
        AND adult.verification_environment_id = $4`,
    [
      dispatchContext.adult_id,
      dispatchContext.product,
      dispatchContext.runtime_tier,
      dispatchContext.verification_environment_id,
    ],
  );
  if (selected.rows.length !== 1) return null;
  const row = selected.rows[0]!;
  const normalizedEmail = normalizeEmail(row.normalized_email);
  const providerContactRefHash = text(row.verified_contact_ref_hash);
  if (
    row.state !== 'linked' ||
    !normalizedEmail ||
    !providerContactRefHash ||
    !isSha256(providerContactRefHash)
  ) {
    return null;
  }
  return { normalizedEmail, providerContactRefHash };
}

async function readDispatchContext(
  context: WorkerRunnerContext,
  job: ProviderJobRecord,
): Promise<Ot16Context | null> {
  const selected = await context.pool.query<Record<string, unknown>>(
    `SELECT dispatch.operation_id, dispatch.job_id, dispatch.adult_id,
            dispatch.household_id, dispatch.product, dispatch.runtime_tier,
            dispatch.verification_environment_id, dispatch.expiry_at,
            dispatch.checkpoint_days, dispatch.sender_key, dispatch.transport,
            dispatch.subject, dispatch.body, dispatch.cta_label,
            dispatch.content_digest, dispatch.safe_provider_reference,
            dispatch.request_digest
       FROM onetime.ot16_f05_dispatch_context AS dispatch
       JOIN onetime.provider_operation_binding AS binding
         ON binding.job_id = dispatch.job_id
        AND binding.registry_binding_key = $5
        AND binding.provider_account_ref_hash = $6
        AND binding.effect_kind = 'mutation'
        AND binding.household_id = dispatch.household_id
      WHERE dispatch.job_id = $1
        AND dispatch.product = $2
        AND dispatch.runtime_tier = $3
        AND dispatch.verification_environment_id = $4`,
    [
      job.job_id,
      job.scope.product,
      job.scope.runtime_tier,
      job.scope.verification_environment_id,
      OT16_REGISTRY_BINDING_KEY,
      sha256(OT16_CANONICAL_LOCATION_ID),
    ],
  );
  if (selected.rows.length !== 1) return null;
  const parsed = parseContext(selected.rows[0]!);
  if (!parsed || !jobMatchesContext(job, parsed)) return null;
  return parsed;
}

async function readDispatchReceipt(
  context: WorkerRunnerContext,
  jobId: string,
): Promise<CampaignEmailDispatchReceipt> {
  const selected = await context.pool.query<Record<string, unknown>>(
    `SELECT job_id, operation_type, idempotency_key, state, version, unknown_effect,
            provider_acceptance_digest, safe_error_code, updated_at
       FROM onetime.job_outbox
      WHERE job_id = $1
        AND product = $2
        AND runtime_tier = $3
        AND verification_environment_id = $4`,
    [
      jobId,
      'one_time_mishnayos',
      context.config.oneTimeRuntimeTier,
      context.config.oneTimeVerificationEnvironmentId,
    ],
  );
  if (selected.rows.length !== 1) throw new Error('ot16_f05_durable_job_missing');
  const row = selected.rows[0]!;
  if (row.job_id !== jobId || row.operation_type !== OT16_OPERATION_TYPE) {
    throw new Error('ot16_f05_durable_job_identity_mismatch');
  }
  const state = text(row.state);
  const safeErrorCode = nullableText(row.safe_error_code);
  const acceptanceDigest = nullableText(row.provider_acceptance_digest);
  const unknownEffect = row.unknown_effect === true;
  const durableJob = {
    job_id: requiredText(row.job_id, 'job_id'),
    operation_type: OT16_OPERATION_TYPE,
    idempotency_key: requiredText(row.idempotency_key, 'idempotency_key'),
    state,
    version: Number(row.version),
    unknown_effect: unknownEffect,
    provider_acceptance_digest: acceptanceDigest,
    safe_error_code: safeErrorCode,
    updated_at: requiredIso(row.updated_at, 'updated_at'),
  };
  if ((state === 'complete' || state === 'accepted') && isSha256(acceptanceDigest)) {
    return {
      outcome: {
        kind: 'accepted',
        provider_acceptance_digest: acceptanceDigest,
        completed_locally: state === 'complete',
      },
      durable_job: { ...durableJob, state },
    };
  }
  if (state === 'acceptance_unknown' && unknownEffect && safeErrorCode) {
    return {
      outcome: { kind: 'acceptance_unknown', safe_error_code: safeErrorCode },
      durable_job: { ...durableJob, state },
    };
  }
  if (state === 'rejected' && !unknownEffect && safeErrorCode) {
    return {
      outcome: { kind: 'permanently_rejected', safe_error_code: safeErrorCode },
      durable_job: { ...durableJob, state },
    };
  }
  if ((state === 'retry_wait' || state === 'dead_letter') && !unknownEffect && safeErrorCode) {
    return {
      outcome: {
        kind: 'not_accepted_retryable',
        safe_error_code: safeErrorCode,
        retry_after_ms: null,
      },
      durable_job: { ...durableJob, state },
    };
  }
  throw new Error('ot16_f05_durable_job_not_classified');
}

async function finalizeOt16Decisions(context: WorkerRunnerContext, limit: number): Promise<number> {
  const selected = await context.pool.query<Record<string, unknown>>(
    `SELECT decision.operation_id, decision.version, job.state,
            job.provider_acceptance_digest, job.safe_error_code, job.unknown_effect
       FROM onetime.communication_decision AS decision
       JOIN onetime.ot16_f05_dispatch_context AS dispatch
         ON dispatch.operation_id = decision.operation_id
       JOIN onetime.job_outbox AS job
         ON job.job_id = dispatch.job_id
       JOIN onetime.provider_operation_binding AS binding
         ON binding.job_id = job.job_id
        AND binding.registry_binding_key = $5
        AND binding.provider_account_ref_hash = $6
        AND binding.effect_kind = 'mutation'
        AND binding.household_id = dispatch.household_id
      WHERE dispatch.product = $1
        AND dispatch.runtime_tier = $2
        AND dispatch.verification_environment_id = $3
        AND decision.status IN ('planned', 'retry_pending')
        AND job.state IN ('complete', 'rejected', 'dead_letter')
        AND job.operation_type = $7
        AND job.provider = 'highlevel'
        AND job.idempotency_key = dispatch.operation_id
        AND job.canonical_request_hash = dispatch.request_digest
        AND job.payload_ref = ('ot16-f05:' || dispatch.operation_id)
        AND job.payload_digest = dispatch.request_digest
      ORDER BY job.updated_at, job.job_id
      LIMIT $4`,
    [
      'one_time_mishnayos',
      context.config.oneTimeRuntimeTier,
      context.config.oneTimeVerificationEnvironmentId,
      limit,
      OT16_REGISTRY_BINDING_KEY,
      sha256(OT16_CANONICAL_LOCATION_ID),
      OT16_OPERATION_TYPE,
    ],
  );
  let finalized = 0;
  for (const row of selected.rows) {
    const state = text(row.state);
    const unknownEffect = row.unknown_effect === true;
    const acceptanceDigest = nullableText(row.provider_acceptance_digest);
    const safeErrorCode = nullableText(row.safe_error_code);
    if (unknownEffect) continue;
    const sent = state === 'complete' && isSha256(acceptanceDigest);
    const terminal = (state === 'rejected' || state === 'dead_letter') && safeErrorCode;
    if (!sent && !terminal) continue;
    const updated = await context.pool.query(
      `UPDATE onetime.communication_decision
          SET status = $1,
              safe_provider_ref_hash = $2,
              safe_reason = $3,
              version = version + 1
        WHERE operation_id = $4
          AND version = $5
          AND status IN ('planned', 'retry_pending')`,
      [
        sent ? 'email_sent' : 'skipped',
        sent ? acceptanceDigest : null,
        sent ? 'channel_skipped_not_configured' : safeErrorCode,
        row.operation_id,
        Number(row.version),
      ],
    );
    finalized += (updated.rowCount ?? 0) === 1 ? 1 : 0;
  }
  return finalized;
}

function validateDispatchInput(
  context: WorkerRunnerContext,
  input: Ot16DispatchInput,
): Ot16Context {
  const expectedNotice = buildOt16Notice({
    checkpoint_days: input.checkpoint_days,
    expiry_at: input.expiry_at,
  });
  if (
    !isSha256(input.operation_id) ||
    !input.adult_id.trim() ||
    !input.household_id.trim() ||
    context.config.oneTimeOt16TransportMode === 'disabled' ||
    context.config.oneTimeOt16PerRunBudget < 1 ||
    (context.config.oneTimeOt16TransportMode === 'canary' &&
      !context.config.oneTimeOt16CanaryOperationIds.includes(input.operation_id)) ||
    input.operation_id !==
      ot16OperationId({
        adult_id: input.adult_id,
        expiry_at: expectedNotice.expiry_at,
        checkpoint_days: input.checkpoint_days,
      }) ||
    input.sender_key !== 'office' ||
    input.transport !== 'GHL' ||
    input.subject !== expectedNotice.subject ||
    input.body !== expectedNotice.body ||
    input.cta_label !== expectedNotice.cta_label ||
    input.content_digest !== sha256(JSON.stringify(expectedNotice)) ||
    !isSha256(input.safe_provider_reference) ||
    expectedNotice.expiry_at !== requiredIso(context.config.oneTimeFreeAccessExpiresAt, 'expiry')
  ) {
    throw new Error('ot16_f05_dispatch_input_invalid');
  }
  const canonical = {
    operation_id: input.operation_id,
    adult_id: input.adult_id,
    household_id: input.household_id,
    expiry_at: expectedNotice.expiry_at,
    checkpoint_days: input.checkpoint_days,
    sender_key: input.sender_key,
    transport: input.transport,
    subject: input.subject,
    body: input.body,
    cta_label: input.cta_label,
    content_digest: input.content_digest,
    safe_provider_reference: input.safe_provider_reference,
  };
  return {
    ...canonical,
    job_id: ot16F05JobId(input.operation_id),
    product: 'one_time_mishnayos',
    runtime_tier: context.config.oneTimeRuntimeTier,
    verification_environment_id: context.config.oneTimeVerificationEnvironmentId,
    request_digest: sha256(stableJson(canonical)),
  };
}

function ot16F05JobId(operationId: string): string {
  return sha256(`ot16-f05-job-v1\0${operationId}`);
}

function parseContext(row: Record<string, unknown>): Ot16Context | null {
  try {
    const context = {
      operation_id: requiredText(row.operation_id, 'operation_id'),
      job_id: requiredText(row.job_id, 'job_id'),
      adult_id: requiredText(row.adult_id, 'adult_id'),
      household_id: requiredText(row.household_id, 'household_id'),
      product: requiredText(row.product, 'product') as JobScope['product'],
      runtime_tier: requiredText(row.runtime_tier, 'runtime_tier') as JobScope['runtime_tier'],
      verification_environment_id: requiredText(
        row.verification_environment_id,
        'verification_environment_id',
      ) as JobScope['verification_environment_id'],
      expiry_at: requiredIso(row.expiry_at, 'expiry_at'),
      checkpoint_days: Number(row.checkpoint_days) as Ot16CheckpointDays,
      sender_key: requiredText(row.sender_key, 'sender_key') as 'office',
      transport: requiredText(row.transport, 'transport') as 'GHL',
      subject: requiredText(row.subject, 'subject'),
      body: requiredText(row.body, 'body'),
      cta_label: requiredText(row.cta_label, 'cta_label') as 'Complete Checkout',
      content_digest: requiredText(row.content_digest, 'content_digest'),
      safe_provider_reference: requiredText(row.safe_provider_reference, 'safe_provider_reference'),
      request_digest: requiredText(row.request_digest, 'request_digest'),
    };
    if (
      context.product !== 'one_time_mishnayos' ||
      !['isolated_staging', 'production'].includes(context.runtime_tier) ||
      ![14, 7, 3, 1, 0].includes(context.checkpoint_days) ||
      context.sender_key !== 'office' ||
      context.transport !== 'GHL' ||
      context.cta_label !== 'Complete Checkout' ||
      !isSha256(context.operation_id) ||
      !isSha256(context.job_id) ||
      !isSha256(context.content_digest) ||
      !isSha256(context.safe_provider_reference) ||
      !isSha256(context.request_digest)
    ) {
      return null;
    }
    const canonical = dispatchCanonical(context);
    return sha256(stableJson(canonical)) === context.request_digest ? context : null;
  } catch {
    return null;
  }
}

function jobMatchesContext(job: ProviderJobRecord, context: Ot16Context): boolean {
  return (
    job.job_id === context.job_id &&
    job.operation_type === OT16_OPERATION_TYPE &&
    job.aggregate_ref === context.household_id &&
    job.source_version === 1 &&
    job.provider === 'highlevel' &&
    job.scope.product === context.product &&
    job.scope.runtime_tier === context.runtime_tier &&
    job.scope.verification_environment_id === context.verification_environment_id &&
    job.idempotency_key === context.operation_id &&
    job.canonical_request_hash === context.request_digest &&
    job.payload_ref === `ot16-f05:${context.operation_id}` &&
    job.payload_digest === context.request_digest &&
    job.compensation_for_job_id === null
  );
}

function noticeMatchesContext(
  notice: ReturnType<typeof buildOt16Notice>,
  context: Ot16Context,
): boolean {
  return (
    notice.expiry_at === context.expiry_at &&
    notice.checkpoint_days === context.checkpoint_days &&
    notice.sender_key === context.sender_key &&
    notice.subject === context.subject &&
    notice.body === context.body &&
    notice.cta_label === context.cta_label &&
    sha256(JSON.stringify(notice)) === context.content_digest
  );
}

function outboxIntent(context: Ot16Context): TransactionalOutboxIntent {
  return {
    job_id: context.job_id,
    operation_type: OT16_OPERATION_TYPE,
    aggregate_ref: context.household_id,
    source_version: 1,
    provider: 'highlevel',
    scope: {
      product: context.product,
      runtime_tier: context.runtime_tier,
      verification_environment_id: context.verification_environment_id,
    },
    idempotency_key: context.operation_id,
    canonical_request_hash: context.request_digest,
    payload_ref: `ot16-f05:${context.operation_id}`,
    payload_digest: context.request_digest,
    compensation_for_job_id: null,
  };
}

function contextValues(context: Ot16Context): unknown[] {
  return [
    context.operation_id,
    context.job_id,
    context.adult_id,
    context.household_id,
    context.product,
    context.runtime_tier,
    context.verification_environment_id,
    context.expiry_at,
    context.checkpoint_days,
    context.sender_key,
    context.transport,
    context.subject,
    context.body,
    context.cta_label,
    context.content_digest,
    context.safe_provider_reference,
    context.request_digest,
  ];
}

function dispatchCanonical(context: Ot16Context): Ot16DispatchInput {
  return {
    operation_id: context.operation_id,
    adult_id: context.adult_id,
    household_id: context.household_id,
    expiry_at: context.expiry_at,
    checkpoint_days: context.checkpoint_days,
    sender_key: context.sender_key,
    transport: context.transport,
    subject: context.subject,
    body: context.body,
    cta_label: context.cta_label,
    content_digest: context.content_digest,
    safe_provider_reference: context.safe_provider_reference,
  };
}

function scope(context: WorkerRunnerContext): JobScope {
  return {
    product: 'one_time_mishnayos',
    runtime_tier: context.config.oneTimeRuntimeTier,
    verification_environment_id: context.config.oneTimeVerificationEnvironmentId,
  };
}

function foundationLogger(context: WorkerRunnerContext) {
  return {
    info(fields: Record<string, unknown>, message: string) {
      context.logger.info(message, fields);
    },
    warn(fields: Record<string, unknown>, message: string) {
      context.logger.warn(message, fields);
    },
  };
}

function providerDispatchTimeout(config: AppConfig): number {
  return Math.max(1_000, config.highLevelProviderTimeoutMs * 4);
}

type ProviderHttpResult<T> =
  { ok: true; value: T } | { ok: false; status: number | null; safeCode: string };

async function providerJsonRequest(
  config: AppConfig,
  fetchImplementation: typeof fetch,
  url: URL,
  signal: AbortSignal,
  init: RequestInit,
): Promise<ProviderHttpResult<unknown>> {
  const result = await providerTextRequest(config, fetchImplementation, url, signal, init);
  if (!result.ok) return result;
  try {
    return { ok: true, value: JSON.parse(result.value) as unknown };
  } catch {
    return { ok: false, status: 200, safeCode: 'ot16_provider_response_invalid' };
  }
}

async function providerTextRequest(
  config: AppConfig,
  fetchImplementation: typeof fetch,
  url: URL,
  signal: AbortSignal,
  init: RequestInit,
): Promise<ProviderHttpResult<string>> {
  let response: Response;
  try {
    response = await fetchImplementation(url, {
      ...init,
      signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.highLevelPrivateIntegrationsToken ?? ''}`,
        'Content-Type': 'application/json',
        Version: config.highLevelApiVersion,
        ...init.headers,
      },
    });
  } catch {
    return { ok: false, status: null, safeCode: 'ot16_provider_transport_failed' };
  }
  let body: string;
  try {
    body = await response.text();
  } catch {
    return {
      ok: false,
      status: response.ok ? null : response.status,
      safeCode: 'ot16_provider_response_unreadable',
    };
  }
  return response.ok
    ? { ok: true, value: body }
    : { ok: false, status: response.status, safeCode: `ot16_provider_http_${response.status}` };
}

function readFailure(failure: Extract<ProviderHttpResult<unknown>, { ok: false }>) {
  if (
    failure.status === null ||
    failure.status === 408 ||
    failure.status === 425 ||
    failure.status === 429 ||
    (failure.status !== null && failure.status >= 500)
  ) {
    return retry(failure.safeCode);
  }
  return permanent(failure.safeCode);
}

function mutationFailure(failure: Extract<ProviderHttpResult<unknown>, { ok: false }>) {
  if (failure.status === 429 || failure.status === 425) return retry(failure.safeCode);
  if (failure.status === null || failure.status === 408 || (failure.status ?? 0) >= 500) {
    return {
      kind: 'acceptance_unknown',
      safe_error_code: failure.safeCode,
    } satisfies ProviderDispatchOutcome;
  }
  return permanent(failure.safeCode);
}

function providerEmailDnd(contact: Record<string, unknown>): 'active' | 'suppressed' | 'unknown' {
  if (contact.dnd === true) return 'suppressed';
  if (contact.dnd !== false && contact.dnd !== undefined && contact.dnd !== null) return 'unknown';
  const settings = record(contact.dndSettings);
  if (!settings) return 'unknown';
  const official = record(settings.Email);
  const alias = record(settings.email);
  const officialStatus = dndStatus(official?.status);
  const aliasStatus = dndStatus(alias?.status);
  if (
    settings.Email !== undefined &&
    settings.email !== undefined &&
    officialStatus !== aliasStatus
  ) {
    return 'unknown';
  }
  return settings.Email === undefined ? 'unknown' : officialStatus;
}

function dndStatus(value: unknown): 'active' | 'suppressed' | 'unknown' {
  if (value === 'active' || value === 'permanent') return 'suppressed';
  if (value === 'inactive') return 'active';
  return 'unknown';
}

function retry(safeErrorCode: string): ProviderDispatchOutcome {
  return {
    kind: 'not_accepted_retryable',
    safe_error_code: safeErrorCode,
    retry_after_ms: RETRY_AFTER_MS,
  };
}

function permanent(safeErrorCode: string): ProviderDispatchOutcome {
  return { kind: 'permanently_rejected', safe_error_code: safeErrorCode };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requiredProviderText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function requiredText(value: unknown, field: string): string {
  const result = text(value);
  if (!result) throw new Error(`ot16_f05_${field}_missing`);
  return result;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function requiredIso(value: unknown, field: string): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new Error(`ot16_f05_${field}_invalid`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`ot16_f05_${field}_invalid`);
  return date.toISOString();
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
