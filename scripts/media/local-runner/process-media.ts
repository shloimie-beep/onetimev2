import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContentSourceRecord } from '../../../packages/contracts/src/content/ingest/index.ts';
import {
  OT_TRANSCRIBE_1_OPERATION,
  type MediaProbeReadback,
} from '../../../packages/contracts/src/content/processing/index.ts';
import {
  buildAudioSegmentPlan,
  buildTranscodePlan,
  processingSha256,
  selectTrim,
  verifyDerivative,
} from '../../../packages/domain/src/content/processing/index.ts';
import {
  LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT,
  buildLearningDeliveryTranscriptArtifact,
  parseLearningDeliverySilencedetectLog,
  projectLearningDeliveryTranscriptForTrim,
  suggestLearningDeliveryAutomaticTrim,
} from '../../../packages/domain/src/content/learning-delivery.ts';
import {
  generateContentFactoryDraftFromTranscript,
  stageLearningDeliveryLocalDrop,
} from '../../../packages/domain/src/index.ts';
import {
  ExecutableFfmpegOpenAiClient,
  NodeBoundedProcessRunner,
} from '../../../apps/worker/src/runners/content-processing/ffmpeg-openai-client.ts';
import type { LearningDeliveryTranscriptSegment } from '../../../packages/contracts/src/content/learning-delivery.ts';
import type { ContentFactoryDraft } from '../../../packages/contracts/src/content/content-factory.ts';
import type { LocalMediaJob, LocalMediaProbe, LocalMediaSettings } from './contracts.ts';
import type { LocalMediaSecretStore } from './secret-store.ts';

export type LocalMediaProcessedArtifact = {
  sourceSha256: string;
  displayName: string;
  mimeType: string;
  byteLength: number;
  preparedPath: string;
  finalSha256: string;
  originalDurationMs: number;
  preparedDurationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  removedStartMs: number;
  removedEndMs: number;
  trimConfidence: number;
  transcriptSegments: LearningDeliveryTranscriptSegment[];
  normalizedTranscript: string;
  transcriptSha256: string;
  webvtt: string;
  webvttSha256: string;
  transcriptionModel: string;
  transcriptionLanguage: string;
  transcriptionMode: 'openai' | 'off';
  draft: ContentFactoryDraft;
};

