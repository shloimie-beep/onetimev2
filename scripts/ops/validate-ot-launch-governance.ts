import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load(source: string): unknown };
const repoRoot = process.cwd();
const boardPath = 'ops/goals/OT-LAUNCH-01/BOARD.yaml';
const pointerPath = 'ops/previews/current.json';
const writePointer = process.argv.includes('--write-pointer');
const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

const current = await readYaml<Record<string, unknown>>('ops/goals/CURRENT.yaml');
const spec = await readYaml<Record<string, unknown>>('ops/goals/OT-LAUNCH-01/SPEC.yaml');
const acceptance = await readYaml<Record<string, unknown>>(
  'ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml',
);
const decisions = await readYaml<Record<string, unknown>>('ops/goals/OT-LAUNCH-01/DECISIONS.yaml');
const boardBytes = await readFile(path.join(repoRoot, boardPath));
const boardText = boardBytes.toString('utf8');
const board = parseYaml<Record<string, unknown>>(boardText, boardPath);
const ramble = await readText('ops/goals/OT-LAUNCH-01/RAMBLE-PROTOCOL.md');
const goalSkill = await readSkill('.agents/skills/one-time-goal-executor/SKILL.md');
const ghlSkill = await readSkill('.agents/skills/one-time-ghl-ui-job/SKILL.md');
const goalSkillUi = await readYaml<Record<string, unknown>>(
  '.agents/skills/one-time-goal-executor/agents/openai.yaml',
);
const ghlSkillUi = await readYaml<Record<string, unknown>>(
  '.agents/skills/one-time-ghl-ui-job/agents/openai.yaml',
);

const sourceHash = `sha256:${createHash('sha256').update(boardBytes).digest('hex')}`;
const expectedPointer = {
  schema_version: 1,
  goal_id: 'OT-LAUNCH-01',
  generated_from_board: boardPath,
  source_hash: sourceHash,
  generated_at: String(board.updated_at ?? ''),
};
if (writePointer) {
  await writeFile(
    path.join(repoRoot, pointerPath),
    `${JSON.stringify(expectedPointer, null, 2)}\n`,
    'utf8',
  );
}
const pointer = JSON.parse(await readText(pointerPath)) as Record<string, unknown>;

record(
  'single current goal',
  current.goal_id === 'OT-LAUNCH-01' &&
    current.goal_path === 'ops/goals/OT-LAUNCH-01' &&
    current.board === boardPath,
  `${String(current.goal_id)} -> ${String(current.board)}`,
);
record(
  'single status source',
  spec.source_of_status === boardPath && acceptance.source_of_status === boardPath,
  'SPEC and ACCEPTANCE derive status from BOARD',
);
const statusDefinitions = objectAt(board, 'status_definitions');
record(
  'board status vocabulary',
  sameSet(Object.keys(statusDefinitions), [
    'unclaimed',
    'active',
    'waiting_external',
    'ready_for_convergence',
    'done',
    'blocked',
    'provider_off',
    'needs_operator_decision',
    'superseded',
  ]),
  Object.keys(statusDefinitions).join(', '),
);
const tracks = arrayAt<Record<string, unknown>>(board, 'tracks');
const trackIds = tracks.map((track) => String(track.id));
record('unique tracks', new Set(trackIds).size === trackIds.length, `${trackIds.length} tracks`);
record(
  'structured track owners',
  tracks.every((track) => {
    const owner = objectAt(track, 'owner');
    return ['task_id', 'repository', 'branch', 'pr', 'system'].every((field) => field in owner);
  }),
  'task_id/repository/branch/pr/system present for every track',
);
record(
  'queued video track',
  tracks.some(
    (track) =>
      track.id === 'VIDEO-TO-CLASSROOM-E2E' &&
      track.status === 'unclaimed' &&
      arrayAt<string>(track, 'acceptance_ids').includes('VIDEO-E2E-001'),
  ),
  'VIDEO-TO-CLASSROOM-E2E remains unclaimed',
);
record(
  'terminal Tisha evidence',
  tracks.some((track) => {
    const owner = objectAt(track, 'owner');
    return (
      track.id === 'tisha_landing_polish' &&
      track.status === 'done' &&
      owner.pr === 106 &&
      owner.head === 'fab0dfa110e4712f4a63bf8a84641d355accdac0'
    );
  }),
  'PR #106 fab0dfa terminal',
);
record(
  'honest GHL enrollment truth',
  !/OT-07 and OT-08[^\n]*zero (?:total|active|enrollment)/iu.test(boardText) &&
    boardText.includes('enrollment counts are Unavailable'),
  'Draft existence is separate from count readback',
);
record(
  'goal decisions parsed',
  Array.isArray(decisions.decisions) && decisions.decisions.length > 0,
  `${Array.isArray(decisions.decisions) ? decisions.decisions.length : 0} decisions`,
);
record(
  'ramble visual loop',
  ramble.includes('observable breakpoint checks') &&
    ramble.includes('Inspect the current deployed page') &&
    ramble.includes('verify the exact deployed URL/head'),
  'breakpoint acceptance, inspection, repair, retest, deploy proof',
);
record(
  'goal executor contract',
  goalSkill.frontmatter.name === 'one-time-goal-executor' &&
    goalSkill.body.includes('single editable automation inventory') &&
    goalSkill.body.includes('DRAFT_WAITING_EXTERNAL') &&
    goalSkill.body.includes('full nested folder topology'),
  String(goalSkill.frontmatter.name),
);
record(
  'GHL UI skill contract',
  ghlSkill.frontmatter.name === 'one-time-ghl-ui-job' &&
    ghlSkill.body.includes('single editable automation inventory') &&
    ghlSkill.body.includes('DRAFT_WAITING_EXTERNAL') &&
    ghlSkill.body.includes('essential values') &&
    ghlSkill.body.includes('Email Marketing campaign'),
  String(ghlSkill.frontmatter.name),
);
record(
  'skill UI metadata',
  Boolean(objectAt(goalSkillUi, 'interface').default_prompt) &&
    Boolean(objectAt(ghlSkillUi, 'interface').default_prompt),
  'both agents/openai.yaml files parse with default prompts',
);
record(
  'pointer-only board projection',
  JSON.stringify(pointer) === JSON.stringify(expectedPointer) &&
    Object.keys(pointer).every((key) => Object.hasOwn(expectedPointer, key)),
  sourceHash,
);

const passed = checks.every((check) => check.passed);
process.stdout.write(
  `${JSON.stringify({ status: passed ? 'passed' : 'failed', checks }, null, 2)}\n`,
);
if (!passed) process.exitCode = 1;

function record(name: string, passed: boolean, detail: string) {
  checks.push({ name, passed, detail });
}

async function readText(filePath: string) {
  return readFile(path.join(repoRoot, filePath), 'utf8');
}

async function readYaml<T>(filePath: string) {
  return parseYaml<T>(await readText(filePath), filePath);
}

function parseYaml<T>(source: string, filePath: string) {
  const value = yaml.load(source);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`yaml_root_invalid:${filePath}`);
  }
  return value as T;
}

async function readSkill(filePath: string) {
  const source = await readText(filePath);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(source);
  if (!match) throw new Error(`skill_frontmatter_invalid:${filePath}`);
  return {
    frontmatter: parseYaml<Record<string, unknown>>(match[1] ?? '', filePath),
    body: match[2] ?? '',
  };
}

function objectAt(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error(`object_missing:${key}`);
  }
  return candidate as Record<string, unknown>;
}

function arrayAt<T>(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  if (!Array.isArray(candidate)) throw new Error(`array_missing:${key}`);
  return candidate as T[];
}

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
