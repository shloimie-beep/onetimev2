import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cli = path.join(root, 'node_modules', '@fission-ai', 'openspec', 'bin', 'openspec.js');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