export async function processLocalMedia(input: {
  job: LocalMediaJob;
  settings: LocalMediaSettings;
  secrets: LocalMediaSecretStore;
  onStage?: (stage: 'processing' | 'transcribing') => void | Promise<void>;
}) {
  if (!input.job.sourceSha256 || !input.job.occurrenceKey) {
    throw new Error('local_media_processing_identity_required');
  }
  const jobDirectory = path.join(input.settings.processingDir, input.job.jobId);
  await mkdir(jobDirectory, { recursive: true });
  const staged = await stageLearningDeliveryLocalDrop({
    sourcePath: input.job.sourcePath,
    privateDirectory: path.join(jobDirectory, 'private-intake'),
  });
  if (staged.sourceSha256 !== input.job.sourceSha256) {
    throw new Error('local_media_source_changed_after_stability');
  }
  const mediaClient = probeClient(input.settings);
  const probe = await mediaClient.probeFile(staged.privatePath);
  assertSupportedProbe(probe);
  const source = localContentSource(input.job, staged, probe);
  const processRunner = new NodeBoundedProcessRunner();
  if (input.settings.transcriptionMode === 'openai') await input.onStage?.('transcribing');
  const transcriptSegments =
    input.settings.transcriptionMode === 'openai'
      ? await transcribeBoundedAudio({
          source,
          sourcePath: staged.privatePath,
          durationMs: probe.durationMs,
          jobDirectory,
          settings: input.settings,
          secrets: input.secrets,
          processRunner,
        })
      : [];
  await input.onStage?.('processing');
  const silence = await detectSilence({
    sourcePath: staged.privatePath,
    ffmpegPath: input.settings.ffmpegPath ?? 'ffmpeg',
    durationMs: probe.durationMs,
    timeoutMs: input.settings.providerTimeoutSeconds * 1_000,
  });
  const automaticTrim =
    input.settings.transcriptionMode === 'openai'
      ? suggestLearningDeliveryAutomaticTrim({
          durationMs: probe.durationMs,
          hasAudio: probe.audioStreamCount > 0,
          silenceRanges: silence.map((range) => ({
            startMs: range.start_ms,
            endMs: range.end_ms,
          })),
          transcriptSegments,
        })
      : null;
  const trimStartMs = automaticTrim?.auto_cut_performed ? automaticTrim.start_ms : 0;
  const trimEndMs = automaticTrim?.auto_cut_performed ? automaticTrim.end_ms : probe.durationMs;
  const trim = selectTrim({
    sourceDurationMs: probe.durationMs,
    startMs: trimStartMs,
    endMs: trimEndMs,
    actor: {
      accountKey: source.accountKey,
      productKey: source.productKey,
      principalId: 'local_windows_media_runner_policy',
      role: 'admin',
    },
    selectedAt: new Date().toISOString(),
  });
  const preparedInProcessing = path.join(jobDirectory, 'prepared-ot-video-1.mp4');
  const plan = buildTranscodePlan({
    source,
    probe,
    trim,
    inputLocator: staged.privatePath,
    outputLocator: preparedInProcessing,
  });
  const render = await processRunner.run({
    executable: input.settings.ffmpegPath ?? 'ffmpeg',
    args: plan.command.args,
    timeoutMs: Math.max(30 * 60_000, input.settings.providerTimeoutSeconds * 1_000),
    shell: false,
  });
  if (render.exitCode !== 0) throw new Error('local_media_ffmpeg_render_failed');
  const derivative = await mediaClient.measureDerivativeFile(
    preparedInProcessing,
    `local_derivative_${input.job.jobId}`,
  );
  verifyDerivative(derivative, { source, plan });
  const readyPath = path.join(input.settings.readyForVimeoDir, `${input.job.jobId}.mp4`);
  await mkdir(input.settings.readyForVimeoDir, { recursive: true });
  await copyFile(preparedInProcessing, readyPath);
  const finalSha256 = await sha256File(readyPath);
  if (finalSha256 !== derivative.sha256)
    throw new Error('local_media_ready_copy_checksum_mismatch');

  let artifact: LocalMediaProcessedArtifact;
  if (input.settings.transcriptionMode === 'openai') {
    const corrected = projectLearningDeliveryTranscriptForTrim({
      segments: transcriptSegments,
      trim: { start_ms: trim.startMs, end_ms: trim.endMs },
    });
    const transcriptArtifact = buildLearningDeliveryTranscriptArtifact({
      sourceSha256: staged.sourceSha256,
      providerModel: OT_TRANSCRIBE_1_OPERATION.model,
      providerModelVersion: OT_TRANSCRIBE_1_OPERATION.model,
      language: 'en',
      correctedTranscriptVersion: 'v1-draft-webvtt',
      durationMs: derivative.durationMs,
      segments: corrected,
      vocabularyPrompt: LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT,
    });
    const normalizedTranscript = corrected
      .map((segment) => segment.text)
      .join(' ')
      .trim();
    artifact = {
      sourceSha256: staged.sourceSha256,
      displayName: staged.displayName,
      mimeType: staged.mimeType,
      byteLength: staged.sizeBytes,
      preparedPath: readyPath,
      finalSha256,
      originalDurationMs: probe.durationMs,
      preparedDurationMs: derivative.durationMs,
      trimStartMs,
      trimEndMs,
      removedStartMs: trimStartMs,
      removedEndMs: probe.durationMs - trimEndMs,
      trimConfidence: automaticTrim?.confidence ?? 0,
      transcriptSegments: corrected,
      normalizedTranscript,
      transcriptSha256: processingSha256(normalizedTranscript),
      webvtt: transcriptArtifact.webvtt,
      webvttSha256: processingSha256(transcriptArtifact.webvtt),
      transcriptionModel: OT_TRANSCRIBE_1_OPERATION.model,
      transcriptionLanguage: 'en',
      transcriptionMode: 'openai',
      draft: generateContentFactoryDraftFromTranscript({
        displayName: staged.displayName,
        segments: corrected,
      }),
    };
  } else {
    artifact = {
      sourceSha256: staged.sourceSha256,
      displayName: staged.displayName,
      mimeType: staged.mimeType,
      byteLength: staged.sizeBytes,
      preparedPath: readyPath,
      finalSha256,
      originalDurationMs: probe.durationMs,
      preparedDurationMs: derivative.durationMs,
      trimStartMs: 0,
      trimEndMs: probe.durationMs,
      removedStartMs: 0,
      removedEndMs: 0,
      trimConfidence: 0,
      transcriptSegments: [],
      normalizedTranscript: '',
      transcriptSha256: processingSha256(''),
      webvtt: '',
      webvttSha256: processingSha256(''),
      transcriptionModel: 'off',
      transcriptionLanguage: 'und',
      transcriptionMode: 'off',
      draft: transcriptionOffDraft(staged.displayName),
    };
  }
  const artifactPath = path.join(jobDirectory, 'processed.private.json');
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  const transcriptPath = path.join(jobDirectory, 'transcript.private.json');
  const webvttPath = path.join(jobDirectory, 'captions.vtt');
  await writeFile(transcriptPath, `${JSON.stringify(artifact.transcriptSegments, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await writeFile(webvttPath, artifact.webvtt, { encoding: 'utf8', mode: 0o600 });
  return {
    artifact,
    artifactPath,
    transcriptPath,
    webvttPath,
    jobDirectory,
    stagedSourcePath: staged.privatePath,
    probe: localProbe(probe),
  };
}

export async function readProcessedArtifact(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as LocalMediaProcessedArtifact;
}

function probeClient(settings: LocalMediaSettings) {
  return new ExecutableFfmpegOpenAiClient(
    {
      ffmpegPath: settings.ffmpegPath ?? 'ffmpeg',
      ffprobePath: settings.ffprobePath ?? 'ffprobe',
      openAiApiKey: 'not-used-by-local-probe',
      openAiProjectId: 'not-used-by-local-probe',
      timeoutMs: Math.max(5 * 60_000, settings.providerTimeoutSeconds * 1_000),
    },
    { read: async () => Promise.reject(new Error('local_media_registry_not_used')) },
    {
      readDerivative: async () => null,
      downloadSource: async () => Promise.reject(new Error('local_media_store_not_used')),
      uploadDerivative: async () => Promise.reject(new Error('local_media_store_not_used')),
    },
  );
}

async function transcribeBoundedAudio(input: {
  source: ContentSourceRecord;
  sourcePath: string;
  durationMs: number;
  jobDirectory: string;
  settings: LocalMediaSettings;
  secrets: LocalMediaSecretStore;
  processRunner: NodeBoundedProcessRunner;
}) {
  const apiKey = await input.secrets.read('openai_api_key');
  const trim = selectTrim({
    sourceDurationMs: input.durationMs,
    startMs: 0,
    endMs: input.durationMs,
    actor: {
      accountKey: input.source.accountKey,
      productKey: input.source.productKey,
      principalId: 'local_windows_media_runner_policy',
      role: 'admin',
    },
    selectedAt: new Date().toISOString(),
  });
  const segments = buildAudioSegmentPlan({ source: input.source, trim });
  const output: LearningDeliveryTranscriptSegment[] = [];
  const directory = path.join(input.jobDirectory, 'transcription');
  await mkdir(directory, { recursive: true });
  for (const [segmentIndex, segment] of segments.entries()) {
    const resultPath = path.join(directory, `${segment.segmentId}.private.json`);
    let payload: OpenAiTranscriptResponse;
    try {
      payload = JSON.parse(await readFile(resultPath, 'utf8')) as OpenAiTranscriptResponse;
    } catch {
      const audioPath = path.join(directory, `${segment.segmentId}.m4a`);
      const extraction = await input.processRunner.run({
        executable: input.settings.ffmpegPath ?? 'ffmpeg',
        args: [
          '-nostdin',
          '-v',
          'error',
          '-ss',
          (segment.startMs / 1_000).toFixed(3),
          '-to',
          (segment.endMs / 1_000).toFixed(3),
          '-i',
          input.sourcePath,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'aac',
          '-b:a',
          '64k',
          '-y',
          audioPath,
        ],
        timeoutMs: Math.max(10 * 60_000, input.settings.providerTimeoutSeconds * 1_000),
        shell: false,
      });
      if (extraction.exitCode !== 0) throw new Error('local_media_audio_extract_failed');
      const audio = await readFile(audioPath);
      if (audio.byteLength < 1 || audio.byteLength > 24 * 1024 * 1024) {
        throw new Error('local_media_audio_segment_size_invalid');
      }
      const form = new FormData();
      form.set('file', new Blob([audio], { type: 'audio/mp4' }), 'segment.m4a');
      form.set('model', OT_TRANSCRIBE_1_OPERATION.model);
      form.set('language', 'en');
      form.set('response_format', 'json');
      form.set('prompt', LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT);
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        input.settings.providerTimeoutSeconds * 1_000,
      );
      try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${apiKey}`,
            ...(input.settings.openAiProjectId
              ? { 'openai-project': input.settings.openAiProjectId }
              : {}),
            ...(input.settings.openAiOrganizationId
              ? { 'openai-organization': input.settings.openAiOrganizationId }
              : {}),
            'idempotency-key': `one-time-local:${segment.segmentId}`,
          },
          body: form,
        });
        if (!response.ok) throw new Error(`local_media_openai_transcription_${response.status}`);
        payload = (await response.json()) as OpenAiTranscriptResponse;
        await writeFile(resultPath, `${JSON.stringify(payload)}\n`, {
          encoding: 'utf8',
          mode: 0o600,
        });
      } finally {
        clearTimeout(timer);
      }
    }
    const providerSegments = payload.segments ?? [
      {
        start: 0,
        end: (segment.endMs - segment.startMs) / 1_000,
        text: payload.text ?? '',
      },
    ];
    for (const [index, providerSegment] of providerSegments.entries()) {
      const text = providerSegment.text.replace(/\s+/gu, ' ').trim();
      if (!text) continue;
      output.push({
        segment_id: `seg_${segmentIndex + 1}_${index + 1}`,
        start_ms: segment.startMs + Math.max(0, Math.round(providerSegment.start * 1_000)),
        end_ms: Math.min(
          segment.endMs,
          segment.startMs + Math.max(1, Math.round(providerSegment.end * 1_000)),
        ),
        text,
      });
    }
  }
  if (output.length < 1) throw new Error('local_media_transcript_empty');
  return output;
}

