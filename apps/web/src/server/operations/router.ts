import express, { type Request, type RequestHandler, type Response } from 'express';
import {
  OPERATIONS_CONTRACT_VERSION,
  buildOperationsHealthSnapshot,
  evaluateOperationsAlerts,
  evaluateRuntimeAgreement,
  isSafeOperationsIdentifier,
  redactOperationalData,
  scanOperationalLeakage,
  type CandidateIdentity,
  type OperationsHealthInput,
  type OperationsHealthSnapshot,
  type OperationsIssue,
  type RuntimeIdentity,
} from '../../../../../packages/observability/v21/index.ts';

type HealthObservations = Omit<
  OperationsHealthInput,
  'candidate' | 'runtimes' | 'generated_at' | 'leakage_issues'
>;

export interface OperationsAdminPrincipal {
  source: 'server_session';
  role: 'admin';
  current: true;
  principal_id: string;
  account_key: string;
  product_key: string;
  session_id: string;
}

export type OperationsAdminAuthorization =
  { authorized: false } | { authorized: true; principal: OperationsAdminPrincipal };

export interface OperationsDiagnosticsPorts {
  authorizeAdmin: (request: Request) => Promise<OperationsAdminAuthorization>;
  candidate: CandidateIdentity;
  readRuntimes: () => Promise<readonly RuntimeIdentity[]>;
  readHealthObservations: () => Promise<HealthObservations>;
  readDiagnosticPayloads?: () => Promise<readonly unknown[]>;
  now?: () => Date;
}

export function createOperationsDiagnosticsRouter(
  ports: OperationsDiagnosticsPorts,
): express.Router {
  const router = express.Router();
  router.use(setOperationsResponseHeaders);

  router.get(
    '/runtime-identity',
    protectedAdminOperation(ports, async (_request, response) => {
      const runtimes = await ports.readRuntimes();
      const sourcePayload = { candidate: ports.candidate, runtimes };
      if (!scanOperationalLeakage(sourcePayload).passed) {
        sendSafetyBlocked(response);
        return;
      }
      const agreement = evaluateRuntimeAgreement(sourcePayload);
      sendAllowlistedJson(
        response,
        agreement.ok ? 200 : 503,
        runtimeIdentityResponse(ports.candidate, runtimes, agreement),
      );
    }),
  );

  router.get(
    '/health',
    protectedAdminOperation(ports, async (_request, response) => {
      const result = await readSnapshot(ports);
      if (result.safetyBlocked) {
        sendSafetyBlocked(response);
        return;
      }
      sendAllowlistedJson(
        response,
        result.snapshot.status === 'sev1' || result.snapshot.status === 'sev2' ? 503 : 200,
        healthResponse(result.snapshot),
      );
    }),
  );

  router.get(
    '/alerts',
    protectedAdminOperation(ports, async (_request, response) => {
      const result = await readSnapshot(ports);
      if (result.safetyBlocked) {
        sendSafetyBlocked(response);
        return;
      }
      sendAllowlistedJson(response, 200, {
        schema_version: OPERATIONS_CONTRACT_VERSION,
        generated_at: result.snapshot.generated_at,
        alerts: evaluateOperationsAlerts(result.snapshot).map((alert) => ({
          schema_version: alert.schema_version,
          alert_key: alert.alert_key,
          severity: alert.severity,
          category: alert.category,
          generated_at: alert.generated_at,
          summary: alert.summary,
          routes: [...alert.routes],
          safe_context: allowlistedSafeContext(alert.safe_context),
        })),
      });
    }),
  );

  return router;
}

async function readSnapshot(
  ports: OperationsDiagnosticsPorts,
): Promise<{ snapshot: OperationsHealthSnapshot; safetyBlocked: boolean }> {
  const [runtimes, observations, diagnosticPayloads] = await Promise.all([
    ports.readRuntimes(),
    ports.readHealthObservations(),
    ports.readDiagnosticPayloads?.() ?? Promise.resolve([]),
  ]);
  const sourcePayloads = [
    { candidate: ports.candidate, runtimes, observations },
    ...diagnosticPayloads,
  ];
  const leakageIssues = sourcePayloads.flatMap(
    (payload): readonly OperationsIssue[] => scanOperationalLeakage(payload).issues,
  );
  const snapshot = buildOperationsHealthSnapshot({
    generated_at: (ports.now?.() ?? new Date()).toISOString(),
    candidate: ports.candidate,
    runtimes,
    ...observations,
    leakage_issues: leakageIssues,
  });
  return { snapshot, safetyBlocked: leakageIssues.length > 0 };
}

