import { createHash } from 'node:crypto';
import {
  LEARNING_DELIVERY_ACCOUNT_KEY,
  LEARNING_DELIVERY_PRODUCT_KEY,
  learningDeliveryBusinessEventPayloadSchema,
  learningDeliveryDriveFileMetadataSchema,
  learningDeliveryProbeSummarySchema,
  learningDeliveryTranscriptSegmentSchema,
  learningDeliveryTrimDecisionSchema,
  type LearningDeliveryBusinessEventPayload,
  type LearningDeliveryBusinessEventType,
  type LearningDeliveryDriveFileMetadata,
  type LearningDeliveryMediaState,
  type LearningDeliveryProbeSummary,
  type LearningDeliveryTranscriptSegment,
  type LearningDeliveryTrimDecision,
} from '../../../contracts/src/content/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { stableOt86Key } from './pipeline.ts';

const RAW_LEAK_PATTERN =
  /(https?:\/\/|zoom\.us|vimeo\.com|drive\.google\.com|join_url|passcode|password|registrant|raw_transcript(?!_present)|student_credential(?!_present)|bearer\s+[a-z0-9._-]+)/i;

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
]);

export const LEARNING_DELIVERY_MEDIA_STATES: LearningDeliveryMediaState[] = [
  'discovered',
  'downloading',
  'probing',
  'transcribing',
  'transcript_ready',
  'trim_review',
  'rendering',
  'vimeo_uploading',
  'vimeo_processing',
  'content_review',
  'ready_to_publish',
  'published',
  'failed',
];

export const LEARNING_DELIVERY_ALLOWED_TRANSITIONS: Record<
  LearningDeliveryMediaState,
  LearningDeliveryMediaState[]
> = {
  discovered: ['downloading', 'failed'],
  downloading: ['probing', 'failed'],
  probing: ['transcribing', 'trim_review', 'failed'],
  transcribing: ['transcript_ready', 'failed'],
  transcript_ready: ['trim_review', 'failed'],
  trim_review: ['rendering', 'failed'],
  rendering: ['vimeo_uploading', 'failed'],
  vimeo_uploading: ['vimeo_processing', 'failed'],
  vimeo_processing: ['content_review', 'failed'],
  content_review: ['ready_to_publish', 'failed'],
  ready_to_publish: ['published', 'failed'],
  published: [],
  failed: [],
};

export class LearningDeliveryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function assertLearningDeliveryTransition(
  from: LearningDeliveryMediaState,
  to: LearningDeliveryMediaState,
) {
  if (!LEARNING_DELIVERY_ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_INVALID_STATE_TRANSITION',
      `Cannot transition learning media from ${from} to ${to}.`,
    );
  }
}

export function learningDeliverySha256Hex(value: string | Buffer | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeLearningDeliveryDriveFile(input: {
  providerFileId: string;
  parentFolderId?: string | null;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  providerMd5Checksum?: string | null;
  modifiedAt?: string | null;
  webViewLink?: string | null;
}):
  | { accepted: true; metadata: LearningDeliveryDriveFileMetadata; sourceRefDigest: string }
  | { accepted: false; reason: 'unsupported_mime_type' | 'empty_file' | 'raw_url_rejected' } {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!VIDEO_MIME_TYPES.has(mimeType)) return { accepted: false, reason: 'unsupported_mime_type' };
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { accepted: false, reason: 'empty_file' };
  }
  if (input.webViewLink && RAW_LEAK_PATTERN.test(input.webViewLink)) {
    return { accepted: false, reason: 'raw_url_rejected' };
  }

  const metadata = learningDeliveryDriveFileMetadataSchema.parse({
    source_kind: 'drive_recording',
    provider_file_id_digest: learningDeliverySha256Hex(input.providerFileId),
    parent_folder_digest: input.parentFolderId
      ? learningDeliverySha256Hex(input.parentFolderId)
      : null,
    display_name: input.displayName,
    mime_type: mimeType,
    size_bytes: input.sizeBytes,
    provider_md5_checksum: input.providerMd5Checksum ?? null,
    source_modified_at: input.modifiedAt ?? null,
    raw_url_present: false,
  });

  return {
    accepted: true,
    metadata,
    sourceRefDigest: stableOt86Key('learning_delivery_drive_file', [
      metadata.provider_file_id_digest,
      String(metadata.size_bytes),
      metadata.provider_md5_checksum ?? '',
    ]),
  };
}

export function buildLearningDeliveryFfprobePlan(input: { inputPath: string }) {
  if (!input.inputPath.trim()) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_INPUT_PATH_REQUIRED',
      'Input path required.',
    );
  }
  return {
    executable: 'ffprobe',
    args: [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      input.inputPath,
    ],
  };
}

