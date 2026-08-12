import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  appendFile,
  copyFile,
  mkdir,
  open,
  readdir,
  readFile,
  stat,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import type { ContentFactoryIngest } from '../../../packages/domain/src/index.ts';
import {
  loadLocalMediaSettings,
  sanitizeLocalMediaError,
  type LocalMediaJob,
  type LocalMediaOccurrence,
  type LocalMediaSettings,
} from './contracts.ts';
import { processLocalMedia, readProcessedArtifact } from './process-media.ts';
import { LocalVimeoTusClient, OneTimeLocalMediaClient } from './providers.ts';
import { LocalMediaSecretStore } from './secret-store.ts';
import { LocalMediaJobStore } from './store.ts';

const SUPPORTED_EXTENSIONS = new Set(['.mkv', '.mp4', '.mov']);
const MAX_AUTOMATIC_ATTEMPTS = 8;

export async function runLocalMediaRunner(input: {
  settingsPath?: string;
  once?: boolean;
  signal?: AbortSignal;
}) {
  const settings = await loadLocalMediaSettings(input.settingsPath);
  await ensureDirectories(settings);
  const releaseLock = await acquireRunnerLock(settings);
  const store = new LocalMediaJobStore(path.join(settings.stateDir, 'local-media.sqlite3'));
  const secrets = new LocalMediaSecretStore(settings);
  const runner = new LocalMediaRuntime(settings, store, secrets);
  try {
    store.recoverInterrupted();
    do {
      await runner.runCycle();
      if (input.once || input.signal?.aborted) break;
      await delay(Math.min(settings.pollIntervalSeconds * 1_000, 60_000), input.signal);
    } while (!input.signal?.aborted);
  } finally {
    store.close();
    await releaseLock();
  }
}

export async function readLocalMediaStatus(settingsPath?: string) {
  const settings = await loadLocalMediaSettings(settingsPath);
  await ensureDirectories(settings);
  const store = new LocalMediaJobStore(path.join(settings.stateDir, 'local-media.sqlite3'));
  try {
    return store.list().map((job) => ({
      job_id: job.jobId,
      recording: job.displayName,
      state: job.state,
      occurrence_key: job.occurrenceKey,
      occurrence_candidates: job.occurrenceCandidates,
      drive_archive_state: job.driveArchiveState,
      attempts: job.attemptCount,
      next_attempt_at: job.nextAttemptAt,
      safe_error_code: job.lastSafeErrorCode,
      updated_at: job.updatedAt,
    }));
  } finally {
    store.close();
  }
}

export async function retryLocalMediaJob(input: { settingsPath?: string; jobId: string }) {
  const settings = await loadLocalMediaSettings(input.settingsPath);
  await ensureDirectories(settings);
  const store = new LocalMediaJobStore(path.join(settings.stateDir, 'local-media.sqlite3'));
  try {
    const job = store.require(input.jobId);
    if (job.state === 'complete') throw new Error('local_media_complete_job_cannot_retry');
    const now = new Date().toISOString();
    const updated: LocalMediaJob = {
      ...job,
      state: 'retry_wait',
      attemptCount: 0,
      nextAttemptAt: now,
      lastSafeErrorCode: null,
      updatedAt: now,
    };
    store.save(updated);
    return updated;
  } finally {
    store.close();
  }
}

export async function selectLocalMediaOccurrence(input: {
  settingsPath?: string;
  jobId: string;
  occurrenceKey: string;
}) {
  const settings = await loadLocalMediaSettings(input.settingsPath);
  await ensureDirectories(settings);
  const store = new LocalMediaJobStore(path.join(settings.stateDir, 'local-media.sqlite3'));
  try {
    const job = store.require(input.jobId);
    if (job.state !== 'needs_occurrence_selection') {
      throw new Error('local_media_job_not_waiting_for_occurrence');
    }
    if (!job.occurrenceCandidates.some((item) => item.occurrence_key === input.occurrenceKey)) {
      throw new Error('local_media_occurrence_not_in_approved_window');
    }
    const assigned = store.assignOccurrence(job.jobId, input.occurrenceKey);
    if (assigned.duplicateOf) {
      const now = new Date().toISOString();
      const duplicate: LocalMediaJob = {
        ...job,
        occurrenceKey: input.occurrenceKey,
        state: 'complete',
        nextAttemptAt: now,
        lastSafeErrorCode: 'local_media_duplicate_skipped',
        updatedAt: now,
      };
      store.save(duplicate);
      return duplicate;
    }
    return assigned.job;
  } finally {
    store.close();
  }
}

