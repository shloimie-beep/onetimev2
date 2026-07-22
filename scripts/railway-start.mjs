import { spawn } from 'node:child_process';

const processType = process.env.PROCESS_TYPE || process.env.RAILWAY_PROCESS_TYPE || 'web';
const entries =
  processType === 'worker'
    ? ['apps/worker/src/main/index.ts']
    : process.env.CONTENT_FACTORY_COLOCATED_WORKER === 'true'
      ? ['apps/web/src/server/index.ts', 'apps/worker/src/main/index.ts']
      : ['apps/web/src/server/index.ts'];
const children = entries.map((entry) =>
  spawn(process.execPath, ['--import', 'tsx', entry], {
    stdio: 'inherit',
    env: process.env,
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
