import { createHash } from 'node:crypto';
import {
  LEARNING_DELIVERY_ACCOUNT_KEY,
  LEARNING_DELIVERY_PRODUCT_KEY,
  learningDeliveryBusinessEventPayloadSchema,
  learningDeliveryDriveFileMetadataSchema,
  learningDeliveryPreparedDemoProjectionSchema,
  learningDeliveryProbeSummarySchema,
  learningDeliverySilenceRangeSchema,
  learningDeliveryTranscriptArtifactSchema,
  learningDeliveryTranscriptSegmentSchema,
  learningDeliveryTrimDecisionSchema,
  type LearningDeliveryBusinessEventPayload,
  type LearningDeliveryBusinessEventType,
  type LearningDeliveryDriveFileMetadata,
  type LearningDeliveryMediaState,
  type LearningDeliveryPreparedDemoProjection,
  type LearningDeliveryProbeSummary,
  type LearningDeliverySilenceRange,
  type LearningDeliveryTranscriptArtifact,
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

export const LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT = [
  'Vocabulary context for transcription only:',
  'Mishnah; masechta names; Hebrew and Aramaic terms; Rabbi Eli Scheller; One Time terminology.',
  'Transcribe the spoken content faithfully. Do not add interpretation or commentary.',
].join(' ');

const DEFAULT_AUTOMATIC_TRIM_CONFIG = {
  openingWindowMs: 2 * 60_000,
  closingWindowMs: 2 * 60_000,
  startPaddingMs: 8_000,
  endPaddingMs: 12_000,
  minimumSpeechMs: 900,
  minimumEdgeSilenceMs: 2_000,
  silenceMergeGapMs: 750,
  edgeGuardMs: 1_000,
  maxRemovedPercent: 0.25,
  minimumPreparedDurationMs: 20_000,
  minimumTrimMs: 1_000,
  confidenceThreshold: 0.72,
} as const;

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

export function parseLearningDeliverySilencedetectLog(
  raw: string,
  input: { durationMs?: number } = {},
): LearningDeliverySilenceRange[] {
  const ranges: LearningDeliverySilenceRange[] = [];
  let pendingStartMs: number | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const start = line.match(/silence_start:\s*([0-9.]+)/);
    if (start?.[1]) {
      pendingStartMs = secondsToMs(Number(start[1]));
      continue;
    }
    const end = line.match(/silence_end:\s*([0-9.]+)/);
    if (end?.[1] && pendingStartMs !== null) {
      const endMs = secondsToMs(Number(end[1]));
      if (endMs > pendingStartMs) {
        ranges.push(
          learningDeliverySilenceRangeSchema.parse({
            start_ms: pendingStartMs,
            end_ms: endMs,
          }),
        );
      }
      pendingStartMs = null;
    }
  }
  if (pendingStartMs !== null && input.durationMs && input.durationMs > pendingStartMs) {
    ranges.push(
      learningDeliverySilenceRangeSchema.parse({
        start_ms: pendingStartMs,
        end_ms: input.durationMs,
      }),
    );
  }
  return ranges;
}