class LocalMediaRuntime {
  private readonly oneTime: OneTimeLocalMediaClient;

  constructor(
    private readonly settings: LocalMediaSettings,
    private readonly store: LocalMediaJobStore,
    private readonly secrets: LocalMediaSecretStore,
  ) {
    this.oneTime = new OneTimeLocalMediaClient(settings, secrets);
  }

  async runCycle() {
    await this.discoverIncoming();
    await this.promoteStableFiles();
    const now = Date.now();
    const runnable = this.store
      .list()
      .filter(
        (job) =>
          !['waiting_for_stability', 'needs_occurrence_selection', 'complete', 'failed'].includes(
            job.state,
          ) && new Date(job.nextAttemptAt).getTime() <= now,
      );
    for (const job of runnable) await this.advance(job);
    for (const job of this.store.list(['complete'])) {
      if (job.driveArchiveState === 'pending' && new Date(job.nextAttemptAt).getTime() <= now) {
        await this.attemptDriveArchive(job);
      }
    }
  }

  private async discoverIncoming() {
    const entries = await readdir(this.settings.incomingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      const sourcePath = path.join(this.settings.incomingDir, entry.name);
      const details = await stat(sourcePath);
      if (details.size < 1) continue;
      this.store.upsertObservation({
        sourcePath,
        displayName: entry.name,
        size: details.size,
        mtimeMs: details.mtimeMs,
        birthtimeMs: details.birthtimeMs,
      });
    }
  }

  private async promoteStableFiles() {
    for (const observed of this.store.list(['waiting_for_stability'])) {
      const stableForMs = Date.now() - new Date(observed.stableSince).getTime();
      if (stableForMs < this.settings.stableFileSeconds * 1_000) continue;
      try {
        const details = await stat(observed.sourcePath);
        if (
          details.size !== observed.observedSize ||
          details.mtimeMs !== observed.observedMtimeMs ||
          !(await hasReleasedWriteHandle(observed.sourcePath))
        ) {
          this.store.upsertObservation({
            sourcePath: observed.sourcePath,
            displayName: observed.displayName,
            size: details.size,
            mtimeMs: details.mtimeMs,
            birthtimeMs: details.birthtimeMs,
          });
          continue;
        }
        await assertFfprobeReadable(this.settings.ffprobePath ?? 'ffprobe', observed.sourcePath);
        const sourceSha256 = await sha256File(observed.sourcePath);
        const now = new Date().toISOString();
        const hashed: LocalMediaJob = {
          ...observed,
          sourceSha256,
          state: 'needs_occurrence_selection',
          nextAttemptAt: now,
          lastSafeErrorCode: null,
          updatedAt: now,
        };
        this.store.save(hashed);
        await this.resolveOccurrence(hashed);
      } catch (error) {
        await this.record('stability_check_deferred', observed, error);
      }
    }
  }

  private async resolveOccurrence(job: LocalMediaJob) {
    if (!this.settings.oneTimeBaseUrl) {
      const now = new Date().toISOString();
      this.store.save({
        ...job,
        state: 'needs_occurrence_selection',
        occurrenceCandidates: [],
        lastSafeErrorCode: 'local_media_one_time_base_url_required',
        updatedAt: now,
      });
      return;
    }
    try {
      const occurrences = await this.oneTime.listOccurrences(job.recordedAt, randomUUID());
      const current = this.store.require(job.jobId);
      if (occurrences.length !== 1) {
        const now = new Date().toISOString();
        this.store.save({
          ...current,
          occurrenceCandidates: occurrences,
          state: 'needs_occurrence_selection',
          lastSafeErrorCode:
            occurrences.length === 0
              ? 'local_media_occurrence_not_found'
              : 'local_media_occurrence_ambiguous',
          updatedAt: now,
        });
        return;
      }
      await this.assignOccurrence(current, occurrences[0]!);
    } catch (error) {
      const now = new Date().toISOString();
      this.store.save({
        ...this.store.require(job.jobId),
        state: 'needs_occurrence_selection',
        occurrenceCandidates: [],
        lastSafeErrorCode: sanitizeLocalMediaError(error),
        updatedAt: now,
      });
      await this.record('occurrence_lookup_deferred', job, error);
    }
  }

