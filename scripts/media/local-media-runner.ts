/**
 * Local-only media preparation queue.
 *
 * This runner intentionally has no OpenAI, Vimeo, Drive, or One Time import
 * implementation. Those effects remain an explicit, separately accepted
 * operator action. Its job is to turn a stable operator-owned recording into a
 * Vimeo-ready derivative and a redacted draft handoff manifest.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createReadStream } from 'node:fs';
import {
  access,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SUPPORTED_EXTENSIONS = new Set(['.mkv', '.mp4', '.mov']);
const TERMINAL_STATES = new Set(['processed', 'complete', 'failed', 'unknown_provider_effect']);

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
  transcriptionMode: 'off';
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
  waitForStability: boolean;
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
  const value = (name: string) => {
    const equalsPrefix = `--${name}=`;
    const equalsValue = argv.find((arg) => arg.startsWith(equalsPrefix));
    if (equalsValue !== undefined) return equalsValue.slice(equalsPrefix.length);
    const separatedIndex = argv.indexOf(`--${name}`);
    if (separatedIndex < 0) return undefined;
    const separatedValue = argv[separatedIndex + 1];
    if (!separatedValue || separatedValue.startsWith('--')) {
      throw new Error(`local_media_option_${name}_value_required`);
    }
    return separatedValue;
  };
  return {
    rootPath:
      value('root') ??
      environment.ONE_TIME_MEDIA_ROOT ??
      path.join(environment.USERPROFILE ?? '.', 'OneTimeMedia'),
    once: argv.includes('--once'),
    processLocal: argv.includes('--process-local'),
    retrySourceSha256: value('retry-source-sha256') ?? null,
    applyTaskScheduler: argv.includes('--apply-task-scheduler'),
    waitForStability: argv.includes('--wait-for-stability'),
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
    input.previousSize !== null &&
    input.previousModifiedAtMs !== null &&
    input.previousSize === input.currentSize &&
    input.previousModifiedAtMs === input.modifiedAtMs
  );
}

export function buildVimeoReadyFfmpegArgs(input: { sourcePath: string; outputPath: string }) {
  // Never trim a middle segment. Reviewers can decide whether edge trimming is appropriate later.
  return [
    '-hide_banner',
    '-nostdin',
    '-n',
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

export function buildDerivativeFileName(sourceSha256: string) {
  if (!/^[a-f0-9]{64}$/i.test(sourceSha256)) throw new Error('local_media_source_sha256_invalid');
  return `${sourceSha256.toLowerCase()}-review-ready.mp4`;
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

type RunnerLockOptions = {
  pid?: number;
  isProcessAlive?: (pid: number) => boolean | Promise<boolean>;
};

function defaultIsProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export async function acquireRunnerLock(
  stateDir: string,
  options: RunnerLockOptions = {},
  allowStaleRecovery = true,
) {
  const lockPath = path.join(stateDir, 'local-media-runner.lock');
  await mkdir(stateDir, { recursive: true });
  const lockPayload = `${JSON.stringify({
    pid: options.pid ?? process.pid,
    nonce: randomUUID(),
    started_at: new Date().toISOString(),
  })}\n`;
  try {
    const lock = await open(lockPath, 'wx', 0o600);
    await lock.writeFile(lockPayload);
    await lock.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!allowStaleRecovery) throw new Error('local_media_runner_already_running');
    const lockStat = await lstat(lockPath);
    if (lockStat.isSymbolicLink()) throw new Error('local_media_runner_lock_reparse_not_allowed');
    const existingPayload = await readFile(lockPath, 'utf8');
    let recordedPid: number;
    try {
      const parsed = JSON.parse(existingPayload) as { pid?: unknown };
      if (!Number.isSafeInteger(parsed.pid) || Number(parsed.pid) < 1) throw new Error('invalid');
      recordedPid = Number(parsed.pid);
    } catch {
      throw new Error('local_media_runner_lock_unverifiable');
    }
    const isAlive = await (options.isProcessAlive ?? defaultIsProcessAlive)(recordedPid);
    if (isAlive) throw new Error('local_media_runner_already_running');
    const confirmationPayload = await readFile(lockPath, 'utf8');
    if (confirmationPayload !== existingPayload) {
      throw new Error('local_media_runner_lock_changed_during_recovery');
    }
    const confirmationStat = await lstat(lockPath);
    if (
      confirmationStat.ino !== lockStat.ino ||
      confirmationStat.size !== lockStat.size ||
      confirmationStat.mtimeMs !== lockStat.mtimeMs
    ) {
      throw new Error('local_media_runner_lock_changed_during_recovery');
    }
    await unlink(lockPath);
    return acquireRunnerLock(stateDir, options, false);
  }
  return async () => {
    try {
      const currentPayload = await readFile(lockPath, 'utf8');
      if (currentPayload !== lockPayload) return;
      await unlink(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
}

function isPathWithin(rootPath: string, candidatePath: string) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function assertResolvedPathWithinRoot(input: {
  rootPath: string;
  configuredPath: string;
  resolvedPath: string;
  label: string;
}) {
  if (
    !isPathWithin(input.rootPath, input.configuredPath) ||
    !isPathWithin(input.rootPath, input.resolvedPath)
  ) {
    throw new Error(`local_media_${input.label}_outside_root`);
  }
}

async function resolveSafeDirectory(rootPath: string, configuredPath: string, label: string) {
  const candidatePath = path.isAbsolute(configuredPath)
    ? path.resolve(configuredPath)
    : path.resolve(rootPath, configuredPath);
  assertResolvedPathWithinRoot({
    rootPath,
    configuredPath: candidatePath,
    resolvedPath: candidatePath,
    label,
  });
  const relativeSegments = path.relative(rootPath, candidatePath).split(path.sep).filter(Boolean);
  let inspectedPath = rootPath;
  for (const segment of relativeSegments) {
    inspectedPath = path.join(inspectedPath, segment);
    if ((await lstat(inspectedPath)).isSymbolicLink()) {
      throw new Error(`local_media_${label}_reparse_not_allowed`);
    }
  }
  const resolvedPath = await realpath(candidatePath);
  assertResolvedPathWithinRoot({
    rootPath,
    configuredPath: candidatePath,
    resolvedPath,
    label,
  });
  return resolvedPath;
}

export async function loadSettings(rootPath: string): Promise<LocalMediaSettings> {
  const requestedRootPath = path.resolve(rootPath);
  if ((await lstat(requestedRootPath)).isSymbolicLink()) {
    throw new Error('local_media_root_reparse_not_allowed');
  }
  const resolvedRootPath = await realpath(requestedRootPath);
  const configDirectory = await resolveSafeDirectory(resolvedRootPath, 'Config', 'configDir');
  const settingsPath = path.join(configDirectory, 'settings.local.json');
  if ((await lstat(settingsPath)).isSymbolicLink()) {
    throw new Error('local_media_settings_reparse_not_allowed');
  }
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
  if (
    parsed.rootPath &&
    path.resolve(parsed.rootPath).toLocaleLowerCase() !== requestedRootPath.toLocaleLowerCase()
  )
    throw new Error('local_media_settings_root_mismatch');
  if (parsed.transcriptionMode !== 'off') throw new Error('local_media_transcription_must_be_off');
  const stableFileSeconds = Number(parsed.stableFileSeconds);
  const rawSourceRetentionDays = Number(parsed.rawSourceRetentionDays);
  if (!Number.isInteger(stableFileSeconds) || stableFileSeconds < 1 || stableFileSeconds > 3_600) {
    throw new Error('local_media_stable_file_seconds_invalid');
  }
  if (!Number.isInteger(rawSourceRetentionDays) || rawSourceRetentionDays < 7) {
    throw new Error('local_media_raw_source_retention_invalid');
  }
  const resolvedDirectories = await Promise.all(
    required.map(async (key) => [
      key,
      await resolveSafeDirectory(resolvedRootPath, parsed[key]!, key),
    ]),
  );
  const directoryMap = Object.fromEntries(resolvedDirectories) as Record<
    (typeof required)[number],
    string
  >;
  if (
    new Set(Object.values(directoryMap).map((value) => value.toLocaleLowerCase())).size !==
    required.length
  ) {
    throw new Error('local_media_configured_directories_must_be_distinct');
  }
  return {
    rootPath: resolvedRootPath,
    incomingDir: directoryMap.incomingDir,
    processingDir: directoryMap.processingDir,
    readyForVimeoDir: directoryMap.readyForVimeoDir,
    completeDir: directoryMap.completeDir,
    failedDir: directoryMap.failedDir,
    stateDir: directoryMap.stateDir,
    logsDir: directoryMap.logsDir,
    stableFileSeconds,
    rawSourceRetentionDays,
    transcriptionMode: 'off',
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

type StableFileFingerprint = {
  sourceSha256: string;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  ino: number;
};

export async function hashFileWithStableSnapshot(
  filePath: string,
  afterHash?: () => void | Promise<void>,
): Promise<StableFileFingerprint | null> {
  const before = await stat(filePath);
  if (!before.isFile() || before.size < 1) return null;
  const sourceSha256 = await sha256File(filePath);
  await afterHash?.();
  const after = await stat(filePath);
  if (
    !after.isFile() ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    before.ctimeMs !== after.ctimeMs ||
    before.ino !== after.ino
  ) {
    return null;
  }
  return {
    sourceSha256,
    size: after.size,
    mtimeMs: after.mtimeMs,
    ctimeMs: after.ctimeMs,
    ino: after.ino,
  };
}

async function writeExclusiveOrVerify(filePath: string, content: string) {
  try {
    await writeFile(filePath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if ((await lstat(filePath)).isSymbolicLink()) {
      throw new Error('local_media_review_manifest_reparse_not_allowed');
    }
    if ((await readFile(filePath, 'utf8')) !== content) {
      throw new Error('local_media_review_manifest_collision');
    }
  }
}

export async function finalizeDerivativeExclusive(input: {
  temporaryPath: string;
  readyPath: string;
  outputSha256: string;
}) {
  try {
    await link(input.temporaryPath, input.readyPath);
    await unlink(input.temporaryPath);
    return 'created' as const;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if ((await lstat(input.readyPath)).isSymbolicLink()) {
      throw new Error('local_media_ready_output_reparse_not_allowed');
    }
    const existingFingerprint = await hashFileWithStableSnapshot(input.readyPath);
    if (!existingFingerprint || existingFingerprint.sourceSha256 !== input.outputSha256) {
      throw new Error('local_media_ready_output_collision');
    }
    return 'already_present' as const;
  }
}

async function processOneLocal(settings: LocalMediaSettings, database: DatabaseSync, row: JobRow) {
  await resolveSafeDirectory(settings.rootPath, settings.processingDir, 'processingDir');
  await resolveSafeDirectory(settings.rootPath, settings.readyForVimeoDir, 'readyForVimeoDir');
  const outputName = buildDerivativeFileName(row.source_sha256);
  const temporaryDirectory = await mkdtemp(
    path.join(settings.processingDir, `${row.source_sha256}-${process.pid}-`),
  );
  const processingPath = path.join(temporaryDirectory, 'derivative.partial.mp4');
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
    const sourceAfterRender = await hashFileWithStableSnapshot(row.source_path);
    if (
      !sourceAfterRender ||
      sourceAfterRender.sourceSha256 !== row.source_sha256 ||
      sourceAfterRender.size !== row.source_size ||
      sourceAfterRender.mtimeMs !== row.source_mtime_ms
    ) {
      throw new Error('local_media_source_changed_during_render');
    }
    await checkFfprobe(processingPath);
    const outputFingerprint = await hashFileWithStableSnapshot(processingPath);
    if (!outputFingerprint) throw new Error('local_media_derivative_changed_during_hash');
    const outputSha256 = outputFingerprint.sourceSha256;
    await finalizeDerivativeExclusive({
      temporaryPath: processingPath,
      readyPath,
      outputSha256,
    });
    await writeReviewManifest(settings, row, readyPath, outputSha256);
    saveJob(database, {
      ...row,
      state: 'processed',
      output_path: readyPath,
      output_sha256: outputSha256,
      detail_code: 'local_derivative_review_required',
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    saveJob(database, {
      ...row,
      state: 'failed',
      detail_code: safeErrorCode(error),
      updated_at: new Date().toISOString(),
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
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
    local_derivative_ready_for_review: true,
    external_calls_available: false,
    external_calls_executed: false,
    raw_paths_present: false,
    required_review: ['operator confirms the derivative', 'operator keeps the source recording'],
    retention: {
      raw_source_days_minimum: Math.max(settings.rawSourceRetentionDays, 7),
      deletion_authorized: false,
    },
  };
  await writeExclusiveOrVerify(
    `${readyPath}.review.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function scanOnce(settings: LocalMediaSettings, processLocal: boolean) {
  await resolveSafeDirectory(settings.rootPath, settings.incomingDir, 'incomingDir');
  const database = openState(settings);
  try {
    const entries = await readdir(settings.incomingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error('local_media_source_reparse_not_allowed');
      if (!entry.isFile() || !SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        continue;
      const sourcePath = path.join(settings.incomingDir, entry.name);
      const resolvedSourcePath = await realpath(sourcePath);
      assertResolvedPathWithinRoot({
        rootPath: settings.incomingDir,
        configuredPath: sourcePath,
        resolvedPath: resolvedSourcePath,
        label: 'source',
      });
      const fingerprint = await hashFileWithStableSnapshot(resolvedSourcePath);
      if (!fingerprint) continue;
      const sourceSha256 = fingerprint.sourceSha256;
      const previous = getJob(database, sourceSha256);
      if (previous && TERMINAL_STATES.has(previous.state)) continue;
      const stable = isStableFile({
        modifiedAtMs: fingerprint.mtimeMs,
        nowMs: Date.now(),
        stableFileSeconds: settings.stableFileSeconds,
        previousSize: previous?.source_size ?? null,
        currentSize: fingerprint.size,
        previousModifiedAtMs: previous?.source_mtime_ms ?? null,
      });
      const row: JobRow = {
        source_sha256: sourceSha256,
        source_path: resolvedSourcePath,
        display_name: entry.name,
        state: stable ? 'ready_for_processing' : 'waiting_for_stability',
        source_size: fingerprint.size,
        source_mtime_ms: fingerprint.mtimeMs,
        output_path: previous?.output_path ?? null,
        output_sha256: previous?.output_sha256 ?? null,
        detail_code: stable ? 'local_review_queue' : 'awaiting_60_second_stability_window',
        updated_at: new Date().toISOString(),
      };
      saveJob(database, row);
      if (stable) {
        try {
          await checkFfprobe(resolvedSourcePath);
        } catch (error) {
          saveJob(database, {
            ...row,
            state: 'failed',
            detail_code: safeErrorCode(error),
            updated_at: new Date().toISOString(),
          });
          continue;
        }
        const verifiedFingerprint = await hashFileWithStableSnapshot(resolvedSourcePath);
        if (
          !verifiedFingerprint ||
          verifiedFingerprint.sourceSha256 !== row.source_sha256 ||
          verifiedFingerprint.size !== row.source_size ||
          verifiedFingerprint.mtimeMs !== row.source_mtime_ms
        ) {
          saveJob(database, {
            ...row,
            state: 'waiting_for_stability',
            detail_code: 'source_changed_after_probe_reobserve_required',
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
  try {
    await writeFile(wrapperPath, wrapper, { encoding: 'ascii', mode: 0o600, flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if ((await readFile(wrapperPath, 'ascii')) !== wrapper) {
      throw new Error('local_media_scheduler_wrapper_exists');
    }
  }
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
  ]);
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
    const releaseRetryLock = await acquireRunnerLock(settings.stateDir);
    try {
      return await retry(settings, options.retrySourceSha256);
    } finally {
      await releaseRetryLock();
    }
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
    process.stdout.write(
      `${JSON.stringify({ uninstall: 'use_verified_package_uninstaller', provider_effects_executed: false })}\n`,
    );
    return;
  }
  if (command !== 'start') throw new Error('local_media_runner_unknown_command');
  const releaseLock = await acquireRunnerLock(settings.stateDir);
  try {
    if (options.once && options.waitForStability) {
      await scanOnce(settings, options.processLocal);
      await new Promise((resolve) => setTimeout(resolve, settings.stableFileSeconds * 1_000));
      await scanOnce(settings, options.processLocal);
      await showStatus(settings);
      return;
    }
    do {
      await scanOnce(settings, options.processLocal);
      if (options.once) await showStatus(settings);
      else await new Promise((resolve) => setTimeout(resolve, 15_000));
    } while (!options.once);
  } finally {
    await releaseLock();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution)
  void main().catch((error) => {
    process.stderr.write(`${safeErrorCode(error)}\n`);
    process.exit(1);
  });