function protectedAdminOperation(
  ports: OperationsDiagnosticsPorts,
  handler: RequestHandler,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const authorization = await ports.authorizeAdmin(request);
      if (!isExactCurrentAdmin(authorization)) {
        sendAllowlistedJson(response, 404, {
          success: false,
          code: 'not_found',
          message: 'Resource was not found.',
        });
        return;
      }
      await handler(request, response, next);
    } catch {
      sendAllowlistedJson(response, 503, {
        success: false,
        code: 'ops_diagnostics_unavailable',
        message: 'Operational diagnostics are unavailable.',
      });
    }
  };
}

function isExactCurrentAdmin(
  authorization: OperationsAdminAuthorization,
): authorization is { authorized: true; principal: OperationsAdminPrincipal } {
  if (!authorization || authorization.authorized !== true) return false;
  const principal = authorization.principal;
  return (
    principal?.source === 'server_session' &&
    principal.role === 'admin' &&
    principal.current === true &&
    isSafeOperationsIdentifier(principal.principal_id) &&
    isSafeOperationsIdentifier(principal.account_key) &&
    isSafeOperationsIdentifier(principal.product_key) &&
    isSafeOperationsIdentifier(principal.session_id)
  );
}

function runtimeIdentityResponse(
  candidate: CandidateIdentity,
  runtimes: readonly RuntimeIdentity[],
  agreement: ReturnType<typeof evaluateRuntimeAgreement>,
) {
  return {
    schema_version: OPERATIONS_CONTRACT_VERSION,
    candidate: {
      schema_version: candidate.schema_version,
      candidate_id: candidate.candidate_id,
      repository_sha: candidate.repository_sha,
      application_source_sha: candidate.application_source_sha,
      release: candidate.release,
      configuration_digest: candidate.configuration_digest,
      migration_inventory_digest: candidate.migration_inventory_digest,
      provider_registry_digest: candidate.provider_registry_digest,
      public_asset_digest: candidate.public_asset_digest,
      specification_digest: candidate.specification_digest,
      acceptance_contract_digest: candidate.acceptance_contract_digest,
      runtime_tier: candidate.runtime_tier,
      verification_environment_id: candidate.verification_environment_id,
      operations_inventory: {
        runtime_expectations: candidate.operations_inventory.runtime_expectations.map(
          (expectation) => ({
            runtime_id: expectation.runtime_id,
            service_role: expectation.service_role,
            artifact_digest: expectation.artifact_digest,
          }),
        ),
        required_queues: candidate.operations_inventory.required_queues.map((queue) => ({
          queue: queue.queue,
          queue_class: queue.queue_class,
        })),
        required_workers: candidate.operations_inventory.required_workers.map((worker) => ({
          worker_type: worker.worker_type,
        })),
        providers: candidate.operations_inventory.providers.map((provider) => ({
          provider: provider.provider,
          required: provider.required,
        })),
        maximum_observation_age_ms: candidate.operations_inventory.maximum_observation_age_ms,
        migration_inventory_required: candidate.operations_inventory.migration_inventory_required,
      },
    },
    runtimes: runtimes.map((runtime) => ({
      schema_version: runtime.schema_version,
      runtime_id: runtime.runtime_id,
      service_role: runtime.service_role,
      release: runtime.release,
      repository_sha: runtime.repository_sha,
      application_source_sha: runtime.application_source_sha,
      artifact_digest: runtime.artifact_digest,
      configuration_digest: runtime.configuration_digest,
      migration_inventory_digest: runtime.migration_inventory_digest,
      provider_registry_digest: runtime.provider_registry_digest,
      runtime_tier: runtime.runtime_tier,
      verification_environment_id: runtime.verification_environment_id,
    })),
    agreement: {
      ok: agreement.ok,
      issues: agreement.issues.map(allowlistedIssue),
    },
  };
}

