import { describe, expect, it, vi } from 'vitest';
import {
  LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT,
  assertLearningDeliveryTransition,
  buildLearningDeliveryBusinessEvent,
  buildLearningDeliveryFfmpegRenderPlan,
  buildLearningDeliveryFfprobePlan,
  buildLearningDeliveryPreparedDemoProjection,
  buildLearningDeliveryTranscriptArtifact,
  buildLearningDeliveryWebVtt,
  createLearningDeliveryOpenAiTranscriptionAdapter,
  normalizeLearningDeliveryDriveFile,
  parseLearningDeliveryFfprobeJson,
  parseLearningDeliverySilencedetectLog,
  projectLearningDeliveryTranscriptForTrim,
  recordLearningDeliveryBusinessEvent,
  sanitizeLearningDeliveryMetadata,
  suggestLearningDeliveryAutomaticTrim,
  suggestLearningDeliveryTrim,
} from '../../../packages/domain/src/content/learning-delivery.ts';

describe('learning delivery media workflow', () => {
  it('keeps the media state machine in the approved conductor order', () => {
    expect(() => assertLearningDeliveryTransition('discovered', 'downloading')).not.toThrow();
    expect(() =>
      assertLearningDeliveryTransition('vimeo_processing', 'content_review'),
    ).not.toThrow();
    expect(() => assertLearningDeliveryTransition('discovered', 'published')).toThrow(
      /Cannot transition/,
    );
  });

  it('accepts Drive video metadata without storing raw Drive URLs', () => {
    const accepted = normalizeLearningDeliveryDriveFile({
      providerFileId: 'drive_file_123',
      parentFolderId: 'folder_456',
      displayName: 'One Time class 2026-07-20.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 42_000,
      providerMd5Checksum: 'abc123',
    });
    expect(accepted.accepted).toBe(true);
    if (!accepted.accepted) throw new Error('expected Drive file to be accepted');
    expect(accepted.metadata.raw_url_present).toBe(false);
    expect(accepted.metadata.provider_file_id_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(accepted)).not.toContain('drive_file_123');
  });

  it('rejects unsupported or URL-bearing Drive intake', () => {
    expect(
      normalizeLearningDeliveryDriveFile({
        providerFileId: 'sheet_123',
        displayName: 'notes',
        mimeType: 'application/vnd.google-apps.document',
        sizeBytes: 10,
      }),
    ).toMatchObject({ accepted: false, reason: 'unsupported_mime_type' });
    expect(
      normalizeLearningDeliveryDriveFile({
        providerFileId: 'drive_file_123',
        displayName: 'class.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 10,
        webViewLink: 'https://drive.google.com/file/private',
      }),
    ).toMatchObject({ accepted: false, reason: 'raw_url_rejected' });
  });

  it('builds ffprobe and legacy ffmpeg trim plans that still require operator approval', () => {
    const probe = buildLearningDeliveryFfprobePlan({ inputPath: 'C:/tmp/class.mp4' });
    expect(probe).toMatchObject({ executable: 'ffprobe' });
    expect(probe.args).toContain('-show_streams');

    const summary = parseLearningDeliveryFfprobeJson(
      JSON.stringify({
        format: { duration: '65.25' },
        streams: [
          { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720 },
          { codec_type: 'audio', codec_name: 'aac' },
        ],
      }),
    );
    expect(summary).toMatchObject({ duration_ms: 65_250, width: 1280, audio_codec: 'aac' });

    const trim = suggestLearningDeliveryTrim({
      durationMs: summary.duration_ms,
      silenceRanges: [
        { startMs: 0, endMs: 2_500 },
        { startMs: 63_000, endMs: 65_250 },
      ],
    });
    expect(trim).toMatchObject({
      start_ms: 2500,
      end_ms: 63000,
      requires_operator_approval: true,
      auto_cut_performed: false,
    });
    expect(() =>
      buildLearningDeliveryFfmpegRenderPlan({
        inputPath: 'C:/tmp/class.mp4',
        outputPath: 'C:/tmp/rendered.mp4',
        trim,
      }),
    ).toThrow(/approved/);
    const render = buildLearningDeliveryFfmpegRenderPlan({
      inputPath: 'C:/tmp/class.mp4',
      outputPath: 'C:/tmp/rendered.mp4',
      trim: { ...trim, approvedByActorId: 'operator_1' },
    });
    expect(render.args).toContain('libx264');
  });

  it('automatically trims only opening and closing silence when transcript-aligned confidence passes', () => {
    const silenceLog = [
      '[silencedetect] silence_start: 0',
      '[silencedetect] silence_end: 18.2 | silence_duration: 18.2',
      '[silencedetect] silence_start: 58.0',
      '[silencedetect] silence_end: 66.0 | silence_duration: 8.0',
      '[silencedetect] silence_start: 109.1',
      '[silencedetect] silence_end: 120.0 | silence_duration: 10.9',
    ].join('\n');
    const trim = suggestLearningDeliveryAutomaticTrim({
      durationMs: 120_000,
      hasAudio: true,
      silenceRanges: parseLearningDeliverySilencedetectLog(silenceLog).map((range) => ({
        startMs: range.start_ms,
        endMs: range.end_ms,
      })),
      transcriptSegments: [
        { segment_id: 'seg_open', start_ms: 20_500, end_ms: 24_000, text: 'Opening words' },
        { segment_id: 'seg_middle', start_ms: 72_000, end_ms: 75_000, text: 'Middle words' },
        { segment_id: 'seg_close', start_ms: 100_000, end_ms: 106_500, text: 'Closing words' },
      ],
    });
    expect(trim).toMatchObject({
      start_ms: 12500,
      end_ms: 118500,
      reason_code: 'automatic_edge_trim',
      requires_operator_approval: false,
      auto_cut_performed: true,
      removed_start_ms: 12500,
      removed_end_ms: 1500,
    });
    expect(trim.confidence_reason_codes).toContain('middle_silence_ignored');

    const render = buildLearningDeliveryFfmpegRenderPlan({
      inputPath: 'C:/tmp/class.mp4',
      outputPath: 'C:/tmp/prepared.mp4',
      trim,
    });
    expect(render.args).toEqual(expect.arrayContaining(['-ss', '12.500', '-t', '106.000']));
  });

  it('uses safe no-trim exceptions when automatic trim would remove too much media', () => {
    const trim = suggestLearningDeliveryAutomaticTrim({
      durationMs: 120_000,
      hasAudio: true,
      silenceRanges: [
        { startMs: 0, endMs: 83_000 },
        { startMs: 112_000, endMs: 120_000 },
      ],
      transcriptSegments: [
        { segment_id: 'seg_late', start_ms: 86_000, end_ms: 98_000, text: 'Late words' },
      ],
    });
    expect(trim).toMatchObject({
      auto_cut_performed: false,
      requires_operator_approval: false,
      safe_exception_code: 'removed_percentage_exceeds_max',
    });
  });

  it('normalizes transcript segments and renders WebVTT', () => {
    const segments = [
      { segment_id: 'seg_0001', start_ms: 0, end_ms: 1250, text: 'Opening line' },
      { segment_id: 'seg_0002', start_ms: 10_000, end_ms: 12_000, text: 'Closing line' },
    ];
    const vtt = buildLearningDeliveryWebVtt(segments);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:00.000 --> 00:00:01.250');

    const projected = projectLearningDeliveryTranscriptForTrim({
      segments,
      trim: { start_ms: 8_000, end_ms: 15_000 },
    });
    expect(projected).toEqual([
      { segment_id: 'seg_0002', start_ms: 2_000, end_ms: 4_000, text: 'Closing line' },
    ]);

    const artifact = buildLearningDeliveryTranscriptArtifact({
      sourceSha256: 'a'.repeat(64),
      providerModel: 'gpt-4o-mini-transcribe',
      language: 'en',
      durationMs: 4_000,
      segments: projected,
      vocabularyPrompt: LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT,
    });
    expect(artifact).toMatchObject({
      provider: 'openai',
      provider_model_version: 'gpt-4o-mini-transcribe',
      raw_transcript_present: false,
      approved_torah_interpretation: false,
      segment_count: 1,
    });
    expect(artifact.transcript_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.webvtt_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('redacts unsafe metadata before building HighLevel-safe business events', () => {
    const sanitized = sanitizeLearningDeliveryMetadata({
      title: 'Class recording ready',
      playback_url: 'https://vimeo.com/private/video',
      nested: { join_url: 'https://zoom.us/j/secret' },
    });
    expect(sanitized.count).toBeGreaterThanOrEqual(2);

    const event = buildLearningDeliveryBusinessEvent({
      eventType: 'recording.available',
      sourceKey: 'source_abc',
      safeMetadata: sanitized.value as Record<string, unknown>,
      occurredAt: new Date('2026-07-20T12:00:00.000Z'),
    });
    expect(event.event_type).toBe('recording.available');
    expect(event.raw_url_present).toBe(false);
    expect(JSON.stringify(event)).not.toMatch(/https?:\/\/|vimeo|zoom/i);
  });

  it('queues HighLevel-safe business events without raw payload material', async () => {
    const event = buildLearningDeliveryBusinessEvent({
      eventType: 'class.reminder.requested',
      classOccurrenceKey: 'occurrence_2026_07_20',
      safeMetadata: { reminder_channel: 'portal' },
      occurredAt: new Date('2026-07-20T12:00:00.000Z'),
    });
    const calls: unknown[][] = [];
    const query = vi.fn(async (_sql: string, params: unknown[]) => {
      calls.push(params);
      return { rowCount: 1, rows: [] };
    });
    const result = await recordLearningDeliveryBusinessEvent({
      pool: { query } as unknown as Parameters<
        typeof recordLearningDeliveryBusinessEvent
      >[0]['pool'],
      payload: event,
    });
    const params = calls[0] ?? [];

    expect(result).toMatchObject({ queued: true, duplicate: false });
    expect(params[6]).toMatch(/^[a-f0-9]{64}$/);
    expect(String(params[7])).not.toMatch(/https?:\/\/|join_url|passcode|raw_transcript_text/i);
  });

  it('uses the OpenAI transcription endpoint without leaking the key into outputs', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({ authorization: 'Bearer sk-test-secret' });
      return new Response(
        JSON.stringify({
          text: 'hello',
          segments: [{ id: 1, start: 0, end: 1.5, text: 'hello world' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const adapter = createLearningDeliveryOpenAiTranscriptionAdapter({
      apiKey: 'sk-test-secret',
      model: 'test-transcribe-model',
      fetchImpl,
    });
    const metadata = await adapter.transcribeAudioBufferWithMetadata({
      audio: Buffer.from('not-real-audio'),
      fileName: 'class audio.wav',
      mimeType: 'audio/wav',
    });
    expect(metadata).toMatchObject({
      provider: 'openai',
      provider_model: 'test-transcribe-model',
      language: 'und',
    });
    const segments = metadata.segments;
    expect(segments).toEqual([
      { segment_id: 'seg_1', start_ms: 0, end_ms: 1500, text: 'hello world' },
    ]);
    expect(JSON.stringify(segments)).not.toContain('sk-test-secret');
  });

  it('builds a safe protected demo projection with no raw provider URL or transcript', () => {
    const projection = buildLearningDeliveryPreparedDemoProjection({
      demoLessonKey: 'demo_autotrim_001',
      originalDurationMs: 120_000,
      preparedDurationMs: 106_000,
      trim: {
        start_ms: 12_500,
        end_ms: 118_500,
        reason_code: 'automatic_edge_trim',
        requires_operator_approval: false,
        auto_cut_performed: true,
        confidence: 0.9,
      },
      captionsStatus: 'ready',
      vimeoPrivacy: 'private',
      sourceKey: 'source_demo_safe_001',
      providerVideoId: 'video_private_001',
      providerTextTrackId: 'track_private_001',
      transcriptSha256: 'b'.repeat(64),
      webvttSha256: 'c'.repeat(64),
    });
    expect(projection).toMatchObject({
      playback_kind: 'server_authorized_vimeo_playback',
      provider_video_id_present: true,
      raw_provider_url_present: false,
      raw_transcript_present: false,
    });
    expect(JSON.stringify(projection)).not.toMatch(/https?:\/\//i);
  });
});
