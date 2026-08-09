import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, open, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LocalMediaStore,
  archiveVerifiedFile,
  assertReadableUnlocked,
  classifyExternalFailure,
  driveArchiveDayDirectory,
  isStableObservation,
  isSupportedMediaPath,
  loadLocalMediaConfig,
  readPrivateJson,
  redactLocalMediaText,
  sha256File,
  writePrivateJson,
  type LocalMediaConfig,
  type LocalMediaJob,
} from './local-runner-core.ts';
import { uploadPreparedVideoToVimeo } from './learning-delivery-real-media-canary.ts';

const TASK_NAME = 'OneTimeMediaLocalRunner';
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '../..');
const POLL_INTERVAL_MS = 5_000;

type PreparedImport = Record<string, unknown> & {
  sourceKey: string;
  sourceSha256: string;
  displayName: string;
  webvtt: string;
};

async function main() {
  const command = process.argv[2] ?? 'run-once';
  const rootOverride = optionalArg('root');
  const config = loadLocalMediaConfig(
    rootOverride ? { ...process.env, ONETIME_MEDIA_ROOT_DIR: rootOverride } : process.env,
  );
  await ensureDirectories(config);
  if (command === 'worker') return worker(config);
  if (command === 'start') return start(config);
  if (command === 'stop') return stop(config);
  if (command === 'status') return status(config);
  if (command === 'install') return install(config);
  if (command === 'uninstall') return uninstall();
  if (command === 'retry') return retry(config, requiredArg('job'));
  if (command === 'run-once') return runOnce(config);
  throw new Error('local_media_command_invalid');
}

async function runOnce(config: LocalMediaConfig) {
  const store = openStore(config);
  try {
    store.recoverInterrupted();
    const entries = await readdir(config.incomingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !isSupportedMediaPath(entry.name)) continue;
      const sourcePath = path.join(config.incomingDir, entry.name);
      const details = await stat(sourcePath);
      const job = store.createDetected({
        sourcePath,
        sourceName: entry.name,
        sizeBytes: details.size,
        mtimeMs: details.mtimeMs,
      });
      await observeAndMaybePrepare(store, job, details.size, details.mtimeMs, config);
    }

    const occurrenceKey = process.env.ONETIME_MEDIA_OCCURRENCE_KEY?.trim();
    const waitingForOccurrence = store
      .list()
      .find((job) => job.state === 'needs_occurrence_selection');
    if (waitingForOccurrence && occurrenceKey) {
      store.transition(waitingForOccurrence.id, 'ready_for_import', { safe_error_code: null });
    }
    const readyForImport = store.list().find((job) => job.state === 'ready_for_import');
    if (readyForImport && occurrenceKey && hasAdminImportCredential()) {
      await resumeImport(store, readyForImport, config, occurrenceKey);
    }

    const ready = store
      .list()
      .find((job) => job.state === 'ready_for_processing' || job.state === 'retry_wait');
    if (ready) await processJob(store, ready, config);
    writeSafe({ event: 'local_media_run_once', counts: stateCounts(store.list()) });
  } finally {
    store.close();
  }
}

async function resumeImport(
  store: LocalMediaStore,
  job: LocalMediaJob,
  config: LocalMediaConfig,
  occurrenceKey: string,
) {
  if (!job.output_dir) throw new Error('local_media_output_dir_missing');
  const importPayload = await readPrivateJson<PreparedImport>(
    path.join(job.output_dir, 'content-factory-import.private.json'),
  );
  store.transition(job.id, 'importing');
  try {
    await importIntoOneTime({ config, occurrenceKey, importPayload });
    store.transition(job.id, 'complete', { safe_error_code: null });
  } catch (error) {
    store.transition(job.id, 'ready_for_import', { safe_error_code: safeErrorCode(error) });
  }
}

