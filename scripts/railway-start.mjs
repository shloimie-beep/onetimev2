import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CONTENT_FACTORY_CHILD_KEYS = [
  'APP_VERSION',
  'COMMIT_SHA',
  'CONTENT_FACTORY_LEASE_MS',
  'CONTENT_FACTORY_MAX_UPLOAD_BYTES',
  'CONTENT_FACTORY_POLL_INTERVAL_MS',
  'CONTENT_FACTORY_PROCESSING_MODE',
  'CONTENT_FACTORY_STORAGE_DRIVER',
  'CONTENT_FACTORY_STORAGE_ROOT',
  'CONTENT_FACTORY_WORKER_ENABLED',
  'DATABASE_SSL',
  'DATABASE_URL',
  'HOSTNAME',
  'NODE_EXTRA_CA_CERTS',
  'ONE_TIME_ACCOUNT_KEY',
  'ONE_TIME_PRODUCT_KEY',
  'OPERATIONS_WORKER_HEARTBEAT_TTL_MS',
  'OT_WORKER_INSTANCE_ID',
  'PATH',
  'RAILWAY_DEPLOYMENT_ID',
  'RAILWAY_ENVIRONMENT_ID',
  'RAILWAY_GIT_COMMIT_SHA',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_REPLICA_ID',
  'RAILWAY_SERVICE_ID',
  'RAILWAY_SERVICE_NAME',
  'RAILWAY_SNAPSHOT_ID',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'TZ',
];

export function contentFactoryChildEnvironment(source) {
  return Object.fromEntries(
    CONTENT_FACTORY_CHILD_KEYS.flatMap((key) =>
      source[key] === undefined ? [] : [[key, source[key]]],
    ),
  );
}

export function railwayProcessEntries(source) {
  const processType = source.PROCESS_TYPE || source.RAILWAY_PROCESS_TYPE || 'web';
  if (processType === 'worker') {
    return [{ entry: 'apps/worker/src/main/index.ts', env: source }];
  }
  if (source.CONTENT_FACTORY_COLOCATED_WORKER === 'true') {
    return [
      { entry: 'apps/web/src/server/index.ts', env: source },
      {
        entry: 'apps/worker/src/content-factory/index.ts',
        env: contentFactoryChildEnvironment(source),
      },
    ];
  }
  return [{ entry: 'apps/web/src/server/index.ts', env: source }];
}

export function runRailwayProcess(source = process.env) {
  const entries = railwayProcessEntries(source);
  const children = entries.map(({ entry, env }) =>
    spawn(process.execPath, ['--import', 'tsx', entry], {
      stdio: 'inherit',
      env,
    }),
  );
  let exiting = false;

  for (const child of children) {
    child.on('exit', (code, signal) => {
      if (exiting) return;
      exiting = true;
      for (const sibling of children) {
        if (sibling !== child && !sibling.killed) sibling.kill('SIGTERM');
      }
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    });
  }

  function forwardSignal(signal) {
    if (exiting) return;
    exiting = true;
    for (const child of children) {
      if (!child.killed) child.kill(signal);
    }
  }

  process.once('SIGTERM', () => forwardSignal('SIGTERM'));
  process.once('SIGINT', () => forwardSignal('SIGINT'));

  process.once('exit', () => {
    if (exiting) return;
    for (const child of children) {
      if (!child.killed) child.kill('SIGTERM');
    }
  });

  for (const child of children) {
    child.on('error', () => {
      if (exiting) return;
      exiting = true;
      for (const sibling of children) {
        if (sibling !== child && !sibling.killed) sibling.kill('SIGTERM');
      }
      process.exit(1);
    });
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) runRailwayProcess();
