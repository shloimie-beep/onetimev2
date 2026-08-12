import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const LOCAL_MEDIA_JOB_STATES = [
  'waiting_for_stability',
  'ready_for_processing',
  'processing',
  'transcribing',
  'processed',
  'drive_archive_pending',
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

export type LocalMediaJobState = (typeof LOCAL_MEDIA_JOB_STATES)[number];

const settingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    rootPath: z.string().trim().min(1),
    incomingDir: z.string().trim().min(1),
    processingDir: z.string().trim().min(1),
    readyForVimeoDir: z.string().trim().min(1),
    completeDir: z.string().trim().min(1),
    failedDir: z.string().trim().min(1),
    stateDir: z.string().trim().min(1),
    logsDir: z.string().trim().min(1),
    driveArchiveDir: z.string().default(''),
    driveArchiveEnabled: z.boolean().default(false),
    driveArchiveIsNonBlocking: z.literal(true).default(true),
    vimeoUploadPrimary: z.literal(true).default(true),
    transcriptionMode: z.enum(['openai', 'off']).default('openai'),
    stableFileSeconds: z.number().int().min(10).max(3_600).default(60),
    rawSourceRetentionDays: z.number().int().min(7).max(365).default(7),
    processedLocalRetentionDays: z.number().int().min(1).max(365).default(3),
    preferredObsContainer: z.enum(['mkv', 'mp4']).default('mkv'),
    repositoryPath: z.string().default(''),
    ffmpegPath: z.string().trim().min(1).optional(),
    ffprobePath: z.string().trim().min(1).optional(),
    oneTimeBaseUrl: z.url().optional(),
    openAiProjectId: z.string().trim().min(3).max(200).optional(),
    openAiOrganizationId: z.string().trim().min(3).max(200).optional(),
    vimeoAccountId: z.string().trim().min(1).max(200).optional(),
    vimeoProjectUri: z
      .string()
      .trim()
      .regex(/^\/users\/[^/]+\/projects\/[^/]+$/u)
      .optional(),
    occurrenceWindowBeforeMinutes: z.number().int().min(0).max(720).default(240),
    occurrenceWindowAfterMinutes: z.number().int().min(0).max(720).default(120),
    pollIntervalSeconds: z.number().int().min(2).max(300).default(10),
    providerTimeoutSeconds: z.number().int().min(10).max(1_800).default(120),
    legacyKeyholderDir: z.string().trim().min(1).optional(),
  })
  .strict();

export type LocalMediaSettings = z.infer<typeof settingsSchema> & {
  settingsPath: string;
};

export type LocalMediaOccurrence = {
  occurrence_key: string;
  class_title: string;
  class_date: string;
  starts_at: string;
};

export type LocalMediaProbe = {
  durationMs: number;
  codedWidth: number;
  codedHeight: number;
  framesPerSecond: number;
  rotationDegrees: 0 | 90 | 180 | 270;
  videoCodec: string | null;
  audioCodec: string | null;
  videoStreamCount: number;
  audioStreamCount: number;
};

export type LocalMediaJob = {
  jobId: string;
  sourcePath: string;
  displayName: string;
  observedSize: number;
  observedMtimeMs: number;
  recordedAt: string;
  stableSince: string;
  state: LocalMediaJobState;
  sourceSha256: string | null;
  occurrenceKey: string | null;
  occurrenceCandidates: LocalMediaOccurrence[];
  duplicateKey: string | null;
  jobDirectory: string | null;
  stagedSourcePath: string | null;
  preparedPath: string | null;
  finalSha256: string | null;
  probe: LocalMediaProbe | null;
  originalDurationMs: number | null;
  preparedDurationMs: number | null;
  trimStartMs: number;
  trimEndMs: number | null;
  trimConfidence: number;
  transcriptPath: string | null;
  webvttPath: string | null;
  importArtifactPath: string | null;
  vimeoVideoId: string | null;
  vimeoTextTrackId: string | null;
  vimeoStatus: string | null;
  driveArchiveState: 'disabled' | 'pending' | 'complete';
  driveArchivePath: string | null;
  attemptCount: number;
  nextAttemptAt: string;
  lastSafeErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function loadLocalMediaSettings(settingsPath?: string) {
  const home = process.env.USERPROFILE ?? process.env.HOME;
  if (!home) throw new Error('local_media_home_directory_required');
  const resolvedSettingsPath = path.resolve(
    expandWindowsEnvironment(
      settingsPath ??
        process.env.ONE_TIME_MEDIA_SETTINGS_PATH ??
        path.join(home, 'OneTimeMedia', 'Config', 'settings.local.json'),
      home,
    ),
  );
  const raw = JSON.parse(
    (await readFile(resolvedSettingsPath, 'utf8')).replace(/^\uFEFF/u, ''),
  ) as unknown;
  const parsed = settingsSchema.parse(raw);
  const expanded = Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      typeof value === 'string' ? expandWindowsEnvironment(value, home) : value,
    ]),
  );
  const settings = settingsSchema.parse(expanded);
  const rootPath = path.resolve(settings.rootPath);
  for (const [name, value] of Object.entries({
    incomingDir: settings.incomingDir,
    processingDir: settings.processingDir,
    readyForVimeoDir: settings.readyForVimeoDir,
    completeDir: settings.completeDir,
    failedDir: settings.failedDir,
    stateDir: settings.stateDir,
    logsDir: settings.logsDir,
  })) {
    const resolved = path.resolve(value);
    if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) {
      throw new Error(`local_media_${name}_outside_root`);
    }
  }
  if (settings.driveArchiveEnabled && !settings.driveArchiveDir.trim()) {
    throw new Error('local_media_drive_archive_directory_required');
  }
  return { ...settings, settingsPath: resolvedSettingsPath } as LocalMediaSettings;
}

export function sanitizeLocalMediaError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    raw
      .replace(/https?:\/\/\S+/giu, '[redacted-url]')
      .replace(/Bearer\s+[A-Za-z0-9._=-]+/giu, 'Bearer [redacted]')
      .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/gu, '[redacted-openai-key]')
      .replace(/[A-Za-z]:\\[^\s"']+/gu, '[local-path]')
      .replace(/[^a-z0-9_.:-]+/giu, '_')
      .slice(0, 160) || 'local_media_unexpected'
  );
}

function expandWindowsEnvironment(value: string, home: string) {
  return value
    .replaceAll('%USERPROFILE%', home)
    .replaceAll('%HOME%', home)
    .replace(/^~(?=$|[\\/])/u, home);
}
