import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const requiredTracks = [
  'product',
  'ui-shell',
  'parent-experience',
  'student-experience',
  'identity-access',
  'classroom-zoom',
  'content-media',
  'communications',
  'billing-access',
  'operations-control-plane',
];
const failures = [];
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const requireText = (condition, message) => {
  if (!condition) failures.push(message);
};
const agents = read('AGENTS.md');
const readme = read('README.md');
requireText(
  !/downloads[\\/]/iu.test(agents),
  'AGENTS.md must not name a local Downloads authority.',
);
requireText(
  !/BOARD\.yaml\s+is\s+the\s+only\s+current\s+status\s+map/iu.test(readme),
  'README.md must not reactivate BOARD.yaml as the current status map.',
);
for (const track of requiredTracks) {
  requireText(
    existsSync(path.join(root, 'openspec', 'specs', track, 'spec.md')),
    'Missing required OpenSpec track: ' + track + '.',
  );
}
requireText(existsSync(path.join(root, 'DESIGN.md')), 'DESIGN.md is required.');
requireText(
  !existsSync(path.join(root, '.agents', 'skills', 'one-time-goal-executor', 'SKILL.md')),
  'The retired one-time-goal-executor skill must not remain active.',
);
const skillsRoot = path.join(root, '.agents', 'skills');
const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(absolute);
    if (entry.isFile() && entry.name === 'SKILL.md') {
      const text = readFileSync(absolute, 'utf8');
      requireText(
        !/(canonical One Time goal system|conductor-assigned|persistent-staging conductor|BOARD\.yaml.*claim|claim\/lease)/iu.test(
          text,
        ),
        'Active skill still points to the retired conductor/claim system: ' +
          path.relative(root, absolute) +
          '.',
      );
    }
  }
};
visit(skillsRoot);
const designCli = path.join(root, 'node_modules', '@google', 'design.md', 'dist', 'index.js');
const designResult = spawnSync(process.execPath, [designCli, 'lint', 'DESIGN.md'], {
  cwd: root,
  encoding: 'utf8',
});
if (designResult.stdout) process.stdout.write(designResult.stdout);
if (designResult.stderr) process.stderr.write(designResult.stderr);
requireText(designResult.status === 0, 'DESIGN.md lint failed.');
if (failures.length > 0) {
  for (const failure of failures) console.error('source-truth: ' + failure);
  process.exit(1);
}
process.stdout.write(
  'source-truth: PASS (' +
    requiredTracks.length +
    ' OpenSpec tracks, DESIGN.md, and active skills)\n',
);
