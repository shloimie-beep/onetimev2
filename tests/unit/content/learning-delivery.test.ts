import { describe, expect, it, vi } from 'vitest';
import {
  assertLearningDeliveryTransition,
  buildLearningDeliveryBusinessEvent,
  buildLearningDeliveryFfmpegRenderPlan,
  buildLearningDeliveryFfprobePlan,
  buildLearningDeliveryWebVtt,
  createLearningDeliveryOpenAiTranscriptionAdapter,
  normalizeLearningDeliveryDriveFile,
  parseLearningDeliveryFfprobeJson,
  recordLearningDeliveryBusinessEvent,
  sanitizeLearningDeliveryMetadata,
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

  it('builds ffprobe and ffmpeg as argv plans and requires operator trim approval', () => {
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

  it('normalizes transcript segments and renders WebVTT', () => {
    const vtt = buildLearningDeliveryWebVtt([
      { segment_id: 'seg_0001', start_ms: 0, end_ms: 1250, text: 'Opening line' },
    ]);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:00.000 --> 00:00:01.250');
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
    const segments = await adapter.transcribeAudioBuffer({
      audio: Buffer.from('not-real-audio'),
      fileName: 'class audio.wav',
      mimeType: 'audio/wav',
    });
    expect(segments).toEqual([
      { segment_id: 'seg_1', start_ms: 0, end_ms: 1500, text: 'hello world' },
    ]);
    expect(JSON.stringify(segments)).not.toContain('sk-test-secret');
  });
});