export function parseLearningDeliveryFfprobeJson(raw: string): LearningDeliveryProbeSummary {
  const parsed = JSON.parse(raw) as {
    format?: { duration?: string | number };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      duration?: string | number;
    }>;
  };
  const streams = parsed.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const durationSeconds = Number(
    parsed.format?.duration ?? video?.duration ?? audio?.duration ?? 0,
  );
  const summary = learningDeliveryProbeSummarySchema.parse({
    duration_ms: Math.max(0, Math.round(durationSeconds * 1000)),
    width: typeof video?.width === 'number' ? video.width : null,
    height: typeof video?.height === 'number' ? video.height : null,
    video_codec: video?.codec_name ?? null,
    audio_codec: audio?.codec_name ?? null,
    stream_count: streams.length,
  });
  if (summary.stream_count < 1 || summary.duration_ms < 1) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_INVALID_MEDIA_PROBE',
      'Media probe did not include playable streams and duration.',
    );
  }
  return summary;
}

export function suggestLearningDeliveryTrim(input: {
  durationMs: number;
  silenceRanges: Array<{ startMs: number; endMs: number }>;
  minimumSilenceMs?: number;
  guardMs?: number;
}): LearningDeliveryTrimDecision {
  const minimumSilenceMs = input.minimumSilenceMs ?? 2_000;
  const guardMs = input.guardMs ?? 250;
  const leading = input.silenceRanges.find(
    (range) => range.startMs <= guardMs && range.endMs - range.startMs >= minimumSilenceMs,
  );
  const trailing = [...input.silenceRanges]
    .reverse()
    .find(
      (range) =>
        input.durationMs - range.endMs <= guardMs &&
        range.endMs - range.startMs >= minimumSilenceMs,
    );
  const startMs = leading ? Math.min(input.durationMs, Math.max(0, leading.endMs)) : 0;
  const endMs = trailing
    ? Math.max(startMs, Math.min(input.durationMs, trailing.startMs))
    : input.durationMs;
  return learningDeliveryTrimDecisionSchema.parse({
    start_ms: startMs,
    end_ms: endMs,
    reason_code:
      startMs > 0 || endMs < input.durationMs
        ? 'leading_trailing_silence'
        : 'no_safe_trim_detected',
    requires_operator_approval: true,
    auto_cut_performed: false,
  });
}

export function buildLearningDeliveryFfmpegRenderPlan(input: {
  inputPath: string;
  outputPath: string;
  trim?: LearningDeliveryTrimDecision & { approvedByActorId?: string | null };
}) {
  if (!input.inputPath.trim() || !input.outputPath.trim()) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_RENDER_PATH_REQUIRED',
      'Input and output paths are required.',
    );
  }
  if (input.trim && !input.trim.approvedByActorId) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_TRIM_APPROVAL_REQUIRED',
      'Trim plans must be approved by an operator before render.',
    );
  }
  const args = ['-hide_banner', '-y'];
  if (input.trim) {
    args.push('-ss', seconds(input.trim.start_ms), '-to', seconds(input.trim.end_ms));
  }
  args.push(
    '-i',
    input.inputPath,
    '-map',
    '0',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    input.outputPath,
  );
  return { executable: 'ffmpeg', args };
}

export function normalizeLearningDeliveryTranscriptSegments(
  segments: Array<{ startMs: number; endMs: number; text: string; segmentId?: string }>,
): LearningDeliveryTranscriptSegment[] {
  return segments.map((segment, index) =>
    learningDeliveryTranscriptSegmentSchema.parse({
      segment_id: segment.segmentId ?? `seg_${String(index + 1).padStart(4, '0')}`,
      start_ms: segment.startMs,
      end_ms: segment.endMs,
      text: segment.text.replace(/\s+/g, ' ').trim(),
    }),
  );
}

export function buildLearningDeliveryWebVtt(segments: LearningDeliveryTranscriptSegment[]) {
  const cues = segments.map(
    (segment) =>
      `${segment.segment_id}\n${vttTime(segment.start_ms)} --> ${vttTime(
        segment.end_ms,
      )}\n${segment.text}`,
  );
  return ['WEBVTT', ...cues].join('\n\n') + '\n';
}