async function detectSilence(input: {
  sourcePath: string;
  ffmpegPath: string;
  durationMs: number;
  timeoutMs: number;
}) {
  const result = await runCaptured(
    input.ffmpegPath,
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      input.sourcePath,
      '-af',
      'silencedetect=noise=-30dB:d=2',
      '-f',
      'null',
      '-',
    ],
    Math.max(input.timeoutMs, 10 * 60_000),
  );
  if (result.exitCode !== 0) throw new Error('local_media_silence_detection_failed');
  return parseLearningDeliverySilencedetectLog(result.stderr, { durationMs: input.durationMs });
}

function localContentSource(
  job: LocalMediaJob,
  staged: Awaited<ReturnType<typeof stageLearningDeliveryLocalDrop>>,
  probe: MediaProbeReadback,
): ContentSourceRecord {
  const now = new Date().toISOString();
  return {
    accountKey: 'one_time',
    productKey: 'one_time_mishnayos',
    id: job.jobId,
    sourceKind: 'app_upload',
    captureMethod: 'obs',
    runtimeTier: 'production',
    verificationEnvironmentId: 'local_windows_runner',
    bucketRef: 'local_windows_deferred_s3',
    objectKeyDigest: staged.sourceRefDigest,
    objectVersionId: staged.sourceSha256,
    kmsKeyVersionRef: 'local_windows_dpapi',
    checksumReadbackReceiptId: staged.sourceSha256,
    displayFilename: staged.displayName,
    mimeType: mimeType(staged.mimeType),
    container: container(staged.displayName),
    byteCount: staged.sizeBytes,
    sha256: staged.sourceSha256,
    receivedAt: job.createdAt,
    stableAt: job.stableSince,
    occurrenceId: requireOccurrenceKey(job.occurrenceKey),
    matchConfidence: 'exact',
    matchedByAdminId: 'local_windows_occurrence_policy',
    obsProfileVersion: 'OBS-LOCAL-1',
    obsRecordingStartedAt: job.recordedAt,
    obsRecordingStoppedAt: new Date(
      new Date(job.recordedAt).getTime() + probe.durationMs,
    ).toISOString(),
    recordingAdminId: 'local_windows_operator',
    retentionDueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    lifecycleState: 'processing',
    retryState: 'ready',
    attemptCount: job.attemptCount,
    originalPreserved: true,
    version: 1,
    createdAt: job.createdAt,
    updatedAt: now,
  };
}

