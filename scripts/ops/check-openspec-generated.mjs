import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const generatedSkills = [
  '.agents/skills/openspec-apply-change/SKILL.md',
  '.agents/skills/openspec-archive-change/SKILL.md',
  '.agents/skills/openspec-explore/SKILL.md',
  '.agents/skills/openspec-propose/SKILL.md',
  '.agents/skills/openspec-sync-specs/SKILL.md',
  '.agents/skills/openspec-update-change/SKILL.md',
];

const fail = (message) => {
  console.error('openspec-generated: ' + message);
  process.exit(1);
};

for (const skill of generatedSkills) {
  if (!existsSync(path.join(root, skill))) fail('missing generated skill: ' + skill);
}

const ignoredOpenSpecSkills = readFileSync(path.join(root, '.prettierignore'), 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('.agents/skills/openspec-'));
if (
  ignoredOpenSpecSkills.length !== generatedSkills.length ||
  ignoredOpenSpecSkills.some((skill, index) => skill !== generatedSkills[index])
) {
  fail('the Prettier exemption must contain only the exact pinned OpenSpec skill files.');
}

const broadAgentIgnore = readFileSync(path.join(root, '.prettierignore'), 'utf8').match(
  /^\.agents\/(?:\*\*|skills\/\*\*|skills\/openspec-\*)$/mu,
);
if (broadAgentIgnore) fail('broad .agents formatting exemptions are not allowed.');

const update = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'ops', 'run-openspec.mjs'), 'update'],
  { cwd: root, stdio: 'inherit' },
);
if (update.status !== 0) process.exit(update.status ?? 1);

const clean = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', ...generatedSkills], {
  cwd: root,
  stdio: 'inherit',
});
if (clean.status !== 0) {
  fail(
    'pinned openspec update changed a generated skill; update the generated artifacts intentionally.',
  );
}

process.stdout.write(
  'openspec-generated: PASS (6 exact generated skills, update leaves tracked bytes unchanged)\n',
);