async function observeAndMaybePrepare(
  store: LocalMediaStore,
  job: LocalMediaJob,
  sizeBytes: number,
  mtimeMs: number,
  config: LocalMediaConfig,
) {
  if (job.state !== 'waiting_for_stability') return;
  const nowMs = Date.now();
  const stable = isStableObservation({
    previousSize: job.size_bytes,
    previousMtimeMs: job.mtime_ms,
    stableSinceMs: job.stable_since_ms,
    currentSize: sizeBytes,
    currentMtimeMs: mtimeMs,
    nowMs,
    requiredMs: config.stabilityWindowMs,
  });
  const observed = store.recordObservation(job.id, { sizeBytes, mtimeMs, nowMs });
  if (!stable) return;
  await assertReadableUnlocked(observed.source_path);
  await ffprobeMedia(observed.source_path, config.transcriptionMode === 'openai');
  const sourceSha256 = await sha256File(observed.source_path);
  const duplicate = store.setSha(observed.id, sourceSha256).duplicate;
  if (!duplicate) store.transition(observed.id, 'ready_for_processing', { safe_error_code: null });
}

async function processJob(store: LocalMediaStore, job: LocalMediaJob, config: LocalMediaConfig) {
  const outputDir = job.output_dir ?? path.join(config.processingDir, job.id);
  try {
    if (config.transcriptionMode !== 'openai') {
      throw new Error('local_media_transcription_mode_off_not_processable');
    }
    await mkdir(outputDir, { recursive: true });
    store.transition(job.id, 'processing', {
      output_dir: outputDir,
      attempts: job.attempts + 1,
      safe_error_code: null,
    });
    await runCanaryProcessing(job.source_path, outputDir);
    const preparedVideo = path.join(outputDir, 'prepared-autotrim.mp4');
    const captions = path.join(outputDir, 'captions-reviewed.vtt');
    const preparedImportPath = path.join(outputDir, 'content-factory-prepared.private.json');
    const preparedImport = await readPrivateJson<PreparedImport>(preparedImportPath);
    store.transition(job.id, 'processed');

    store.transition(job.id, 'copying_to_drive');
    const archiveDir = driveArchiveDayDirectory(config.driveArchiveDir);
    const archiveBase = safeArchiveBase(job.source_name, job.id);
    const archivedVideo = await archiveVerifiedFile({
      sourcePath: preparedVideo,
      archiveDir,
      destinationName: `${archiveBase}.mp4`,
    });
    await archiveVerifiedFile({
      sourcePath: captions,
      archiveDir,
      destinationName: `${archiveBase}.vtt`,
    });
    await archiveVerifiedFile({
      sourcePath: preparedImportPath,
      archiveDir,
      destinationName: `${archiveBase}.content-factory.private.json`,
    });
    await ffprobeMedia(archivedVideo.destination, true);
    store.transition(job.id, 'drive_copy_complete', {
      archive_path: archivedVideo.destination,
    });

    store.transition(job.id, 'uploading_to_vimeo');
    const vimeo = await uploadPreparedVideoToVimeo({
      videoPath: preparedVideo,
      webvtt: preparedImport.webvtt,
      language: String(preparedImport.transcriptionLanguage ?? 'en'),
      title: `One Time class video ${new Date().toISOString().slice(0, 10)}`,
    });
    if (vimeo.status !== 'ready') {
      store.transition(
        job.id,
        classifyExternalFailure({ stage: 'uploading_to_vimeo', requestDispatched: true }),
        { safe_error_code: 'vimeo_effect_requires_reconciliation' },
      );
      return;
    }
    store.transition(job.id, 'waiting_for_vimeo', {
      provider_video_ref_digest: vimeo.providerVideoRefDigest,
    });
    const importPayload = {
      ...preparedImport,
      providerVideoId: vimeo.providerVideoId,
      providerEmbedUrl: vimeo.providerEmbedUrl,
      providerTextTrackId: vimeo.providerTextTrackId,
      vimeoPrivacy: vimeo.privacy,
      captionsActive: vimeo.textTrackActive,
    };
    const importPath = path.join(outputDir, 'content-factory-import.private.json');
    await writePrivateJson(importPath, importPayload);
    const occurrenceKey = process.env.ONETIME_MEDIA_OCCURRENCE_KEY?.trim();
    if (!occurrenceKey) {
      store.transition(job.id, 'needs_occurrence_selection', {
        safe_error_code: 'exact_occurrence_selection_required',
      });
      return;
    }
    store.transition(job.id, 'ready_for_import');
    if (!hasAdminImportCredential()) return;
    await importIntoOneTime({ config, occurrenceKey, importPayload });
    store.transition(job.id, 'complete', { safe_error_code: null });
  } catch (error) {
    const current = store.get(job.id) ?? job;
    const safeCode = safeErrorCode(error);
    const state =
      current.state === 'uploading_to_vimeo' || current.state === 'waiting_for_vimeo'
        ? 'unknown_provider_effect'
        : 'retry_wait';
    store.transition(job.id, state, { safe_error_code: safeCode });
  }
}

