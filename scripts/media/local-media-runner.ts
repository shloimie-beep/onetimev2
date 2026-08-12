/**
 * Local-only media preparation queue.
 *
 * This runner intentionally has no OpenAI, Vimeo, Drive, or One Time import
 * implementation. Those effects remain an explicit, separately accepted
 * operator action. Its job is to turn a stable operator-owned recording into a
 * Vimeo-ready derivative and a redacted draft handoff manifest.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.mkv', '.mp4', '.mov']);
const TERMINAL_STATES = new Set(['complete', 'failed', 'unknown_provider_effect']);

export type LocalMediaSettings = {
  rootPath: string;
  incomingDir: string;
  processingDir: string;
  readyForVimeoDir: string;
  completeDir: string;
  failedDir: string;
  stateDir: string;
  logsDir: string;
  stableFileSeconds: number;
  rawSourceRetentionDays: number;
  transcriptionMode: 'off' | 'openai';
};

export type LocalMediaJobState =
  | 'waiting_for_stability'
  | 'ready_for_processing'
  | 'processing'
  | 'transcribing'
  | 'processed'
  | 'drive_archive_pending'
  | 'uploading_to_vimeo'
  | 'waiting_for_vimeo'
  | 'needs_occurrence_selection'
  | 'ready_for_import'
  | 'importing'
  | 'complete'
  | 'retry_wait'
  | 'failed'
  | 'unknown_provider_effect';

type RunnerOptions = {
  rootPath: string;
  once: boolean;
  processLocal: boolean;
  retrySourceSha256: string | null;
  applyTaskScheduler: boolean;
};

type JobRow = {
  source_sha256: string;
  source_path: string;
  display_name: string;
  state: LocalMediaJobState;
  source_size: number;
  source_mtime_ms: number;
  output_path: string | null;
  output_sha256: string | null;
  detail_code: string | null;
  updated_at: string;
};

export function parseRunnerOptions(argv: string[], environment = process.env): RunnerOptions {
  const value = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  return {
    rootPath:
      value('root') ??
      environment.ONE_TIME_MEDIA_ROOT ??
      path.join(environment.USERPROFILE ?? '.', 'OneTimeMedia'),
    once: argv.includes('--once'),
    processLocal: argv.includes('--process-local'),
    retrySourceSha256: value('retry-source-sha256') ?? null,
    applyTaskScheduler: argv.includes('--apply-task-scheduler'),
  };
}

export function isStableFile(input: {
  modifiedAtMs: number;
  nowMs: number;
  stableFileSeconds: number;
  previousSize: number | null;
  currentSize: number;
  previousModifiedAtMs: number | null;
}) {
  return (
    input.currentSize > 0 &&
    input.nowMs - input.modifiedAtMs >= input.stableFileSeconds * 1_000 &&
    (input.previousSize === null ||
      (input.previousSize === input.currentSize &&
        input.previousModifiedAtMs === input.modifiedAtMs))
  );
}

export function buildVimeoReadyFfmpegArgs(input: { sourcePath: string; outputPath: string }) {
  // Never trim a middle segment. Reviewers can decide whether edge trimming is appropriate later.
  return [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-i',
    input.sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,fps=30",
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    input.outputPath,
  ];
}

export function sanitizeJob(row: JobRow) {
  return {
    source_sha256: row.source_sha256,
    display_name: row.display_name,
    state: row.state,
    source_size: row.source_size,
    output_sha256: row.output_sha256,
    detail_code: row.detail_code,
    updated_at: row.updated_at,
    raw_paths_present: false,
    provider_effects_executed: false,
  };
}

async function loadSettings(rootPath: string): Promise<LocalMediaSettings> {
  const settingsPath = path.join(rootPath, 'Config', 'settings.local.json');
  const parsed = JSON.parse(
    (await readFile(settingsPath, 'utf8')).replace(/^\uFEFF/, ''),
  ) as Partial<LocalMediaSettings>;
  const required = [
    'incomingDir',
    'processingDir',
    'readyForVimeoDir',
    'completeDir',
    'failedDir',
    'stateDir',
    'logsDir',
  ] as const;
  for (const key of required)
    if (!parsed[key] || typeof parsed[key] !== 'string')
      throw new Error(`local_media_settings_${key}_required`);
  if (parsed.rootPath && path.resolve(parsed.rootPath) !== path.resolve(rootPath))
    throw new Error('local_media_settings_root_mismatch');
  return {
    rootPath,
    incomingDir: parsed.incomingDir!,
    processingDir: parsed.processingDir!,
    readyForVimeoDir: parsed.readyForVimeoDir!,
    completeDir: parsed.completeDir!,
    failedDir: parsed.failedDir!,
    stateDir: parsed.stateDir!,
    logsDir: parsed.logsDir!,
    stableFileSeconds: parsed.stableFileSeconds ?? 60,
    rawSourceRetentionDays: parsed.rawSourceRetentionDays ?? 7,
    transcriptionMode: parsed.transcriptionMode === 'off' ? 'off' : 'openai',
  };
}

function openState(settings: LocalMediaSettings) {
  const database = new DatabaseSync(path.join(settings.stateDir, 'local-media-runner.sqlite'));
  database.exec(`CREATE TABLE IF NOT EXISTS local_media_jobs (
    source_sha256 TEXT PRIMARY KEY, source_path TEXT NOT NULL, display_name TEXT NOT NULL,
    state TEXT NOT NULL, source_size INTEGER NOT NULL, source_mtime_ms INTEGER NOT NULL,
    output_path TEXT, output_sha256 TEXT, detail_code TEXT, updated_at TEXT NOT NULL
  )`);
  return database;
}

function getJob(database: DatabaseSync, sourceSha256: string) {
  return database
    .prepare('SELECT * FROM local_media_jobs WHERE source_sha256 = ?')
    .get(sourceSha256) as JobRow | undefined;
}

function saveJob(database: DatabaseSync, row: JobRow) {
  database
    .prepare(
      `INSERT INTO local_media_jobs
    (source_sha256,source_path,display_name,state,source_size,source_mtime_ms,output_path,output_sha256,detail_code,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_sha256) DO UPDATE SET source_path=excluded.source_path, display_name=excluded.display_name,
      state=excluded.state, source_size=excluded.source_size, source_mtime_ms=excluded.source_mtime_ms,
      output_path=excluded.output_path, output_sha256=excluded.output_sha256, detail_code=excluded.detail_code, updated_at=excluded.updated_at`,
    )
    .run(
      row.source_sha256,
      row.source_path,
      row.display_name,
      row.state,
      row.source_size,
      row.source_mtime_ms,
      row.output_path,
      row.output_sha256,
      row.detail_code,
      row.updated_at,
    );
}

async function checkFfprobe(filePath: string) {
  await runCommand('ffprobe', [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    filePath,
  ]);
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function processOneLocal(settings: LocalMediaSettings, database: DatabaseSync, row: JobRow) {
  const outputName = `${row.source_sha256.slice(0, 16)}-vimeo-ready.mp4`;
  const processingPath = path.join(settings.processingDir, outputName);
  const readyPath = path.join(settings.readyForVimeoDir, outputName);
  saveJob(database, {
    ...row,
    state: 'processing',
    detail_code: 'local_ffmpeg_in_progress',
    updated_at: new Date().toISOString(),
  });
  try {
    await runCommand(
      'ffmpeg',
      buildVimeoReadyFfmpegArgs({ sourcePath: row.source_path, outputPath: processingPath }),
    );
    await checkFfprobe(processingPath);
    const outputSha256 = await sha256File(processingPath);
    await rename(processingPath, readyPath);
    await writeReviewManifest(settings, row, readyPath, outputSha256);
    saveJob(database, {
      ...row,
      state: 'processed',
      output_path: readyPath,
      output_sha256: outputSha256,
      detail_code: 'review_required_before_any_provider_effect',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    saveJob(database, {
      ...row,
      state: 'failed',
      detail_code: safeErrorCode(error),
      updated_at: new Date().toISOString(),
    });
  }
}

async function writeReviewManifest(
  settings: LocalMediaSettings,
  row: JobRow,
  readyPath: string,
  outputSha256: string,
) {
  const manifest = {
    schema_version: 1,
    source_sha256: row.source_sha256,
    derivative_sha256: outputSha256,
    state: 'processed',
    vimeo_ready: true,
    transcription:
      settings.transcriptionMode === 'off'
        ? 'disabled_by_settings'
        : 'not_executed_requires_explicit_acceptance',
    library_import: 'not_executed_requires_explicit_acceptance',
    provider_effects_executed: false,
    raw_paths_present: false,
    required_review: [
      'operator confirms the derivative',
      'operator selects the exact class occurrence',
      'operator explicitly accepts one private Vimeo upload',
    ],
    retention: {
      raw_source_days_minimum: Math.max(settings.rawSourceRetentionDays, 7),
      deletion_authorized: false,
    },
  };
  await writeFile(`${readyPath}.review.json`, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

async function scanOnce(settings: LocalMediaSettings, processLocal: boolean) {
  const database = openState(settings);
  try {
    const entries = await (
      await import('node:fs/promises')
    ).readdir(settings.incomingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        continue;
      const sourcePath = path.join(settings.incomingDir, entry.name);
      const sourceStat = await stat(sourcePath);
      const sourceSha256 = await sha256File(sourcePath);
      const previous = getJob(database, sourceSha256);
      if (previous && TERMINAL_STATES.has(previous.state)) continue;
      const stable = isStableFile({
        modifiedAtMs: sourceStat.mtimeMs,
        nowMs: Date.now(),
        stableFileSeconds: settings.stableFileSeconds,
        previousSize: previous?.source_size ?? null,
        currentSize: sourceStat.size,
        previousModifiedAtMs: previous?.source_mtime_ms ?? null,
      });
      const row: JobRow = {
        source_sha256: sourceSha256,
        source_path: sourcePath,
        display_name: entry.name,
        state: stable ? 'ready_for_processing' : 'waiting_for_stability',
        source_size: sourceStat.size,
        source_mtime_ms: sourceStat.mtimeMs,
        output_path: previous?.output_path ?? null,
        output_sha256: previous?.output_sha256 ?? null,
        detail_code: stable ? 'local_review_queue' : 'awaiting_60_second_stability_window',
        updated_at: new Date().toISOString(),
      };
      saveJob(database, row);
      if (stable) {
        try {
          await checkFfprobe(sourcePath);
        } catch (error) {
          saveJob(database, {
            ...row,
            state: 'failed',
            detail_code: safeErrorCode(error),
            updated_at: new Date().toISOString(),
          });
          continue;
        }
        if (processLocal) await processOneLocal(settings, database, row);
      }
    }
  } finally {
    database.close();
  }
}

async function showStatus(settings: LocalMediaSettings) {
  const database = openState(settings);
  try {
    const jobs = database
      .prepare('SELECT * FROM local_media_jobs ORDER BY updated_at DESC')
      .all() as JobRow[];
    process.stdout.write(
      `${JSON.stringify({ runner: 'local_only', provider_effects_executed: false, jobs: jobs.map(sanitizeJob) }, null, 2)}\n`,
    );
  } finally {
    database.close();
  }
}

async function retry(settings: LocalMediaSettings, sourceSha256: string) {
  const database = openState(settings);
  try {
    const row = getJob(database, sourceSha256);
    if (!row) throw new Error('local_media_job_not_found');
    saveJob(database, {
      ...row,
      state: 'retry_wait',
      detail_code: 'operator_requested_local_retry',
      updated_at: new Date().toISOString(),
    });
  } finally {
    database.close();
  }
}

async function validateInstallation(settings: LocalMediaSettings) {
  for (const directory of [
    settings.rootPath,
    settings.incomingDir,
    settings.processingDir,
    settings.readyForVimeoDir,
    settings.stateDir,
    settings.logsDir,
  ]) {
    await access(directory);
  }
  await runCommand('node', ['--version']);
  await runCommand('ffmpeg', ['-version']);
  await runCommand('ffprobe', ['-version']);
}

async function registerCurrentUserTask(settings: LocalMediaSettings) {
  const repositoryPath = process.cwd();
  const wrapperPath = path.join(settings.rootPath, 'Config', 'Start-OneTimeMediaRunner.cmd');
  const logPath = path.join(settings.logsDir, 'runner.log');
  const wrapper = [
    '@echo off',
    `cd /d "${repositoryPath}"`,
    `npm run media:local-runner:start >> "${logPath}" 2>&1`,
    '',
  ].join('\r\n');
  await writeFile(wrapperPath, wrapper, { encoding: 'ascii', mode: 0o600 });
  await runCommand('schtasks.exe', [
    '/Create',
    '/TN',
    'One Time Local Media Runner',
    '/TR',
    wrapperPath,
    '/SC',
    'ONLOGON',
    '/RL',
    'LIMITED',
    '/F',
  ]);
}

async function unregisterCurrentUserTask() {
  await runCommand('schtasks.exe', ['/Delete', '/TN', 'One Time Local Media Runner', '/F']);
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${command}_exit_${code}:${Buffer.concat(errors).toString('utf8').slice(-180)}`,
            ),
          ),
    );
  });
}

function safeErrorCode(error: unknown) {
  return (
    (error instanceof Error ? error.message : String(error))
      .replace(/[^a-zA-Z0-9_:-]+/g, '_')
      .slice(0, 160) || 'local_media_error'
  );
}

async function main() {
  const [command = 'start', ...argv] = process.argv.slice(2);
  const options = parseRunnerOptions(argv);
  const settings = await loadSettings(options.rootPath);
  await mkdir(settings.stateDir, { recursive: true });
  if (command === 'status') return showStatus(settings);
  if (command === 'retry') {
    if (!options.retrySourceSha256) throw new Error('retry_source_sha256_required');
    return retry(settings, options.retrySourceSha256);
  }
  if (command === 'install-windows') {
    await validateInstallation(settings);
    if (options.applyTaskScheduler) await registerCurrentUserTask(settings);
    process.stdout.write(
      `${JSON.stringify({ installation: 'validated', task_scheduler: options.applyTaskScheduler ? 'registered_current_user' : 'not_registered_without_explicit_apply', provider_effects_executed: false })}\n`,
    );
    return;
  }
  if (command === 'uninstall-windows') {
    if (options.applyTaskScheduler) await unregisterCurrentUserTask();
    process.stdout.write(
      `${JSON.stringify({ uninstall: options.applyTaskScheduler ? 'current_user_task_removed_media_preserved' : 'no_action_without_explicit_apply', provider_effects_executed: false })}\n`,
    );
    return;
  }
  if (command !== 'start') throw new Error('local_media_runner_unknown_command');
  do {
    await scanOnce(settings, options.processLocal);
    if (!options.once) await new Promise((resolve) => setTimeout(resolve, 15_000));
  } while (!options.once);
}

if (import.meta.main)
  void main().catch((error) => {
    process.stderr.write(`${safeErrorCode(error)}\n`);
    process.exit(1);
  });