function requireOccurrenceKey(value: string | null) {
  if (!value) throw new Error('local_media_occurrence_key_required');
  return value;
}

function assertSupportedProbe(probe: MediaProbeReadback) {
  if (
    !probe.readable ||
    probe.decodeFailure ||
    probe.videoStreamCount !== 1 ||
    probe.audioStreamCount < 1 ||
    probe.durationMs < 1 ||
    probe.codedWidth < 1 ||
    probe.codedHeight < 1 ||
    probe.framesPerSecond <= 0
  ) {
    throw new Error('local_media_probe_invalid');
  }
}

function localProbe(probe: MediaProbeReadback): LocalMediaProbe {
  return {
    durationMs: probe.durationMs,
    codedWidth: probe.codedWidth,
    codedHeight: probe.codedHeight,
    framesPerSecond: probe.framesPerSecond,
    rotationDegrees: probe.rotationDegrees,
    videoCodec: probe.videoCodec,
    audioCodec: probe.audioCodec,
    videoStreamCount: probe.videoStreamCount,
    audioStreamCount: probe.audioStreamCount,
  };
}

function transcriptionOffDraft(displayName: string): ContentFactoryDraft {
  const title =
    path.basename(displayName, path.extname(displayName)).slice(0, 160) || 'Class video';
  return {
    title,
    short_description: 'Draft video imported without transcription. Admin review is required.',
    class_label: 'One Time Mishnayos',
    class_date: new Date().toISOString().slice(0, 10),
    topics: [],
    mishnah_terms: [],
    review_questions: [1, 2, 3, 4, 5].map(
      (number) =>
        `Admin review placeholder ${number}: add a source-grounded question after watching.`,
    ),
    key_takeaways: [1, 2, 3].map(
      (number) =>
        `Admin review placeholder ${number}: add a source-grounded takeaway after watching.`,
    ),
    vocabulary: [],
    draft_only: true,
    authoritative_torah_interpretation: false,
  };
}

function mimeType(value: string): 'video/mp4' | 'video/quicktime' | 'video/x-matroska' {
  if (value === 'video/quicktime') return value;
  if (value === 'video/x-matroska') return value;
  return 'video/mp4';
}

function container(displayName: string): 'mp4' | 'mov' | 'mkv' {
  const extension = path.extname(displayName).toLowerCase();
  if (extension === '.mov') return 'mov';
  if (extension === '.mkv') return 'mkv';
  return 'mp4';
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

type OpenAiTranscriptResponse = {
  text?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
};

function runCaptured(executable: string, args: string[], timeoutMs: number) {
  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}