export function suggestLearningDeliveryAutomaticTrim(input: {
  durationMs: number;
  hasAudio: boolean;
  silenceRanges: Array<{ startMs: number; endMs: number }>;
  transcriptSegments: LearningDeliveryTranscriptSegment[];
  config?: Partial<typeof DEFAULT_AUTOMATIC_TRIM_CONFIG>;
}): LearningDeliveryTrimDecision {
  const config = { ...DEFAULT_AUTOMATIC_TRIM_CONFIG, ...(input.config ?? {}) };
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const reasonCodes: string[] = [];
  if (!Number.isSafeInteger(durationMs) || durationMs < config.minimumPreparedDurationMs) {
    return noAutomaticTrim(
      durationMs,
      'duration_implausible',
      0,
      ['duration_below_minimum'],
      config,
    );
  }
  if (!input.hasAudio) {
    return noAutomaticTrim(durationMs, 'audio_missing', 0, ['audio_missing'], config);
  }

  const speechSegments = input.transcriptSegments
    .filter((segment) => {
      const text = segment.text.replace(/\s+/g, ' ').trim();
      return text.length >= 2 && segment.end_ms - segment.start_ms >= config.minimumSpeechMs;
    })
    .sort((left, right) => left.start_ms - right.start_ms);
  if (speechSegments.length < 1) {
    return noAutomaticTrim(
      durationMs,
      'transcript_segments_missing',
      0.2,
      ['audio_present', 'transcript_segments_missing'],
      config,
    );
  }

  const silenceRanges = normalizeSilenceRanges(
    input.silenceRanges.map((range) => ({
      start_ms: range.startMs,
      end_ms: range.endMs,
    })),
    durationMs,
    config.silenceMergeGapMs,
  );
  const leadingSilence = silenceRanges.find(
    (range) =>
      range.start_ms <= config.edgeGuardMs &&
      range.end_ms <= config.openingWindowMs &&
      range.end_ms - range.start_ms >= config.minimumEdgeSilenceMs,
  );
  const trailingSilence = [...silenceRanges]
    .reverse()
    .find(
      (range) =>
        durationMs - range.end_ms <= config.edgeGuardMs &&
        range.start_ms >= durationMs - config.closingWindowMs &&
        range.end_ms - range.start_ms >= config.minimumEdgeSilenceMs,
    );
  const firstOpeningSpeech = speechSegments.find(
    (segment) => segment.start_ms <= config.openingWindowMs,
  );
  const lastClosingSpeech = [...speechSegments]
    .reverse()
    .find((segment) => segment.end_ms >= durationMs - config.closingWindowMs);

  if (!firstOpeningSpeech && !lastClosingSpeech) {
    return noAutomaticTrim(
      durationMs,
      'edge_speech_not_found',
      0.35,
      ['audio_present', 'transcript_present', 'edge_speech_not_found'],
      config,
    );
  }

  let confidence = 0.3;
  reasonCodes.push('audio_present', 'transcript_present', 'middle_silence_ignored');
  if (firstOpeningSpeech) confidence += 0.14;
  if (lastClosingSpeech) confidence += 0.14;
  if (leadingSilence) {
    confidence += 0.16;
    reasonCodes.push('leading_silence_detected');
  }
  if (trailingSilence) {
    confidence += 0.16;
    reasonCodes.push('trailing_silence_detected');
  }

  const firstSpeechStartMs =
    firstOpeningSpeech && leadingSilence
      ? Math.max(firstOpeningSpeech.start_ms, leadingSilence.end_ms)
      : (firstOpeningSpeech?.start_ms ?? leadingSilence?.end_ms ?? 0);
  const lastSpeechEndMs =
    lastClosingSpeech && trailingSilence
      ? Math.min(lastClosingSpeech.end_ms, trailingSilence.start_ms)
      : (lastClosingSpeech?.end_ms ?? trailingSilence?.start_ms ?? durationMs);
  const startMs = Math.min(durationMs, Math.max(0, firstSpeechStartMs - config.startPaddingMs));
  const endMs = Math.max(startMs, Math.min(durationMs, lastSpeechEndMs + config.endPaddingMs));
  const removedStartMs = startMs >= config.minimumTrimMs ? startMs : 0;
  const removedEndMs = durationMs - endMs >= config.minimumTrimMs ? durationMs - endMs : 0;
  const effectiveStartMs = removedStartMs > 0 ? startMs : 0;
  const effectiveEndMs = removedEndMs > 0 ? endMs : durationMs;
  const removedMs = effectiveStartMs + (durationMs - effectiveEndMs);
  const removedPercent = durationMs > 0 ? removedMs / durationMs : 0;
  const preparedDurationMs = effectiveEndMs - effectiveStartMs;

  if (removedMs < config.minimumTrimMs) {
    return noAutomaticTrim(durationMs, 'no_edge_trim_needed', confidence, reasonCodes, config);
  }
  if (removedPercent > config.maxRemovedPercent) {
    return noAutomaticTrim(
      durationMs,
      'removed_percentage_exceeds_max',
      Math.min(confidence, 0.65),
      [...reasonCodes, 'removed_percentage_exceeds_max'],
      config,
      {
        startMs: effectiveStartMs,
        endMs: effectiveEndMs,
        removedStartMs,
        removedEndMs,
        removedPercent,
      },
    );
  }
  if (preparedDurationMs < config.minimumPreparedDurationMs || effectiveEndMs <= effectiveStartMs) {
    return noAutomaticTrim(
      durationMs,
      'duration_implausible',
      Math.min(confidence, 0.65),
      [...reasonCodes, 'duration_implausible'],
      config,
    );
  }
  if (confidence < config.confidenceThreshold) {
    return noAutomaticTrim(
      durationMs,
      'low_confidence',
      confidence,
      [...reasonCodes, 'low_confidence'],
      config,
    );
  }

  return learningDeliveryTrimDecisionSchema.parse({
    start_ms: effectiveStartMs,
    end_ms: effectiveEndMs,
    reason_code: 'automatic_edge_trim',
    requires_operator_approval: false,
    auto_cut_performed: true,
    confidence: roundConfidence(confidence),
    confidence_reason_codes: reasonCodes,
    safe_exception_code: null,
    removed_start_ms: removedStartMs,
    removed_end_ms: removedEndMs,
    removed_percent: roundPercent(removedPercent),
    opening_window_ms: config.openingWindowMs,
    closing_window_ms: config.closingWindowMs,
  });
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
  if (input.trim?.requires_operator_approval && !input.trim.approvedByActorId) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_TRIM_APPROVAL_REQUIRED',
      'Trim plans must be approved by an operator before render.',
    );
  }
  const args = ['-hide_banner', '-y'];
  const trimDurationMs = input.trim ? input.trim.end_ms - input.trim.start_ms : 0;
  if (input.trim && input.trim.start_ms > 0) {
    args.push('-ss', seconds(input.trim.start_ms));
  }
  if (input.trim && trimDurationMs <= 0) {
    throw new LearningDeliveryError(
      'LEARNING_DELIVERY_INVALID_TRIM_RANGE',
      'Trim end must be after trim start.',
    );
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
  );
  if (input.trim && (input.trim.start_ms > 0 || input.trim.auto_cut_performed)) {
    args.push('-t', seconds(trimDurationMs));
  }
  args.push(input.outputPath);
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

