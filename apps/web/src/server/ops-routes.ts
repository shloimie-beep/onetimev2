import type express from 'express';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';
import type { AuthenticatedSession } from '../../../../packages/domain/src/index.ts';
import {
  collectOpsHealthSnapshot,
  deterministicAlertSink,
  evaluateOpsAlerts,
} from '../../../../packages/observability/src/index.ts';

type OpsRouteDeps = {
  app: express.Express;
  config: AppConfig;
  pool: DbPool;
  sessionFromRequest: (req: Request) => Promise<OpsSessionResolution>;
  setPrivateNoStore: (res: Response) => void;
  clock?: () => Date;
};

type OpsSessionResolution =
  { status: 'resolved'; session: AuthenticatedSession } | { status: 'missing' | 'unavailable' };

export function registerOpsRoutes(deps: OpsRouteDeps) {
  deps.app.get('/api/internal/ops/diagnostics', async (req, res) => {
    deps.setPrivateNoStore(res);
    if (!(await canReadOps(req, deps))) {
      res.status(403).json({ success: false, code: 'OPS_DIAGNOSTICS_FORBIDDEN' });
      return;
    }
    const snapshot = await collectOpsHealthSnapshot({
      pool: deps.pool,
      config: deps.config,
      ...(deps.clock ? { now: deps.clock() } : {}),
    });
    const alerts = evaluateOpsAlerts(snapshot);
    res.status(snapshot.ok ? 200 : 503).json({
      success: snapshot.ok,
      snapshot,
      alerts: deterministicAlertSink(alerts),
      runtime: protectedRuntimeIdentity(deps.config),
    });
  });

  deps.app.get('/api/internal/ops/metrics', async (req, res) => {
    deps.setPrivateNoStore(res);
    if (!(await canReadOps(req, deps))) {
      res.status(403).type('text/plain').send('forbidden\n');
      return;
    }
    const snapshot = await collectOpsHealthSnapshot({
      pool: deps.pool,
      config: deps.config,
      ...(deps.clock ? { now: deps.clock() } : {}),
    });
    res
      .status(snapshot.ok ? 200 : 503)
      .type('text/plain')
      .send(prometheusSnapshot(snapshot));
  });

  deps.app.get('/api/v1/ops/diagnostics', async (req, res) => {
    deps.setPrivateNoStore(res);
    const resolution = await deps.sessionFromRequest(req);
    if (resolution.status === 'unavailable') {
      res.status(503).json({ success: false, code: 'OPS_DIAGNOSTICS_UNAVAILABLE' });
      return;
    }
    if (
      resolution.status !== 'resolved' ||
      !['owner', 'admin'].includes(resolution.session.user.role)
    ) {
      res.status(403).json({ success: false, code: 'OPS_OWNER_DIAGNOSTICS_FORBIDDEN' });
      return;
    }
    const snapshot = await collectOpsHealthSnapshot({
      pool: deps.pool,
      config: deps.config,
      ...(deps.clock ? { now: deps.clock() } : {}),
    });
    res.status(snapshot.ok ? 200 : 503).json({
      success: snapshot.ok,
      snapshot,
      runtime: protectedRuntimeIdentity(deps.config),
    });
  });
}

function protectedRuntimeIdentity(config: AppConfig) {
  return Object.freeze({
    version: config.appVersion,
    commit_sha: config.commitSha,
    target_app: 'one-time',
    deployment: {
      provider: 'railway',
      deployment_id: config.railwayDeploymentId ?? null,
      snapshot_id: config.railwaySnapshotId ?? null,
      project_id: config.railwayProjectId ?? null,
      environment_id: config.railwayEnvironmentId ?? null,
      service_id: config.railwayServiceId ?? null,
      service_name: config.railwayServiceName ?? null,
      git_commit_sha: config.railwayGitCommitSha ?? null,
    },
  });
}

async function canReadOps(req: Request, deps: OpsRouteDeps) {
  const header = req.header('x-ops-probe-token');
  if (deps.config.operationsProbeToken && header === deps.config.operationsProbeToken) {
    return true;
  }
  const resolution = await deps.sessionFromRequest(req);
  return Boolean(
    resolution.status === 'resolved' && ['owner', 'admin'].includes(resolution.session.user.role),
  );
}

function prometheusSnapshot(snapshot: Awaited<ReturnType<typeof collectOpsHealthSnapshot>>) {
  const lines = [
    '# HELP onetime_ready One Time readiness status, 1 is ready.',
    '# TYPE onetime_ready gauge',
    `onetime_ready ${snapshot.ok ? 1 : 0}`,
    '# HELP onetime_queue_ready_count Ready queue rows by queue.',
    '# TYPE onetime_queue_ready_count gauge',
  ];
  for (const queue of snapshot.queues) {
    const label = labelValue(queue.queue);
    lines.push(`onetime_queue_ready_count{queue="${label}"} ${queue.ready_count}`);
    lines.push(`onetime_queue_leased_count{queue="${label}"} ${queue.leased_count}`);
    lines.push(`onetime_queue_expired_lease_count{queue="${label}"} ${queue.expired_lease_count}`);
    lines.push(`onetime_queue_retry_count{queue="${label}"} ${queue.retry_count}`);
    lines.push(`onetime_queue_dead_letter_count{queue="${label}"} ${queue.dead_letter_count}`);
    lines.push(`onetime_queue_throughput_15m{queue="${label}"} ${queue.throughput_15m}`);
  }
  lines.push('# HELP onetime_worker_heartbeat_age_ms Worker heartbeat age in milliseconds.');
  lines.push('# TYPE onetime_worker_heartbeat_age_ms gauge');
  for (const worker of snapshot.workers) {
    lines.push(
      `onetime_worker_heartbeat_age_ms{worker_type="${labelValue(
        worker.worker_type,
      )}",state="${labelValue(worker.state)}"} ${worker.heartbeat_age_ms}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function labelValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 120);
}