  private async assignOccurrence(job: LocalMediaJob, occurrence: LocalMediaOccurrence) {
    const result = this.store.assignOccurrence(job.jobId, occurrence.occurrence_key);
    if (!result.duplicateOf) return;
    const now = new Date().toISOString();
    this.store.save({
      ...job,
      occurrenceKey: occurrence.occurrence_key,
      occurrenceCandidates: [occurrence],
      state: 'complete',
      nextAttemptAt: now,
      lastSafeErrorCode: 'local_media_duplicate_skipped',
      updatedAt: now,
    });
    await this.record('duplicate_skipped', job);
  }

  private async advance(initial: LocalMediaJob) {
    try {
      let job = this.store.require(initial.jobId);
      if (!job.occurrenceKey) {
        await this.resolveOccurrence(job);
        return;
      }
      if (!job.preparedPath || !job.importArtifactPath || !job.finalSha256) {
        job = await this.process(job);
      }
      if (job.driveArchiveState === 'pending') {
        job = await this.attemptDriveArchive(job);
      }
      if (job.vimeoStatus !== 'available') {
        const uploaded = await this.uploadToVimeo(job);
        if (!uploaded) return;
        job = uploaded;
      }
      if (job.state !== 'complete') await this.importToOneTime(job);
    } catch (error) {
      await this.scheduleRetry(initial.jobId, error);
    }
  }

  private async process(job: LocalMediaJob) {
    const now = new Date().toISOString();
    this.store.save({
      ...job,
      state: 'processing',
      nextAttemptAt: now,
      lastSafeErrorCode: null,
      updatedAt: now,
    });
    const result = await processLocalMedia({
      job,
      settings: this.settings,
      secrets: this.secrets,
      onStage: (state) => {
        const current = this.store.require(job.jobId);
        const at = new Date().toISOString();
        this.store.save({ ...current, state, updatedAt: at, nextAttemptAt: at });
      },
    });
    const artifact = result.artifact;
    const at = new Date().toISOString();
    const updated: LocalMediaJob = {
      ...this.store.require(job.jobId),
      state: this.settings.driveArchiveEnabled ? 'drive_archive_pending' : 'processed',
      sourceSha256: artifact.sourceSha256,
      jobDirectory: result.jobDirectory,
      stagedSourcePath: result.stagedSourcePath,
      preparedPath: artifact.preparedPath,
      finalSha256: artifact.finalSha256,
      probe: result.probe,
      originalDurationMs: artifact.originalDurationMs,
      preparedDurationMs: artifact.preparedDurationMs,
      trimStartMs: artifact.trimStartMs,
      trimEndMs: artifact.trimEndMs,
      trimConfidence: artifact.trimConfidence,
      transcriptPath: result.transcriptPath,
      webvttPath: result.webvttPath,
      importArtifactPath: result.artifactPath,
      driveArchiveState: this.settings.driveArchiveEnabled ? 'pending' : 'disabled',
      nextAttemptAt: at,
      lastSafeErrorCode: null,
      updatedAt: at,
    };
    this.store.save(updated);
    await this.record('processing_complete', updated);
    return updated;
  }