export function projectLearningDeliveryTranscriptForTrim(input: {
  segments: LearningDeliveryTranscriptSegment[];
  trim: Pick<LearningDeliveryTrimDecision, 'start_ms' | 'end_ms'>;
}): LearningDeliveryTranscriptSegment[] {
  const trimStartMs = input.trim.start_ms;
  const trimEndMs = input.trim.end_ms;
  return normalizeLearningDeliveryTranscriptSegments(
    input.segments
      .filter((segment) => segment.end_ms > trimStartMs && segment.start_ms < trimEndMs)
      .map((segment) => ({
        segmentId: segment.segment_id,
        startMs: Math.max(0, segment.start_ms - trimStartMs),
        endMs: Math.max(0, Math.min(segment.end_ms, trimEndMs) - trimStartMs),
        text: segment.text,
      }))
      .filter((segment) => segment.endMs > segment.startMs && segment.text.trim()),
  );
}

export function buildLearningDeliveryTranscriptArtifact(input: {
  sourceSha256: string;
  providerModel: string;
  providerModelVersion?: string | null;
  language?: string | null;
  correctedTranscriptVersion?: string | null;
  durationMs: number;
  segments: LearningDeliveryTranscriptSegment[];
  vocabularyPrompt?: string | null;
}): LearningDeliveryTranscriptArtifact & { webvtt: string } {
  const segments = normalizeLearningDeliveryTranscriptSegments(
    input.segments.map((segment) => ({
      segmentId: segment.segment_id,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      text: segment.text,
    })),
  );
  const canonicalSegments = JSON.stringify(
    segments.map((segment) => ({
      segment_id: segment.segment_id,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      text: segment.text,
    })),
  );
  const webvtt = buildLearningDeliveryWebVtt(segments);
  const artifact = learningDeliveryTranscriptArtifactSchema.parse({
    provider: 'openai',
    provider_model: input.providerModel,
    provider_model_version: input.providerModelVersion ?? input.providerModel,
    source_sha256: input.sourceSha256,
    transcript_sha256: learningDeliverySha256Hex(canonicalSegments),
    webvtt_sha256: learningDeliverySha256Hex(webvtt),
    language: input.language ?? 'und',
    corrected_transcript_version: input.correctedTranscriptVersion ?? 'v1-reviewed-webvtt',
    vocabulary_prompt_sha256: input.vocabularyPrompt
      ? learningDeliverySha256Hex(input.vocabularyPrompt)
      : null,
    segment_count: segments.length,
    duration_ms: input.durationMs,
    segments,
    raw_transcript_present: false,
    approved_torah_interpretation: false,
  });
  return { ...artifact, webvtt };
}

