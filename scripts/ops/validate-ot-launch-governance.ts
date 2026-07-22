import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalTextForHash } from './canonical-text.ts';

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
const boardText = await readFile(path.join(repoRoot, boardPath), 'utf8');
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

const sourceHash = `sha256:${createHash('sha256').update(canonicalTextForHash(boardText)).digest('hex')}`;
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
const outcome = objectAt(board, 'outcome');
const parsedBoardStrings = collectStrings(board);
const suspiciousTruncatedStrings = parsedBoardStrings.filter(({ value }) =>
  /\bPR$/u.test(value.trim()),
);
const unquotedHashCommentHazards = findUnquotedHashCommentHazards(boardText);
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
const criticalParsedSubstrings = [
  'PR #97 exact head 312097c0d8707b48b68cf282169b04d62b71ba6d semantically integrates accepted PR #105 successor head e81de91a7372114c6b0a67a7cbb0abc9cb548885',
  'PR #104 prefix 2214',
  'PR #105 exact successor head e81de91a7372114c6b0a67a7cbb0abc9cb548885',
  'PR #106 exact production head acddcc8cd012c5cdc5bfc08cbc80550bef8719ba',
  'Terminal PR #107 head 1e247c70004dffb6247fc1ee407f1153d753bd7d',
  'PR #108 head 4540861a7f7ad950041e4ae58202537055fe59ad',
  'PR #109 head 1779254768dacebb84aeac5d71b56b5abfba2534',
  'PR #110 exact head 38358961cff6c6bf44621ab9e3f6b88061586618',
  'PR #141 exact head adf0189ddbb3f279683d58ec44edb5ca0e9f1fbe',
];
record(
  'critical PR scalars parse intact',
  String(outcome.production_impact).includes('PR #106') &&
    String(outcome.current_summary).includes('PR #97') &&
    String(outcome.current_summary).includes('PR #108') &&
    String(outcome.current_summary).includes('PR #105') &&
    criticalParsedSubstrings.every((expected) =>
      parsedBoardStrings.some(({ value }) => value.includes(expected)),
    ),
  `${criticalParsedSubstrings.length} critical parsed substrings preserved`,
);
record(
  'parsed strings have no hash-comment truncation',
  suspiciousTruncatedStrings.length === 0,
  `${parsedBoardStrings.length} strings scanned; suspicious=${
    suspiciousTruncatedStrings
      .map(({ path: valuePath, value }) => `${valuePath}=${JSON.stringify(value)}`)
      .join(', ') || 'none'
  }`,
);
record(
  'board has no unquoted hash-comment hazards',
  unquotedHashCommentHazards.length === 0,
  unquotedHashCommentHazards.join(', ') || 'none',
);
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
  'accepted Tisha production plus isolated preview block',
  tracks.some((track) => {
    const owner = objectAt(track, 'owner');
    return (
      track.id === 'tisha_landing_polish' &&
      track.status === 'blocked' &&
      owner.pr === 110 &&
      owner.head === '38358961cff6c6bf44621ab9e3f6b88061586618' &&
      track.preview_review_state === 'PREVIEW_VERIFIED_PRODUCTION_BLOCKED' &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('acddcc8cd012c5cdc5bfc08cbc80550bef8719ba'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('81317abe-f3ef-42cd-b5db-5814b014b6a3'),
      ) &&
      parsedBoardStrings.some(({ value }) =>
        value.includes('PR #110 is not integrated into PR #97'),
      )
    );
  }),
  'PR #106 acddcc8 remains accepted production while PR #110 3835896 is isolated',
);
record(
  'Zoom SDK preview and real control remain distinct',
  tracks.some((track) => {
    const owner = objectAt(track, 'owner');
    return (
      track.id === 'zoom_meeting_sdk' &&
      track.status === 'provider_off' &&
      owner.head === 'e81de91a7372114c6b0a67a7cbb0abc9cb548885' &&
      track.zoom_ui_preview_state === 'READY' &&
      track.zoom_real_control_state === 'PROVIDER_OFF'
    );
  }) &&
    tracks.some((track) => {
      const owner = objectAt(track, 'owner');
      return (
        track.id === 'zoom_s2s_host_control' &&
        track.status === 'provider_off' &&
        owner.head === 'e81de91a7372114c6b0a67a7cbb0abc9cb548885' &&
        track.zoom_ui_preview_state === 'READY' &&
        track.zoom_real_control_state === 'PROVIDER_OFF'
      );
    }) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes(
        'ZOOM_MEETING_SDK_CLIENT_ID, ZOOM_MEETING_SDK_CLIENT_SECRET, and ZOOM_MEETING_SDK_WEB_VERSION',
      ),
    ) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes(
        'ZOOM_ACCOUNT_ID, ZOOM_S2S_CLIENT_ID, ZOOM_S2S_CLIENT_SECRET, ZOOM_HOST_USER_ID, ZOOM_REAL_CONTROL_MEETING_ID, and ZOOM_REAL_CONTROL_MEETING_PASSCODE',
      ),
    ),
  'isolated SDK setup READY; six-gate real control PROVIDER_OFF',
);
record(
  'honest GHL enrollment truth',
  parsedBoardStrings.some(({ value }) =>
    value.includes('OT-07 and OT-08 each read back 0 total / 0 active'),
  ) &&
    parsedBoardStrings.some(({ value }) =>
      value.includes('GHL-GOVERNANCE-CLOSEOUT-20260722.result.json'),
    ),
  'zero counts require the committed timestamped closeout readback',
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

function collectStrings(value: unknown, valuePath = '$'): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path: valuePath, value }];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectStrings(entry, `${valuePath}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    collectStrings(entry, `${valuePath}.${key}`),
  );
}

function findUnquotedHashCommentHazards(source: string) {
  const hazards: string[] = [];
  for (const [lineIndex, line] of source.split(/\r?\n/u).entries()) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === "'" && !inDoubleQuote) {
        if (inSingleQuote && line[index + 1] === "'") {
          index += 1;
        } else {
          inSingleQuote = !inSingleQuote;
        }
        continue;
      }
      if (character === '"' && !inSingleQuote && line[index - 1] !== '\\') {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (
        character === '#' &&
        !inSingleQuote &&
        !inDoubleQuote &&
        (index === 0 || /\s/u.test(line[index - 1] ?? ''))
      ) {
        hazards.push(`line ${lineIndex + 1}`);
        break;
      }
    }
  }
  return hazards;
}