  private async attemptDriveArchive(job: LocalMediaJob) {
    if (!this.settings.driveArchiveEnabled || !this.settings.driveArchiveDir) return job;
    if (!job.preparedPath || !job.finalSha256 || !job.duplicateKey) return job;
    try {
      await mkdir(this.settings.driveArchiveDir, { recursive: true });
      const archivePath = path.join(
        this.settings.driveArchiveDir,
        `${job.duplicateKey.slice(0, 32)}.mp4`,
      );
      await copyFile(job.preparedPath, archivePath);
      if ((await sha256File(archivePath)) !== job.finalSha256) {
        throw new Error('local_media_drive_archive_checksum_mismatch');
      }
      const now = new Date().toISOString();
      const updated: LocalMediaJob = {
        ...this.store.require(job.jobId),
        driveArchiveState: 'complete',
        driveArchivePath: archivePath,
        updatedAt: now,
      };
      this.store.save(updated);
      await this.record('drive_archive_complete', updated);
      return updated;
    } catch (error) {
      const now = new Date().toISOString();
      const updated: LocalMediaJob = {
        ...this.store.require(job.jobId),
        driveArchiveState: 'pending',
        driveArchivePath: null,
        nextAttemptAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        lastSafeErrorCode: sanitizeLocalMediaError(error),
        updatedAt: now,
      };
      this.store.save(updated);
      await this.record('drive_archive_pending', updated, error);
      return updated;
    }
  }

