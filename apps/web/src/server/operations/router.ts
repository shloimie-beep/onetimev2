import express, { type Request, type RequestHandler } from 'express';
import {
  OPERATIONS_CONTRACT_VERSION,
  buildOperationsHealthSnapshot,
  evaluateOperationsAlerts,
  evaluateRuntimeAgreement,
  scanOperationalLeakage,
  type CandidateIdentity,
  type OperationsHealthInput,
  type OperationsIssue,
  type RuntimeIdentity,
} from '../../../../../packages/observability/v21/index.ts';

type HealthObservations = Omit<
  OperationsHealthInput,
  'candidate' | 'runtimes' | 'generated_at' | 'leakage_issues'
>;

export interface OperationsDiagnosticsPorts {
  authorize: (request: Request) => boolean | Promise<boolean>;
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
    protectedOperation(ports, async (_request, response) => {
      const runtimes = await ports.readRuntimes();
      const agreement = evaluateRuntimeAgreement({ candidate: ports.candidate, runtimes });
      response.status(agreement.ok ? 200 : 503).json({
        schema_version: OPERATIONS_CONTRACT_VERSION,
        candidate: ports.candidate,
        runtimes,
        agreement,
      });
    }),
  );

  router.get(
    '/health',
    protectedOperation(ports, async (_request, response) => {
      const snapshot = await readSnapshot(ports);
      response
        .status(snapshot.status === 'sev1' || snapshot.status === 'sev2' ? 503 : 200)
        .json(snapshot);
    }),
  );

  router.get(
    '/alerts',
    protectedOperation(ports, async (_request, response) => {
      const snapshot = await readSnapshot(ports);
      response.status(200).json({
        schema_version: OPERATIONS_CONTRACT_VERSION,
        generated_at: snapshot.generated_at,
        alerts: evaluateOperationsAlerts(snapshot),
      });
    }),
  );

  return router;
}

async function readSnapshot(ports: OperationsDiagnosticsPorts) {
  const [runtimes, observations, diagnosticPayloads] = await Promise.all([
    ports.readRuntimes(),
    ports.readHealthObservations(),
    ports.readDiagnosticPayloads?.() ?? Promise.resolve([]),
  ]);
  const leakageIssues = diagnosticPayloads.flatMap(
    (payload): readonly OperationsIssue[] => scanOperationalLeakage(payload).issues,
  );
  return buildOperationsHealthSnapshot({
    generated_at: (ports.now?.() ?? new Date()).toISOString(),
    candidate: ports.candidate,
    runtimes,
    ...observations,
    leakage_issues: leakageIssues,
  });
}

function protectedOperation(
  ports: OperationsDiagnosticsPorts,
  handler: RequestHandler,
): RequestHandler {
  return async (request, response, next) => {
    try {
      if (!(await ports.authorize(request))) {
        response.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: 'Resource was not found.',
        });
        return;
      }
      await handler(request, response, next);
    } catch {
      response.status(503).json({
        success: false,
        code: 'OPS_DIAGNOSTICS_UNAVAILABLE',
        message: 'Operational diagnostics are unavailable.',
      });
    }
  };
}

function setOperationsResponseHeaders(
  _request: Request,
  response: express.Response,
  next: express.NextFunction,
): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}