export function buildLearningDeliveryPreparedDemoProjection(input: {
  demoLessonKey: string;
  originalDurationMs: number;
  preparedDurationMs: number;
  trim: LearningDeliveryTrimDecision;
  captionsStatus: 'ready' | 'blocked' | 'not_requested';
  vimeoPrivacy: 'private' | 'unlisted' | 'password' | 'review_required';
  sourceKey: string;
  providerVideoId?: string | null;
  providerTextTrackId?: string | null;
  transcriptSha256?: string | null;
  webvttSha256?: string | null;
}): LearningDeliveryPreparedDemoProjection {
  return learningDeliveryPreparedDemoProjectionSchema.parse({
    demo_lesson_key: input.demoLessonKey,
    account_key: LEARNING_DELIVERY_ACCOUNT_KEY,
    product_key: LEARNING_DELIVERY_PRODUCT_KEY,
    original_duration_ms: input.originalDurationMs,
    prepared_duration_ms: input.preparedDurationMs,
    trim_start_ms: input.trim.start_ms,
    trim_end_ms: input.trim.end_ms,
    trim_confidence: input.trim.confidence ?? 0,
    captions_status: input.captionsStatus,
    vimeo_privacy: input.vimeoPrivacy,
    playback_kind: 'server_authorized_vimeo_playback',
    playback_route: `/api/v1/content/vimeo/${input.sourceKey}/playback`,
    provider_video_id_present: Boolean(input.providerVideoId),
    provider_video_ref_digest: input.providerVideoId
      ? learningDeliverySha256Hex(input.providerVideoId)
      : null,
    provider_text_track_ref_digest: input.providerTextTrackId
      ? learningDeliverySha256Hex(input.providerTextTrackId)
      : null,
    transcript_sha256: input.transcriptSha256 ?? null,
    webvtt_sha256: input.webvttSha256 ?? null,
    raw_provider_url_present: false,
    raw_transcript_present: false,
  });
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
  async function transcribeAudioBufferWithMetadata(request: {
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
      language?: string;
      duration?: number;
      segments?: Array<{ id?: number | string; start?: number; end?: number; text?: string }>;
    };
    const segments = normalizeLearningDeliveryTranscriptSegments(
      (payload.segments ?? [{ start: 0, end: 0, text: payload.text ?? '' }]).map(
        (segment, index) => ({
          segmentId: segment.id ? `seg_${segment.id}` : `seg_${String(index + 1).padStart(4, '0')}`,
          startMs: Math.max(0, Math.round(Number(segment.start ?? 0) * 1000)),
          endMs: Math.max(0, Math.round(Number(segment.end ?? 0) * 1000)),
          text: segment.text ?? '',
        }),
      ),
    );
    return {
      provider: 'openai' as const,
      provider_model: input.model,
      provider_model_version: input.model,
      language: payload.language ?? 'und',
      provider_duration_ms: Number.isFinite(Number(payload.duration))
        ? Math.max(0, Math.round(Number(payload.duration) * 1000))
        : null,
      segments,
    };
  }
  return {
    async transcribeAudioBuffer(request: {
      audio: Buffer | Uint8Array;
      fileName: string;
      mimeType: string;
      prompt?: string;
    }) {
      const result = await transcribeAudioBufferWithMetadata(request);
      return result.segments;
    },
    transcribeAudioBufferWithMetadata,
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

function noAutomaticTrim(
  durationMs: number,
  safeExceptionCode: NonNullable<LearningDeliveryTrimDecision['safe_exception_code']>,
  confidence: number,
  reasonCodes: string[],
  config: typeof DEFAULT_AUTOMATIC_TRIM_CONFIG,
  candidate: {
    startMs: number;
    endMs: number;
    removedStartMs: number;
    removedEndMs: number;
    removedPercent: number;
  } | null = null,
): LearningDeliveryTrimDecision {
  return learningDeliveryTrimDecisionSchema.parse({
    start_ms: candidate?.startMs ?? 0,
    end_ms: candidate?.endMs ?? Math.max(0, durationMs),
    reason_code:
      safeExceptionCode === 'no_edge_trim_needed'
        ? 'no_safe_trim_detected'
        : 'safe_no_trim_exception',
    requires_operator_approval: false,
    auto_cut_performed: false,
    confidence: roundConfidence(confidence),
    confidence_reason_codes: reasonCodes,
    safe_exception_code: safeExceptionCode,
    removed_start_ms: candidate?.removedStartMs ?? 0,
    removed_end_ms: candidate?.removedEndMs ?? 0,
    removed_percent: candidate ? roundPercent(candidate.removedPercent) : 0,
    opening_window_ms: config.openingWindowMs,
    closing_window_ms: config.closingWindowMs,
  });
}

function normalizeSilenceRanges(
  ranges: LearningDeliverySilenceRange[],
  durationMs: number,
  mergeGapMs: number,
) {
  const sorted = ranges
    .map((range) => ({
      start_ms: Math.max(0, Math.min(durationMs, Math.round(range.start_ms))),
      end_ms: Math.max(0, Math.min(durationMs, Math.round(range.end_ms))),
    }))
    .filter((range) => range.end_ms > range.start_ms)
    .sort((left, right) => left.start_ms - right.start_ms);
  const merged: LearningDeliverySilenceRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start_ms - previous.end_ms <= mergeGapMs) {
      previous.end_ms = Math.max(previous.end_ms, range.end_ms);
      continue;
    }
    merged.push(learningDeliverySilenceRangeSchema.parse(range));
  }
  return merged;
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

function secondsToMs(value: number) {
  return Math.max(0, Math.round(value * 1000));
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function roundPercent(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 10_000) / 10_000));
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