export function createLearningDeliveryOpenAiTranscriptionAdapter(input: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}) {
  if (!input.apiKey.trim()) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_OPENAI_KEY_REQUIRED',
      'OpenAI transcription key is required.',
    );
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async transcribeAudioBuffer(request: {
      audio: Buffer | Uint8Array;
      fileName: string;
      mimeType: string;
      prompt?: string;
    }) {
      const form = new FormData();
      form.set('model', input.model);
      form.set('response_format', 'verbose_json');
      form.set('timestamp_granularities[]', 'segment');
      if (request.prompt) form.set('prompt', request.prompt);
      const audioBuffer = new ArrayBuffer(request.audio.byteLength);
      new Uint8Array(audioBuffer).set(request.audio);
      form.set(
        'file',
        new Blob([audioBuffer], { type: request.mimeType }),
        sanitizeFileName(request.fileName),
      );
      const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${input.apiKey}` },
        body: form,
      });
      if (!response.ok) {
        throw new LearningDeliveryError(
          'LEARNING_DELIVERY_TRANSCRIPTION_FAILED',
          `Transcription provider returned ${response.status}.`,
        );
      }
      const payload = (await response.json()) as {
        text?: string;
        segments?: Array<{ id?: number | string; start?: number; end?: number; text?: string }>;
      };
      return normalizeLearningDeliveryTranscriptSegments(
        (payload.segments ?? [{ start: 0, end: 0, text: payload.text ?? '' }]).map(
          (segment, index) => ({
            segmentId: segment.id
              ? `seg_${segment.id}`
              : `seg_${String(index + 1).padStart(4, '0')}`,
            startMs: Math.max(0, Math.round(Number(segment.start ?? 0) * 1000)),
            endMs: Math.max(0, Math.round(Number(segment.end ?? 0) * 1000)),
            text: segment.text ?? '',
          }),
        ),
      );
    },
  };
}

export function sanitizeLearningDeliveryMetadata(value: unknown): {
  value: unknown;
  count: number;
} {
  return sanitizeUnknown(value);
}

export function buildLearningDeliveryBusinessEvent(input: {
  eventType: LearningDeliveryBusinessEventType;
  sourceKey?: string | null;
  classOccurrenceKey?: string | null;
  safeMetadata?: Record<string, unknown>;
  occurredAt?: Date;
  eventKey?: string;
}): LearningDeliveryBusinessEventPayload {
  const sanitized = sanitizeLearningDeliveryMetadata(input.safeMetadata ?? {});
  const occurredAt = input.occurredAt ?? new Date();
  const payload = learningDeliveryBusinessEventPayloadSchema.parse({
    account_key: LEARNING_DELIVERY_ACCOUNT_KEY,
    product_key: LEARNING_DELIVERY_PRODUCT_KEY,
    event_key:
      input.eventKey ??
      stableOt86Key('learning_delivery_business_event', [
        input.eventType,
        input.sourceKey ?? '',
        input.classOccurrenceKey ?? '',
        occurredAt.toISOString(),
      ]),
    event_type: input.eventType,
    source_key: input.sourceKey ?? null,
    class_occurrence_key: input.classOccurrenceKey ?? null,
    occurred_at: occurredAt.toISOString(),
    safe_metadata: sanitized.value,
    raw_url_present: false,
    raw_transcript_present: false,
    student_credential_present: false,
  });
  assertSafeLearningDeliveryBusinessEvent(payload);
  return payload;
}

export async function recordLearningDeliveryBusinessEvent(input: {
  pool: Pick<DbPool, 'query'>;
  payload: LearningDeliveryBusinessEventPayload;
}) {
  assertSafeLearningDeliveryBusinessEvent(input.payload);
  const payloadJson = JSON.stringify(input.payload);
  const result = await input.pool.query(
    `INSERT INTO onetime.learning_delivery_business_events (
        event_key, account_key, product_key, event_type, source_key,
        class_occurrence_key, payload_sha256, safe_payload_json, delivery_state,
        next_attempt_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'ready_for_highlevel', now(), now())
      ON CONFLICT (event_key) DO NOTHING`,
    [
      input.payload.event_key,
      input.payload.account_key,
      input.payload.product_key,
      input.payload.event_type,
      input.payload.source_key,
      input.payload.class_occurrence_key,
      learningDeliverySha256Hex(payloadJson),
      payloadJson,
    ],
  );
  return {
    event_key: input.payload.event_key,
    queued: (result.rowCount ?? 0) > 0,
    duplicate: (result.rowCount ?? 0) < 1,
  };
}

export function assertSafeLearningDeliveryBusinessEvent(
  payload: LearningDeliveryBusinessEventPayload,
) {
  const serialized = JSON.stringify(payload);
  if (RAW_LEAK_PATTERN.test(serialized)) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_UNSAFE_BUSINESS_EVENT',
      'Learning delivery business events cannot contain raw provider URLs, transcripts, or credentials.',
    );
  }
}

function sanitizeUnknown(value: unknown): { value: unknown; count: number } {
  if (Array.isArray(value)) {
    let count = 0;
    const items = value.map((item) => {
      const sanitized = sanitizeUnknown(item);
      count += sanitized.count;
      return sanitized.value;
    });
    return { value: items, count };
  }
  if (value && typeof value === 'object') {
    let count = 0;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (RAW_LEAK_PATTERN.test(key)) {
        output[`redacted_field_${learningDeliverySha256Hex(key).slice(0, 12)}`] = '[redacted]';
        count += 1;
        continue;
      }
      const sanitized = sanitizeUnknown(child);
      output[key] = sanitized.value;
      count += sanitized.count;
    }
    return { value: output, count };
  }
  if (typeof value === 'string' && RAW_LEAK_PATTERN.test(value)) {
    return { value: `[redacted:${learningDeliverySha256Hex(value).slice(0, 12)}]`, count: 1 };
  }
  return { value, count: 0 };
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-z0-9._-]/gi, '_').slice(0, 120) || 'audio.bin';
}

function seconds(ms: number) {
  return (ms / 1000).toFixed(3);
}

function vttTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = String(ms % 1000).padStart(3, '0');
  const secondsPart = String(totalSeconds % 60).padStart(2, '0');
  const minutes = Math.floor(totalSeconds / 60);
  const minutesPart = String(minutes % 60).padStart(2, '0');
  const hoursPart = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hoursPart}:${minutesPart}:${secondsPart}.${milliseconds}`;
}