async function importIntoOneTime(input: {
  config: LocalMediaConfig;
  occurrenceKey: string;
  importPayload: PreparedImport;
}) {
  const cookie = process.env.ONETIME_MEDIA_ADMIN_COOKIE?.trim();
  const csrf = process.env.ONETIME_MEDIA_CSRF_TOKEN?.trim();
  if (!cookie || !csrf) throw new Error('admin_import_session_required');
  const response = await fetch(
    `${input.config.appBaseUrl}/api/v1/admin/content/factory/local-import`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'x-csrf-token': csrf,
        'x-idempotency-key': `local-media-${input.importPayload.sourceSha256}`,
      },
      body: JSON.stringify({
        occurrence_key: input.occurrenceKey,
        item: input.importPayload,
      }),
    },
  );
  if (!response.ok) throw new Error(`admin_import_http_${response.status}`);
}

async function worker(config: LocalMediaConfig) {
  const pidPath = path.join(config.stateDir, 'runner.pid');
  const lock = await acquirePidLock(pidPath);
  const shutdown = () => {
    void lock.close().finally(() => rm(pidPath, { force: true }));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    while (true) {
      await runOnce(config);
      await sleep(POLL_INTERVAL_MS);
    }
  } finally {
    shutdown();
  }
}

async function start(config: LocalMediaConfig) {
  const pidPath = path.join(config.stateDir, 'runner.pid');
  const current = await readPid(pidPath);
  if (current && isProcessRunning(current)) {
    writeSafe({ status: 'already_running', pid: current });
    return;
  }
  await rm(pidPath, { force: true });
  const child = spawn(process.execPath, ['--import', 'tsx', SCRIPT_PATH, 'worker'], {
    cwd: REPO_ROOT,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  writeSafe({ status: 'started', pid: child.pid ?? null });
}

async function stop(config: LocalMediaConfig) {
  const pidPath = path.join(config.stateDir, 'runner.pid');
  const pid = await readPid(pidPath);
  if (!pid || !isProcessRunning(pid)) {
    await rm(pidPath, { force: true });
    writeSafe({ status: 'not_running' });
    return;
  }
  process.kill(pid, 'SIGTERM');
  writeSafe({ status: 'stop_requested', pid });
}

async function status(config: LocalMediaConfig) {
  const store = openStore(config);
  try {
    const pid = await readPid(path.join(config.stateDir, 'runner.pid'));
    writeSafe({
      status: pid && isProcessRunning(pid) ? 'running' : 'stopped',
      pid: pid ?? null,
      incoming_dir: config.incomingDir,
      drive_archive_dir: config.driveArchiveDir,
      counts: stateCounts(store.list()),
    });
  } finally {
    store.close();
  }
}

async function retry(config: LocalMediaConfig, jobId: string) {
  const store = openStore(config);
  try {
    const job = store.retry(jobId);
    writeSafe({ status: job.state, job_id: job.id });
  } finally {
    store.close();
  }
}

async function install(_config: LocalMediaConfig) {
  if (process.platform !== 'win32') throw new Error('task_scheduler_windows_required');
  const action = `"${process.execPath}" --import tsx "${SCRIPT_PATH}" worker`;
  await runFile('schtasks.exe', [
    '/Create',
    '/F',
    '/SC',
    'ONLOGON',
    '/RL',
    'LIMITED',
    '/TN',
    TASK_NAME,
    '/TR',
    action,
  ]);
  writeSafe({ status: 'installed', task: TASK_NAME });
}

async function uninstall() {
  if (process.platform !== 'win32') throw new Error('task_scheduler_windows_required');
  const result = await runFile('schtasks.exe', ['/Delete', '/F', '/TN', TASK_NAME], true);
  writeSafe({ status: result.code === 0 ? 'uninstalled' : 'not_installed', task: TASK_NAME });
}

async function runCanaryProcessing(sourcePath: string, outputDir: string) {
  const result = await runFile(process.execPath, [
    '--import',
    'tsx',
    path.join(REPO_ROOT, 'scripts/media/learning-delivery-real-media-canary.ts'),
    `--source=${sourcePath}`,
    `--out-dir=${outputDir}`,
    '--allow-vimeo-upload=0',
    '--allow-derived-edge-silence=0',
  ]);
  if (result.code !== 0) throw new Error(result.stderr || 'local_media_processing_failed');
}

async function ffprobeMedia(filePath: string, audioRequired: boolean) {
  const ffprobe = resolveBinary('FFPROBE_PATH', [
    'C:/Users/User/AppData/Local/npm-cache/_npx/9f08275e728ec66b/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe',
    'C:/Users/User/AppData/Local/npm-cache/_npx/d62dab49a0520ac5/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe',
    'ffprobe',
  ]);
  const result = await runFile(ffprobe, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_streams',
    '-show_format',
    filePath,
  ]);
  if (result.code !== 0) throw new Error('ffprobe_invalid_media');
  const probe = JSON.parse(result.stdout) as { streams?: Array<{ codec_type?: string }> };
  if (!probe.streams?.some((item) => item.codec_type === 'video')) {
    throw new Error('ffprobe_video_stream_required');
  }
  if (audioRequired && !probe.streams.some((item) => item.codec_type === 'audio')) {
    throw new Error('ffprobe_audio_stream_required');
  }
}

function openStore(config: LocalMediaConfig) {
  return new LocalMediaStore(path.join(config.stateDir, 'local-media.sqlite'));
}

async function ensureDirectories(config: LocalMediaConfig) {
  await Promise.all(
    [
      config.incomingDir,
      config.processingDir,
      config.completeDir,
      config.failedDir,
      config.stateDir,
      config.driveArchiveDir,
    ].map((directory) => mkdir(directory, { recursive: true })),
  );
}

async function acquirePidLock(pidPath: string) {
  const existing = await readPid(pidPath);
  if (existing && isProcessRunning(existing)) throw new Error('local_media_runner_already_running');
  await rm(pidPath, { force: true });
  const handle = await open(pidPath, 'wx');
  await handle.writeFile(String(process.pid), 'utf8');
  return handle;
}

async function readPid(pidPath: string) {
  try {
    const value = Number((await readFile(pidPath, 'utf8')).trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function hasAdminImportCredential() {
  return Boolean(
    process.env.ONETIME_MEDIA_ADMIN_COOKIE?.trim() && process.env.ONETIME_MEDIA_CSRF_TOKEN?.trim(),
  );
}

function requiredArg(name: string) {
  const value = optionalArg(name);
  if (!value) throw new Error(`local_media_${name}_required`);
  return value;
}

function optionalArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function safeArchiveBase(sourceName: string, jobId: string) {
  const name = path
    .basename(sourceName, path.extname(sourceName))
    .replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${name.slice(0, 120)}-${jobId.slice(-12)}`;
}

function safeErrorCode(error: unknown) {
  const message = redactLocalMediaText(error instanceof Error ? error.message : String(error));
  return (
    message
      .toLowerCase()
      .replace(/[^a-z0-9_:-]+/g, '_')
      .slice(0, 160) || 'local_media_unexpected'
  );
}

function stateCounts(jobs: LocalMediaJob[]) {
  return Object.fromEntries(
    [...new Set(jobs.map((job) => job.state))].map((state) => [
      state,
      jobs.filter((job) => job.state === state).length,
    ]),
  );
}

function resolveBinary(envName: string, candidates: string[]) {
  const configured = process.env[envName];
  if (configured) return configured;
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates.at(-1)!;
}

function runFile(command: string, args: string[], allowFailure = false) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      const result = {
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: redactLocalMediaText(Buffer.concat(stderr).toString('utf8')),
      };
      if (result.code === 0 || allowFailure) resolve(result);
      else reject(new Error(result.stderr || `command_failed_${result.code}`));
    });
  });
}

function writeSafe(value: unknown) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  process.stderr.write(`${safeErrorCode(error)}\n`);
  process.exitCode = 1;
});
