import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const LOCAL_MEDIA_STATES = [
  'detected',
  'waiting_for_stability',
  'ready_for_processing',
  'processing',
  'extracting_audio',
  'transcribing',
  'building_captions',
  'processed',
  'copying_to_drive',
  'drive_copy_complete',
  'uploading_to_vimeo',
  'waiting_for_vimeo',
  'needs_occurrence_selection',
  'ready_for_import',
  'importing',
  'complete',
  'retry_wait',
  'failed',
  'unknown_provider_effect',
] as const;

export type LocalMediaState = (typeof LOCAL_MEDIA_STATES)[number];

export type LocalMediaConfig = {
  incomingDir: string;
  processingDir: string;
  completeDir: string;
  failedDir: string;
  stateDir: string;
  driveArchiveDir: string;
  transcriptionMode: 'openai' | 'off';
  localRetentionDays: number;
  vimeoProjectRef: string | null;
  appBaseUrl: string;
  stabilityWindowMs: number;
};

export type LocalMediaJob = {
  id: string;
  source_path: string;
  source_name: string;
  source_sha256: string | null;
  state: LocalMediaState;
  size_bytes: number;
  mtime_ms: number;
  stable_since_ms: number;
  attempts: number;
  duplicate_of_job_id: string | null;
  output_dir: string | null;
  archive_path: string | null;
  provider_video_ref_digest: string | null;
  safe_error_code: string | null;
  created_at: string;
  updated_at: string;
};

const SUPPORTED_EXTENSIONS = new Set(['.mkv', '.mov', '.mp4']);

export function loadLocalMediaConfig(source: NodeJS.ProcessEnv = process.env): LocalMediaConfig {
  const root = path.resolve(source.ONETIME_MEDIA_ROOT_DIR ?? 'C:/OneTimeMedia');
  const config: LocalMediaConfig = {
    incomingDir: path.resolve(source.ONETIME_MEDIA_INCOMING_DIR ?? path.join(root, 'Incoming')),
    processingDir: path.resolve(
      source.ONETIME_MEDIA_PROCESSING_DIR ?? path.join(root, 'Processing'),
    ),
    completeDir: path.resolve(source.ONETIME_MEDIA_COMPLETE_DIR ?? path.join(root, 'Complete')),
    failedDir: path.resolve(source.ONETIME_MEDIA_FAILED_DIR ?? path.join(root, 'Failed')),
    stateDir: path.resolve(source.ONETIME_MEDIA_STATE_DIR ?? path.join(root, 'State')),
    driveArchiveDir: path.resolve(
      source.ONETIME_MEDIA_DRIVE_ARCHIVE_DIR ?? path.join(root, 'DriveArchive'),
    ),
    transcriptionMode: source.ONETIME_MEDIA_TRANSCRIPTION_MODE === 'off' ? 'off' : 'openai',
    localRetentionDays: positiveInt(source.ONETIME_MEDIA_LOCAL_RETENTION_DAYS, 7),
    vimeoProjectRef: nullable(source.ONETIME_MEDIA_VIMEO_PROJECT_REF),
    appBaseUrl: (source.ONETIME_MEDIA_APP_BASE_URL ?? 'https://onetime.sh').replace(/\/+$/, ''),
    stabilityWindowMs: positiveInt(source.ONETIME_MEDIA_STABILITY_SECONDS, 60) * 1_000,
  };
  assertDistinctDirectories(config);
  return config;
}

export function isSupportedMediaPath(filePath: string) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isStableObservation(input: {
  previousSize: number;
  previousMtimeMs: number;
  stableSinceMs: number;
  currentSize: number;
  currentMtimeMs: number;
  nowMs: number;
  requiredMs: number;
}) {
  return (
    input.currentSize > 0 &&
    input.currentSize === input.previousSize &&
    input.currentMtimeMs === input.previousMtimeMs &&
    input.nowMs - input.stableSinceMs >= input.requiredMs
  );
}

export function recoveryState(state: LocalMediaState): LocalMediaState {
  if (['processing', 'extracting_audio', 'transcribing', 'building_captions'].includes(state)) {
    return 'ready_for_processing';
  }
  if (state === 'copying_to_drive') return 'processed';
  if (state === 'uploading_to_vimeo' || state === 'waiting_for_vimeo') {
    return 'unknown_provider_effect';
  }
  if (state === 'importing') return 'ready_for_import';
  return state;
}

export function occurrenceDecision<T extends { occurrence_key: string }>(items: T[]) {
  if (items.length === 1) return { state: 'selected' as const, occurrence: items[0] };
  return {
    state: 'needs_occurrence_selection' as const,
    occurrence: null,
    candidateCount: items.length,
  };
}