function healthResponse(snapshot: OperationsHealthSnapshot) {
  return {
    schema_version: snapshot.schema_version,
    generated_at: snapshot.generated_at,
    status: snapshot.status,
    candidate_id: snapshot.candidate_id,
    runtime_tier: snapshot.runtime_tier,
    verification_environment_id: snapshot.verification_environment_id,
    runtime_agreement: snapshot.runtime_agreement,
    migration_drift: snapshot.migration_drift,
    evidence_ready: snapshot.evidence_ready,
    database: {
      observed_at: snapshot.database.observed_at,
      evidence_qualified: snapshot.database.evidence_qualified,
      available: snapshot.database.available,
      consecutive_failed_minute_probes: snapshot.database.consecutive_failed_minute_probes,
      latency_ms: snapshot.database.latency_ms,
      storage_percent: snapshot.database.storage_percent,
      connection_utilization_percent: snapshot.database.connection_utilization_percent,
      high_connection_utilization_age_ms: snapshot.database.high_connection_utilization_age_ms,
      blocking_lock_age_ms: snapshot.database.blocking_lock_age_ms,
    },
    queues: snapshot.queues.map((queue) => ({
      observed_at: queue.observed_at,
      evidence_qualified: queue.evidence_qualified,
      queue: queue.queue,
      queue_class: queue.queue_class,
      depth: queue.depth,
      oldest_ready_age_ms: queue.oldest_ready_age_ms,
      oldest_lease_age_ms: queue.oldest_lease_age_ms,
      retry_count: queue.retry_count,
      acceptance_unknown_count: queue.acceptance_unknown_count,
      dead_letter_count: queue.dead_letter_count,
      expired_lease_count: queue.expired_lease_count,
      throughput_15m: queue.throughput_15m,
      duplicate_effect_risk: queue.duplicate_effect_risk,
    })),
    workers: snapshot.workers.map((worker) => ({
      observed_at: worker.observed_at,
      evidence_qualified: worker.evidence_qualified,
      worker_type: worker.worker_type,
      heartbeat_age_ms: worker.heartbeat_age_ms,
      source_agrees_with_candidate: worker.source_agrees_with_candidate,
      configuration_agrees_with_candidate: worker.configuration_agrees_with_candidate,
    })),
    providers: snapshot.providers.map((provider) => ({
      observed_at: provider.observed_at,
      evidence_qualified: provider.evidence_qualified,
      provider: provider.provider,
      required: provider.required,
      state: provider.state,
      unavailable_age_ms: provider.unavailable_age_ms,
      credential_expires_in_ms: provider.credential_expires_in_ms,
      safe_account_ref: provider.safe_account_ref,
    })),
    issues: snapshot.issues.map(allowlistedIssue),
  };
}

function allowlistedIssue(issue: OperationsIssue) {
  return {
    code: issue.code,
    category: issue.category,
    severity: issue.severity,
    summary: issue.summary,
    safe_context: allowlistedSafeContext(issue.safe_context),
  };
}

function allowlistedSafeContext(
  context: Readonly<Record<string, string | number | boolean | null>>,
): Readonly<Record<string, string | number | boolean | null>> {
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(context)) {
    if (/^[a-z][a-z0-9_]{0,63}$/.test(key)) output[key] = value;
  }
  return output;
}

function sendAllowlistedJson(response: Response, status: number, body: unknown): void {
  const intendedScan = scanOperationalLeakage(body);
  const redacted = redactOperationalData(body);
  const serialized = JSON.stringify(redacted);
  const exactFinalBody = JSON.parse(serialized) as unknown;
  const finalScan = scanOperationalLeakage(exactFinalBody);
  if (!intendedScan.passed || !finalScan.passed) {
    sendSafetyBlocked(response);
    return;
  }
  response.status(status).type('application/json').send(serialized);
}

function sendSafetyBlocked(response: Response): void {
  response.status(503).json({
    schema_version: OPERATIONS_CONTRACT_VERSION,
    success: false,
    code: 'ops_diagnostic_safety_block',
    message: 'Operational response was blocked.',
  });
}

function setOperationsResponseHeaders(
  _request: Request,
  response: Response,
  next: express.NextFunction,
): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}
