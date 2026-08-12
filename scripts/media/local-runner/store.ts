import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { LocalMediaJob, LocalMediaJobState } from './contracts.ts';

export class LocalMediaJobStore {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec(
      'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
    );
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS local_media_jobs (
        job_id TEXT PRIMARY KEY,
        source_path TEXT NOT NULL UNIQUE,
        source_sha256 TEXT,
        occurrence_key TEXT,
        duplicate_key TEXT UNIQUE,
        state TEXT NOT NULL,
        job_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS local_media_jobs_state_idx
        ON local_media_jobs(state, updated_at, job_id);
      CREATE INDEX IF NOT EXISTS local_media_jobs_source_occurrence_idx
        ON local_media_jobs(source_sha256, occurrence_key)
        WHERE source_sha256 IS NOT NULL AND occurrence_key IS NOT NULL;
    `);
  }

  close() {
    this.database.close();
  }

  recoverInterrupted(now = new Date()) {
    for (const job of this.list()) {
      if (job.state === 'processing' || job.state === 'transcribing') {
        this.save({
          ...job,
          state: 'retry_wait',
          nextAttemptAt: now.toISOString(),
          lastSafeErrorCode: 'local_media_restart_recovered_processing',
          updatedAt: now.toISOString(),
        });
      } else if (job.state === 'importing') {
        this.save({
          ...job,
          state: 'ready_for_import',
          nextAttemptAt: now.toISOString(),
          lastSafeErrorCode: 'local_media_restart_recovered_import',
          updatedAt: now.toISOString(),
        });
      }
    }
  }

  upsertObservation(input: {
    sourcePath: string;
    displayName: string;
    size: number;
    mtimeMs: number;
    birthtimeMs: number;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const existing = this.getBySourcePath(input.sourcePath);
    if (existing) {
      if (existing.state !== 'waiting_for_stability') return existing;
      const unchanged =
        existing.observedSize === input.size && existing.observedMtimeMs === input.mtimeMs;
      const updated: LocalMediaJob = {
        ...existing,
        displayName: input.displayName,
        observedSize: input.size,
        observedMtimeMs: input.mtimeMs,
        recordedAt: new Date(input.birthtimeMs || input.mtimeMs).toISOString(),
        stableSince: unchanged ? existing.stableSince : now.toISOString(),
        updatedAt: now.toISOString(),
      };
      this.save(updated);
      return updated;
    }
    const jobId = `local_job_${createHash('sha256')
      .update(`${input.sourcePath.toLowerCase()}\0${input.birthtimeMs || input.mtimeMs}`)
      .digest('hex')
      .slice(0, 32)}`;
    const job: LocalMediaJob = {
      jobId,
      sourcePath: input.sourcePath,
      displayName: input.displayName,
      observedSize: input.size,
      observedMtimeMs: input.mtimeMs,
      recordedAt: new Date(input.birthtimeMs || input.mtimeMs).toISOString(),
      stableSince: now.toISOString(),
      state: 'waiting_for_stability',
      sourceSha256: null,
      occurrenceKey: null,
      occurrenceCandidates: [],
      duplicateKey: null,
      jobDirectory: null,
      stagedSourcePath: null,
      preparedPath: null,
      finalSha256: null,
      probe: null,
      originalDurationMs: null,
      preparedDurationMs: null,
      trimStartMs: 0,
      trimEndMs: null,
      trimConfidence: 0,
      transcriptPath: null,
      webvttPath: null,
      importArtifactPath: null,
      vimeoVideoId: null,
      vimeoTextTrackId: null,
      vimeoStatus: null,
      driveArchiveState: 'disabled',
      driveArchivePath: null,
      attemptCount: 0,
      nextAttemptAt: now.toISOString(),
      lastSafeErrorCode: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.save(job);
    return job;
  }

  assignOccurrence(jobId: string, occurrenceKey: string, now = new Date()) {
    const job = this.require(jobId);
    if (!job.sourceSha256) throw new Error('local_media_source_hash_required');
    const duplicateKey = createHash('sha256')
      .update(`${job.sourceSha256}\0${occurrenceKey}`)
      .digest('hex');
    const duplicate = this.database
      .prepare(
        `SELECT job_json FROM local_media_jobs
          WHERE duplicate_key = ? AND job_id <> ? LIMIT 1`,
      )
      .get(duplicateKey, jobId) as { job_json?: string } | undefined;
    if (duplicate?.job_json) {
      return { job, duplicateOf: parseJob(duplicate.job_json) };
    }
    const updated: LocalMediaJob = {
      ...job,
      occurrenceKey,
      duplicateKey,
      state: 'ready_for_processing',
      nextAttemptAt: now.toISOString(),
      lastSafeErrorCode: null,
      updatedAt: now.toISOString(),
    };
    this.save(updated);
    return { job: updated, duplicateOf: null };
  }

  save(job: LocalMediaJob) {
    this.database
      .prepare(
        `INSERT INTO local_media_jobs
           (job_id, source_path, source_sha256, occurrence_key, duplicate_key, state,
            job_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(job_id) DO UPDATE SET
           source_path = excluded.source_path,
           source_sha256 = excluded.source_sha256,
           occurrence_key = excluded.occurrence_key,
           duplicate_key = excluded.duplicate_key,
           state = excluded.state,
           job_json = excluded.job_json,
           updated_at = excluded.updated_at`,
      )
      .run(
        job.jobId,
        job.sourcePath,
        job.sourceSha256,
        job.occurrenceKey,
        job.duplicateKey,
        job.state,
        JSON.stringify(job),
        job.createdAt,
        job.updatedAt,
      );
  }

  get(jobId: string) {
    const row = this.database
      .prepare('SELECT job_json FROM local_media_jobs WHERE job_id = ? LIMIT 1')
      .get(jobId) as { job_json?: string } | undefined;
    return row?.job_json ? parseJob(row.job_json) : null;
  }

  require(jobId: string) {
    const job = this.get(jobId);
    if (!job) throw new Error('local_media_job_not_found');
    return job;
  }

  getBySourcePath(sourcePath: string) {
    const row = this.database
      .prepare('SELECT job_json FROM local_media_jobs WHERE source_path = ? LIMIT 1')
      .get(sourcePath) as { job_json?: string } | undefined;
    return row?.job_json ? parseJob(row.job_json) : null;
  }

  list(states?: readonly LocalMediaJobState[]) {
    const rows = states?.length
      ? (this.database
          .prepare(
            `SELECT job_json FROM local_media_jobs
              WHERE state IN (${states.map(() => '?').join(',')})
              ORDER BY created_at ASC, job_id ASC`,
          )
          .all(...states) as { job_json: string }[])
      : (this.database
          .prepare('SELECT job_json FROM local_media_jobs ORDER BY created_at ASC, job_id ASC')
          .all() as { job_json: string }[]);
    return rows.map((row) => parseJob(row.job_json));
  }
}

function parseJob(value: string) {
  return JSON.parse(value) as LocalMediaJob;
}