  private async uploadToVimeo(job: LocalMediaJob) {
    if (!job.preparedPath || !job.finalSha256 || !job.duplicateKey || !job.importArtifactPath) {
      throw new Error('local_media_processed_artifact_required');
    }
    if (!this.settings.vimeoAccountId) throw new Error('local_media_vimeo_account_id_required');
    const token = await this.secrets.read('vimeo_access_token');
    const client = new LocalVimeoTusClient({
      accessToken: token,
      expectedAccountId: this.settings.vimeoAccountId,
      timeoutMs: this.settings.providerTimeoutSeconds * 1_000,
      ...(this.settings.vimeoProjectUri ? { projectUri: this.settings.vimeoProjectUri } : {}),
    });
    await client.verifyIdentity();
    const marker = `ONE_TIME_LOCAL_MEDIA_V1:${job.duplicateKey}`;
    let current = this.store.require(job.jobId);
    if (!current.vimeoVideoId) {
      const uncertainAt = new Date().toISOString();
      this.store.save({
        ...current,
        state: 'unknown_provider_effect',
        nextAttemptAt: uncertainAt,
        updatedAt: uncertainAt,
      });
      try {
        const details = await stat(job.preparedPath);
        const ticket = await client.ensureUploadTicket({
          marker,
          displayName: job.displayName,
          byteLength: details.size,
        });
        const now = new Date().toISOString();
        current = {
          ...this.store.require(job.jobId),
          vimeoVideoId: ticket.videoId,
          vimeoStatus: ticket.status,
          state: 'uploading_to_vimeo',
          nextAttemptAt: now,
          lastSafeErrorCode: null,
          updatedAt: now,
        };
        this.store.save(current);
      } catch (error) {
        throw new Error(`local_media_vimeo_ticket_uncertain:${sanitizeLocalMediaError(error)}`);
      }
    }
    const videoId = current.vimeoVideoId;
    if (!videoId) throw new Error('local_media_vimeo_video_id_required');
    const uploadingAt = new Date().toISOString();
    this.store.save({
      ...current,
      state: 'uploading_to_vimeo',
      nextAttemptAt: uploadingAt,
      updatedAt: uploadingAt,
    });
    await client.resumeUpload(videoId, job.preparedPath);
    const video = await client.readVideo(videoId);
    if (video.description !== marker) throw new Error('local_media_vimeo_marker_mismatch');
    if (video.privacy !== 'nobody') throw new Error('local_media_vimeo_privacy_mismatch');
    if (['error', 'failed', 'unavailable'].includes(video.status)) {
      throw new Error('local_media_vimeo_processing_failed');
    }
    if (video.status !== 'available') {
      const now = new Date();
      now.setSeconds(now.getSeconds() + this.settings.pollIntervalSeconds);
      this.store.save({
        ...this.store.require(job.jobId),
        state: 'waiting_for_vimeo',
        vimeoStatus: video.status,
        nextAttemptAt: now.toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return null;
    }
    await client.addToProject(videoId);
    const artifact = await readProcessedArtifact(job.importArtifactPath);
    let textTrackId: string | null = null;
    if (artifact.transcriptionMode === 'openai') {
      if (!artifact.webvtt.trim()) throw new Error('local_media_webvtt_required');
      textTrackId = await client.ensureCaptions({
        videoId,
        webvtt: artifact.webvtt,
        trackName: `One Time ${job.duplicateKey.slice(0, 16)}`,
      });
    }
    const now = new Date().toISOString();
    const ready: LocalMediaJob = {
      ...this.store.require(job.jobId),
      state: 'ready_for_import',
      vimeoStatus: 'available',
      vimeoTextTrackId: textTrackId,
      nextAttemptAt: now,
      lastSafeErrorCode: current.driveArchiveState === 'pending' ? current.lastSafeErrorCode : null,
      updatedAt: now,
    };
    this.store.save(ready);
    await this.record('vimeo_private_ready', ready);
    return ready;
  }

  private async importToOneTime(job: LocalMediaJob) {
    if (
      !job.occurrenceKey ||
      !job.sourceSha256 ||
      !job.vimeoVideoId ||
      !job.importArtifactPath ||
      !job.preparedPath ||
      !job.duplicateKey
    ) {
      throw new Error('local_media_import_identity_required');
    }
    const artifact = await readProcessedArtifact(job.importArtifactPath);
    const sourceKey = `local_media_${createHash('sha256')
      .update(`${job.sourceSha256}\0${job.occurrenceKey}`)
      .digest('hex')
      .slice(0, 32)}`;
    const item: ContentFactoryIngest = {
      sourceKey,
      sourceKind: 'local_drop',
      sourceRefDigest: createHash('sha256').update(`local_drop\0${job.sourceSha256}`).digest('hex'),
      sourceSha256: job.sourceSha256,
      displayName: artifact.displayName,
      mimeType: artifact.mimeType,
      byteLength: artifact.byteLength,
      occurrenceKey: job.occurrenceKey,
      originalDurationMs: artifact.originalDurationMs,
      preparedDurationMs: artifact.preparedDurationMs,
      trimStartMs: artifact.trimStartMs,
      trimEndMs: artifact.trimEndMs,
      removedStartMs: artifact.removedStartMs,
      removedEndMs: artifact.removedEndMs,
      trimConfidence: artifact.trimConfidence,
      transcriptSegments: artifact.transcriptSegments,
      normalizedTranscript: artifact.normalizedTranscript,
      transcriptSha256: artifact.transcriptSha256,
      webvtt: artifact.webvtt,
      webvttSha256: artifact.webvttSha256,
      transcriptionModel: artifact.transcriptionModel,
      transcriptionLanguage: artifact.transcriptionLanguage,
      transcriptionMode: artifact.transcriptionMode,
      draft: artifact.draft,
      providerVideoId: job.vimeoVideoId,
      providerEmbedUrl: `https://player.vimeo.com/video/${encodeURIComponent(job.vimeoVideoId)}`,
      providerTextTrackId: job.vimeoTextTrackId,
      vimeoPrivacy: 'private',
      captionsActive: artifact.transcriptionMode === 'openai' && Boolean(job.vimeoTextTrackId),
    };
    const now = new Date().toISOString();
    this.store.save({
      ...job,
      state: 'importing',
      nextAttemptAt: now,
      updatedAt: now,
    });
    await this.oneTime.importDraft({
      occurrenceKey: job.occurrenceKey,
      item,
      nonce: randomUUID(),
    });
    const completePath = path.join(this.settings.completeDir, `${job.jobId}.mp4`);
    await copyFile(job.preparedPath, completePath);
    if ((await sha256File(completePath)) !== job.finalSha256) {
      throw new Error('local_media_complete_copy_checksum_mismatch');
    }
    const completedAt = new Date().toISOString();
    const completed: LocalMediaJob = {
      ...this.store.require(job.jobId),
      state: 'complete',
      preparedPath: completePath,
      nextAttemptAt: completedAt,
      lastSafeErrorCode: job.driveArchiveState === 'pending' ? job.lastSafeErrorCode : null,
      updatedAt: completedAt,
    };
    this.store.save(completed);
    await this.record('one_time_draft_import_complete', completed);
  }

  private async scheduleRetry(jobId: string, error: unknown) {
    const current = this.store.require(jobId);
    const safeCode = sanitizeLocalMediaError(error);
    const attemptCount = current.attemptCount + 1;
    const requiresOperator =
      safeCode.endsWith('_required') ||
      safeCode.includes('identity_mismatch') ||
      safeCode.includes('privacy_mismatch') ||
      safeCode.includes('marker_mismatch');
    const uncertain = safeCode.startsWith('local_media_vimeo_ticket_uncertain');
    const failed = requiresOperator || attemptCount >= MAX_AUTOMATIC_ATTEMPTS;
    const seconds = Math.min(900, 10 * 2 ** Math.min(attemptCount - 1, 6));
    const next = new Date(Date.now() + seconds * 1_000).toISOString();
    this.store.save({
      ...current,
      state: failed ? 'failed' : uncertain ? 'unknown_provider_effect' : 'retry_wait',
      attemptCount,
      nextAttemptAt: next,
      lastSafeErrorCode: safeCode,
      updatedAt: new Date().toISOString(),
    });
    await this.record(failed ? 'job_failed' : 'job_retry_scheduled', current, error);
  }

  private async record(event: string, job: LocalMediaJob, error?: unknown) {
    const entry = {
      at: new Date().toISOString(),
      event,
      job_id: job.jobId,
      state: this.store.get(job.jobId)?.state ?? job.state,
      ...(error ? { safe_error_code: sanitizeLocalMediaError(error) } : {}),
    };
    await appendFile(
      path.join(this.settings.logsDir, 'runner.events.jsonl'),
      `${JSON.stringify(entry)}\n`,
      'utf8',
    );
  }
}

async function ensureDirectories(settings: LocalMediaSettings) {
  await Promise.all(
    [
      settings.incomingDir,
      settings.processingDir,
      settings.readyForVimeoDir,
      settings.completeDir,
      settings.failedDir,
      settings.stateDir,
      settings.logsDir,
    ].map((directory) => mkdir(directory, { recursive: true })),
  );
}

async function acquireRunnerLock(settings: LocalMediaSettings) {
  const lockPath = path.join(settings.stateDir, 'runner.lock');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() })}\n`,
      );
      await handle.close();
      return async () => {
        try {
          const lock = JSON.parse(await readFile(lockPath, 'utf8')) as { pid?: number };
          if (lock.pid === process.pid) await unlink(lockPath);
        } catch {
          // A missing or replaced lock must not hide the runner shutdown.
        }
      };
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if (code !== 'EEXIST') throw error;
      const stale = await staleLock(lockPath);
      if (!stale || attempt > 0) throw new Error('local_media_runner_already_running');
      await unlink(lockPath);
    }
  }
  throw new Error('local_media_runner_lock_failed');
}

async function staleLock(lockPath: string) {
  try {
    const parsed = JSON.parse(await readFile(lockPath, 'utf8')) as { pid?: number };
    if (!Number.isInteger(parsed.pid) || Number(parsed.pid) < 1) return true;
    try {
      process.kill(Number(parsed.pid), 0);
      return false;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      return code === 'ESRCH';
    }
  } catch {
    return true;
  }
}

async function hasReleasedWriteHandle(filePath: string) {
  if (process.platform !== 'win32') {
    try {
      const handle = await open(filePath, 'r');
      await handle.close();
      return true;
    } catch {
      return false;
    }
  }
  const command = [
    '$stream = [IO.File]::Open($env:ONE_TIME_MEDIA_LOCK_PROBE_FILE,',
    '[IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)',
    '$stream.Dispose()',
  ].join(' ');
  const result = await runCommand(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      ...process.env,
      ONE_TIME_MEDIA_LOCK_PROBE_FILE: filePath,
    },
  );
  return result === 0;
}

async function assertFfprobeReadable(ffprobePath: string, filePath: string) {
  const exitCode = await runCommand(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    filePath,
  ]);
  if (exitCode !== 0) throw new Error('local_media_ffprobe_stability_check_failed');
}

function runCommand(executable: string, args: string[], env = process.env) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(executable, args, {
      env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? -1));
  });
}

async function sha256File(filePath: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) digest.update(chunk as Buffer);
  return digest.digest('hex');
}

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, milliseconds);
    signal?.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
}
