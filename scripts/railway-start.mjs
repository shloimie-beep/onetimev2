import { spawn } from 'node:child_process';

const processType = process.env.PROCESS_TYPE || process.env.RAILWAY_PROCESS_TYPE || 'web';
const entry =
  processType === 'worker' ? 'apps/worker/src/main/index.ts' : 'apps/web/src/server/index.ts';
const child = spawn(process.execPath, ['--import', 'tsx', entry], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
