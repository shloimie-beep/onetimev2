import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { canonicalTextForHash } from './canonical-text.ts';
import {
  buildOperatorLaunchStatusProjection,
  renderOperatorLaunchStatusModule,
} from './operator-launch-status-projection.ts';

const repoRoot = process.cwd();
const boardPath = path.join(repoRoot, 'ops/goals/OT-LAUNCH-01/BOARD.yaml');
const acceptancePath = path.join(repoRoot, 'ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml');
const outputPath = path.join(repoRoot, 'apps/web/src/server/generated/operator-launch-status.ts');
const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
if (write === check) {
  throw new Error('Choose exactly one of --write or --check.');
}

const projection = buildOperatorLaunchStatusProjection({
  boardText: await readFile(boardPath, 'utf8'),
  acceptanceText: await readFile(acceptancePath, 'utf8'),
});
const expected = await format(renderOperatorLaunchStatusModule(projection), {
  ...(await resolveConfig(outputPath)),
  parser: 'typescript',
});
if (write) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected, 'utf8');
} else {
  const observed = await readFile(outputPath, 'utf8').catch(() => '');
  if (canonicalTextForHash(observed) !== canonicalTextForHash(expected)) {
    throw new Error('operator_launch_status_projection_stale');
  }
}
process.stdout.write(
  `${JSON.stringify({
    status: write ? 'written' : 'passed',
    output: path.relative(repoRoot, outputPath).replaceAll('\\', '/'),
    board_source_hash: projection.board_source_hash,
    acceptance: {
      complete: projection.current_milestone.acceptance_complete,
      total: projection.current_milestone.acceptance_total,
      percentage: projection.current_milestone.percentage,
    },
  })}\n`,
);