export function classifyExternalFailure(input: {
  stage: LocalMediaState;
  requestDispatched: boolean;
}) {
  if (
    input.requestDispatched &&
    ['uploading_to_vimeo', 'waiting_for_vimeo', 'importing'].includes(input.stage)
  ) {
    return 'unknown_provider_effect' as const;
  }
  return 'retry_wait' as const;
}

export function redactLocalMediaText(value: string) {
  return value
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, '[redacted-openai-key]')
    .replace(/Bearer\s+[A-Za-z0-9._=-]+/gi, 'Bearer [redacted]')
    .replace(/([?&](?:token|key|signature)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/C:\\Users\\[^\\\s]+\\[^\s"']+/gi, '[local-path]');
}

export async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export async function assertReadableUnlocked(filePath: string) {
  const handle = await open(filePath, 'r+');
  await handle.close();
}

export function driveArchiveDayDirectory(root: string, at = new Date()) {
  return path.join(
    root,
    String(at.getFullYear()),
    String(at.getMonth() + 1).padStart(2, '0'),
    String(at.getDate()).padStart(2, '0'),
  );
}

export async function archiveVerifiedFile(input: {
  sourcePath: string;
  archiveDir: string;
  destinationName?: string;
}) {
  await mkdir(input.archiveDir, { recursive: true });
  const destination = path.join(
    input.archiveDir,
    input.destinationName ?? path.basename(input.sourcePath),
  );
  const partial = `${destination}.partial`;
  await rm(partial, { force: true });
  await copyFile(input.sourcePath, partial);
  const [sourceStat, partialStat, sourceHash, partialHash] = await Promise.all([
    stat(input.sourcePath),
    stat(partial),
    sha256File(input.sourcePath),
    sha256File(partial),
  ]);
  if (sourceStat.size !== partialStat.size || sourceHash !== partialHash) {
    throw new Error('drive_archive_verification_failed');
  }
  await rename(partial, destination);
  return { destination, byteLength: partialStat.size, sha256: partialHash };
}

export async function writePrivateJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export async function readPrivateJson<T>(filePath: string): Promise<T> {
  if (!/\.private\.json$/i.test(filePath)) throw new Error('private_json_suffix_required');
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export class LocalMediaStore {
  readonly database: DatabaseSync;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS media_jobs (
        id TEXT PRIMARY KEY,
        source_path TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_sha256 TEXT,
        state TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        mtime_ms REAL NOT NULL,
        stable_since_ms REAL NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        duplicate_of_job_id TEXT,
        output_dir TEXT,
        archive_path TEXT,
        provider_video_ref_digest TEXT,
        safe_error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_path, size_bytes, mtime_ms)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS media_jobs_sha_active_idx
        ON media_jobs(source_sha256)
        WHERE source_sha256 IS NOT NULL AND duplicate_of_job_id IS NULL;
      CREATE TABLE IF NOT EXISTS media_job_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        state TEXT NOT NULL,
        safe_code TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  close() {
    this.database.close();
  }

  createDetected(input: {
    sourcePath: string;
    sourceName: string;
    sizeBytes: number;
    mtimeMs: number;
    nowMs?: number;
  }) {
    const existing = this.database
      .prepare(
        `SELECT * FROM media_jobs
           WHERE source_path = ? AND size_bytes = ? AND mtime_ms = ? LIMIT 1`,
      )
      .get(input.sourcePath, input.sizeBytes, input.mtimeMs) as LocalMediaJob | undefined;
    if (existing) return existing;
    const id = `media_${randomUUID().replaceAll('-', '')}`;
    const nowMs = input.nowMs ?? Date.now();
    const now = new Date(nowMs).toISOString();
    this.database
      .prepare(
        `INSERT INTO media_jobs
          (id, source_path, source_name, state, size_bytes, mtime_ms, stable_since_ms,
           created_at, updated_at)
         VALUES (?, ?, ?, 'waiting_for_stability', ?, ?, ?, ?, ?)`,
      )
      .run(id, input.sourcePath, input.sourceName, input.sizeBytes, input.mtimeMs, nowMs, now, now);
    this.event(id, 'waiting_for_stability', 'source_detected');
    return this.get(id)!;
  }

  get(id: string) {
    return this.database.prepare('SELECT * FROM media_jobs WHERE id = ?').get(id) as
      LocalMediaJob | undefined;
  }

  list() {
    return this.database
      .prepare('SELECT * FROM media_jobs ORDER BY created_at DESC')
      .all() as unknown as LocalMediaJob[];
  }

  findCanonicalBySha(sha256: string, excludeId: string) {
    return this.database
      .prepare(
        `SELECT * FROM media_jobs
          WHERE source_sha256 = ? AND id <> ? AND duplicate_of_job_id IS NULL
          ORDER BY created_at ASC LIMIT 1`,
      )
      .get(sha256, excludeId) as LocalMediaJob | undefined;
  }

  recordObservation(id: string, input: { sizeBytes: number; mtimeMs: number; nowMs: number }) {
    const job = this.get(id);
    if (!job) throw new Error('local_media_job_not_found');
    const unchanged = job.size_bytes === input.sizeBytes && job.mtime_ms === input.mtimeMs;
    this.database
      .prepare(
        `UPDATE media_jobs
            SET size_bytes = ?, mtime_ms = ?, stable_since_ms = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(
        input.sizeBytes,
        input.mtimeMs,
        unchanged ? job.stable_since_ms : input.nowMs,
        new Date(input.nowMs).toISOString(),
        id,
      );
    return this.get(id)!;
  }

  setSha(id: string, sha256: string) {
    try {
      this.database
        .prepare('UPDATE media_jobs SET source_sha256 = ?, updated_at = ? WHERE id = ?')
        .run(sha256, new Date().toISOString(), id);
      return { duplicate: null as LocalMediaJob | null };
    } catch (error) {
      const duplicate = this.findCanonicalBySha(sha256, id);
      if (!duplicate) throw error;
      this.database
        .prepare(
          `UPDATE media_jobs
              SET source_sha256 = NULL, duplicate_of_job_id = ?, state = 'complete',
                  safe_error_code = 'duplicate_source_sha256', updated_at = ?
            WHERE id = ?`,
        )
        .run(duplicate.id, new Date().toISOString(), id);
      this.event(id, 'complete', 'duplicate_source_sha256');
      return { duplicate };
    }
  }

  transition(
    id: string,
    state: LocalMediaState,
    patch: Partial<
      Pick<
        LocalMediaJob,
        'output_dir' | 'archive_path' | 'provider_video_ref_digest' | 'safe_error_code' | 'attempts'
      >
    > = {},
  ) {
    if (!LOCAL_MEDIA_STATES.includes(state)) throw new Error('local_media_state_invalid');
    const job = this.get(id);
    if (!job) throw new Error('local_media_job_not_found');
    this.database
      .prepare(
        `UPDATE media_jobs SET state = ?, output_dir = ?, archive_path = ?,
          provider_video_ref_digest = ?, safe_error_code = ?, attempts = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        state,
        patch.output_dir ?? job.output_dir,
        patch.archive_path ?? job.archive_path,
        patch.provider_video_ref_digest ?? job.provider_video_ref_digest,
        patch.safe_error_code === undefined ? job.safe_error_code : patch.safe_error_code,
        patch.attempts ?? job.attempts,
        new Date().toISOString(),
        id,
      );
    this.event(id, state, patch.safe_error_code ?? null);
    return this.get(id)!;
  }

  recoverInterrupted() {
    for (const job of this.list()) {
      const recovered = recoveryState(job.state);
      if (recovered !== job.state) {
        this.transition(job.id, recovered, {
          safe_error_code:
            recovered === 'unknown_provider_effect'
              ? 'provider_effect_requires_reconciliation'
              : 'runner_restart_recovered',
        });
      }
    }
  }

  retry(id: string) {
    const job = this.get(id);
    if (!job) throw new Error('local_media_job_not_found');
    if (job.state === 'unknown_provider_effect') {
      throw new Error('provider_effect_reconciliation_required');
    }
    if (
      !['failed', 'retry_wait', 'needs_occurrence_selection', 'ready_for_import'].includes(
        job.state,
      )
    ) {
      throw new Error('local_media_job_not_retryable');
    }
    if (job.state === 'ready_for_import' || job.state === 'needs_occurrence_selection') {
      return this.transition(id, job.state, {
        attempts: job.attempts + 1,
        safe_error_code: null,
      });
    }
    return this.transition(
      id,
      job.source_sha256 ? 'ready_for_processing' : 'waiting_for_stability',
      {
        attempts: job.attempts + 1,
        safe_error_code: null,
      },
    );
  }

  private event(jobId: string, state: LocalMediaState, safeCode: string | null) {
    this.database
      .prepare(
        'INSERT INTO media_job_events (job_id, state, safe_code, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(jobId, state, safeCode, new Date().toISOString());
  }
}

function assertDistinctDirectories(config: LocalMediaConfig) {
  const entries = [
    config.incomingDir,
    config.processingDir,
    config.completeDir,
    config.failedDir,
    config.stateDir,
    config.driveArchiveDir,
  ].map((item) => path.resolve(item).toLowerCase());
  if (new Set(entries).size !== entries.length) {
    throw new Error('local_media_directories_must_be_distinct');
  }
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nullable(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
