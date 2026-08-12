import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, open, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  OT_LEARNING_DRAFT_1_OPERATION,
  OT_TRANSCRIBE_1_OPERATION,
  OT_VIDEO_1_PROFILE,
  type AudioSegmentPlan,
  type ContentProcessingSource,
  type DerivativeReadback,
  type LearningDraft,
  type MediaProbeReadback,
} from '../../../../../packages/contracts/src/content/processing/index.ts';
import { registeredLearningSchemaDigest } from '../../../../../packages/domain/src/content/processing/index.ts';
import type { LearningProviderReadback, TranscriptProviderReadback } from './runner.ts';
import {
  OPENAI_CONTENT_PROCESSING_REGISTRY_KEY,
  type ContentProcessingProviderIdentityReadback,
  type FfmpegOpenAiClient,
} from './ffmpeg-openai-adapter.ts';

export interface ContentProcessingRegistryGuard {
  read(): Promise<{ providerAccountRefHash: string; observedAt: string }>;
}

export interface ContentProcessingMediaStore {
  readDerivative(operationId: string): Promise<DerivativeReadback | null>;
  downloadSource(source: ContentProcessingSource, destinationPath: string): Promise<void>;
  uploadDerivative(input: {
    operationId: string;
    source: ContentProcessingSource;
    filePath: string;
    readback: DerivativeReadback;
  }): Promise<DerivativeReadback>;
}

export interface BoundedProcessRunner {
  run(input: {
    executable: string;
    args: readonly string[];
    timeoutMs: number;
    shell: false;
  }): Promise<{ exitCode: number; stdout: string }>;
}

export class ExecutableFfmpegOpenAiClient implements FfmpegOpenAiClient {
  constructor(
    private readonly config: {
      ffmpegPath: string;
      ffprobePath: string;
      openAiApiKey: string;
      openAiProjectId: string;
      openAiOrganizationId?: string | undefined;
      timeoutMs: number;
      tempRoot?: string | undefined;
      openAiBaseUrl?: string | undefined;
    },
    private readonly registry: ContentProcessingRegistryGuard,
    private readonly store: ContentProcessingMediaStore,
    private readonly processRunner: BoundedProcessRunner = new NodeBoundedProcessRunner(),
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async readIdentity(): Promise<ContentProcessingProviderIdentityReadback> {
    const registry = await this.registry.read();
    const [ffmpegBinarySha256, ffprobeBinarySha256, transcriptionModel, draftModel] =
      await Promise.all([
        fileSha256(this.config.ffmpegPath),
        fileSha256(this.config.ffprobePath),
        this.readModel(OT_TRANSCRIBE_1_OPERATION.model),
        this.readModel(OT_LEARNING_DRAFT_1_OPERATION.model),
      ]);
    const projectRefHash = digest(this.config.openAiProjectId);
    if (registry.providerAccountRefHash !== projectRefHash) {
      throw new Error('content_processing_identity_readback_mismatch');
    }
    return {
      registryBindingKey: OPENAI_CONTENT_PROCESSING_REGISTRY_KEY,
      providerAccountRefHash: projectRefHash,
      projectRefHash,
      credentialFingerprintHash: digest(this.config.openAiApiKey),
      transcriptionModel,
      draftModel,
      ffmpegBinarySha256,
      ffprobeBinarySha256,
      observedAt: this.clock().toISOString(),
    };
  }

  async reconcileOrTranscode(
    input: Parameters<FfmpegOpenAiClient['reconcileOrTranscode']>[0],
  ): Promise<DerivativeReadback> {
    await this.readIdentity();
    const existing = await this.store.readDerivative(input.operationId);
    if (existing) return existing;
    return this.withTempDirectory(input.operationId, async (directory) => {
      const sourcePath = path.join(directory, 'source');
      const outputPath = path.join(directory, 'derivative.mp4');
      await this.store.downloadSource(input.source, sourcePath);
      if (input.plan.command.executable !== 'ffmpeg' || input.plan.command.shell !== false) {
        throw new Error('content_processing_process_contract_invalid');
      }
      const args = [...input.plan.command.args];
      const inputFlagIndex = args.indexOf('-i');
      if (inputFlagIndex < 0 || inputFlagIndex + 1 >= args.length || args.at(-1) === undefined) {
        throw new Error('content_processing_process_contract_invalid');
      }
      args[inputFlagIndex + 1] = sourcePath;
      args[args.length - 1] = outputPath;
      const result = await this.processRunner.run({
        executable: this.config.ffmpegPath,
        args,
        timeoutMs: this.config.timeoutMs,
        shell: false,
      });
      if (result.exitCode !== 0) throw new Error('content_processing_ffmpeg_failed');
      const outputSha256 = await fileSha256(outputPath);
      const readback = await this.measureDerivativeFile(
        outputPath,
        `derivative_${digest(`${input.operationId}\0${outputSha256}`).slice(0, 32)}`,
      );
      return this.store.uploadDerivative({
        operationId: input.operationId,
        source: input.source,
        filePath: outputPath,
        readback,
      });
    });
  }

  async reconcileOrTranscribe(
    input: Parameters<FfmpegOpenAiClient['reconcileOrTranscribe']>[0],
  ): Promise<TranscriptProviderReadback> {
    await this.readIdentity();
    return this.withTempDirectory(input.operationId, async (directory) => {
      const sourcePath = path.join(directory, 'source');
      await this.store.downloadSource(input.source, sourcePath);
      const segments = [];
      const providerResults: string[] = [];
      for (const segment of input.segments) {
        const audioPath = path.join(directory, `${safeSegmentId(segment)}.m4a`);
        await this.extractAudioSegment(sourcePath, audioPath, segment);
        const response = await this.transcribeSegment(input.operationId, segment, audioPath);
        const resultDigest = digest(JSON.stringify(response));
        providerResults.push(resultDigest);
        const providerSegments = response.segments ?? [
          {
            start: 0,
            end: (segment.endMs - segment.startMs) / 1_000,
            text: response.text ?? '',
          },
        ];
        for (const [index, providerSegment] of providerSegments.entries()) {
          segments.push({
            segmentId: `${segment.segmentId}_${index + 1}`,
            startMs: segment.startMs + Math.round(providerSegment.start * 1_000),
            endMs: segment.startMs + Math.round(providerSegment.end * 1_000),
            text: providerSegment.text.trim(),
            providerResultDigest: resultDigest,
          });
        }
      }
      const providerRequestDigest = digest(
        JSON.stringify({ operation: input.operation, segments: input.segments }),
      );
      return {
        providerProjectIdDigest: digest(this.config.openAiProjectId),
        providerRequestDigest,
        providerResultDigest: digest(providerResults.join('\0')),
        segments,
        refusal: false,
        truncated: false,
        uncertain: false,
      };
    });
  }

  async reconcileOrGenerateDrafts(
    input: Parameters<FfmpegOpenAiClient['reconcileOrGenerateDrafts']>[0],
  ): Promise<LearningProviderReadback> {
    await this.readIdentity();
    const request = {
      model: input.operation.model,
      input: [
        {
          role: 'system',
          content:
            'Create faithful English learning materials from the supplied transcript. Do not add unsupported facts.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            sourceId: input.sourceId,
            sourceSha256: input.sourceSha256,
            transcriptDigest: input.transcriptDigest,
            transcript: input.transcriptText,
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'one_time_learning_draft',
          strict: true,
          schema: input.schema,
        },
      },
      tools: [],
      store: false,
    };
    const response = await this.openAiRequest<OpenAiResponse>('/v1/responses', {
      method: 'POST',
      idempotencyKey: input.operationId,
      body: request,
    });
    const refusal = response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === 'refusal');
    if (
      response.status !== 'completed' ||
      (response.incomplete_details !== undefined && response.incomplete_details !== null) ||
      refusal !== undefined
    ) {
      throw new Error('content_processing_openai_response_uncertain');
    }
    const outputText =
      response.output_text ??
      response.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text')?.text;
    if (!outputText) throw new Error('content_processing_openai_output_missing');
    const output = JSON.parse(outputText) as LearningDraft;
    return {
      providerProjectIdDigest: digest(this.config.openAiProjectId),
      providerRequestDigest: digest(JSON.stringify(request)),
      providerResultDigest: digest(JSON.stringify(response)),
      schemaDigest: registeredLearningSchemaDigest(),
      sourceId: input.sourceId,
      sourceSha256: input.sourceSha256,
      transcriptDigest: input.transcriptDigest,
      output,
      refusal: false,
      truncated: false,
      schemaValid: true,
      unexpectedFields: false,
      uncertain: false,
    };
  }

  async probeFile(filePath: string): Promise<MediaProbeReadback> {
    const probe = mediaProbe(await this.probeJson(filePath));
    if (!(await this.decodeToNull(filePath))) {
      throw new Error('content_processing_source_decode_failed');
    }
    return probe;
  }

  private async probeJson(filePath: string): Promise<ProbeJson> {
    const result = await this.processRunner.run({
      executable: this.config.ffprobePath,
      args: ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath],
      timeoutMs: this.config.timeoutMs,
      shell: false,
    });
    if (result.exitCode !== 0) throw new Error('content_processing_ffprobe_failed');
    return JSON.parse(result.stdout) as ProbeJson;
  }

  private async inspectDerivative(filePath: string) {
    const raw = await this.probeJson(filePath);
    const probe = mediaProbe(raw);
    const video = raw.streams?.find((stream) => stream.codec_type === 'video');
    const audio = raw.streams?.find((stream) => stream.codec_type === 'audio');
    const audioBitrateBps = Number(audio?.bit_rate);
    // FFmpeg's AAC encoder targets 128 kbps, while ffprobe reports the measured stream
    // average. Short clips in particular do not read back as the literal target value.
    const audioBitrateMatchesTarget =
      Number.isFinite(audioBitrateBps) && Math.abs(audioBitrateBps - 128_000) <= 16_000;
    const fastStart = await mp4MoovPrecedesMdat(filePath);
    const sourceMetadataRemoved = hasOnlyTechnicalMetadata(raw);
    const decodable = await this.decodeToNull(filePath);
    if (
      !decodable ||
      !raw.format?.format_name?.split(',').includes('mp4') ||
      video?.codec_name !== 'h264' ||
      video.pix_fmt !== 'yuv420p' ||
      audio?.codec_name !== 'aac' ||
      audio.profile !== 'LC' ||
      Number(audio.sample_rate) !== 48_000 ||
      audio.channels !== 2 ||
      !audioBitrateMatchesTarget ||
      !fastStart ||
      !sourceMetadataRemoved
    ) {
      throw new Error('content_processing_derivative_proof_mismatch');
    }
    return {
      probe,
      videoCodec: video.codec_name,
      pixelFormat: video.pix_fmt,
      audioCodec: audio.codec_name,
      audioProfile: audio.profile,
      audioSampleRateHz: 48_000,
      audioChannels: 2,
      audioBitrateBps: 128_000,
      fastStart,
      sourceMetadataRemoved,
    } as const;
  }

  private async decodeToNull(filePath: string) {
    const decode = await this.processRunner.run({
      executable: this.config.ffmpegPath,
      args: [
        '-nostdin',
        '-v',
        'error',
        '-xerror',
        '-i',
        filePath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-f',
        'null',
        '-',
      ],
      timeoutMs: this.config.timeoutMs,
      shell: false,
    });
    return decode.exitCode === 0;
  }

  async probeSource(source: ContentProcessingSource): Promise<MediaProbeReadback> {
    await this.readIdentity();
    return this.withTempDirectory(
      `probe:${source.id}:${source.objectVersionId}`,
      async (directory) => {
        const sourcePath = path.join(directory, 'source');
        await this.store.downloadSource(source, sourcePath);
        return this.probeFile(sourcePath);
      },
    );
  }

  async measureDerivativeFile(
    filePath: string,
    objectVersionId: string,
  ): Promise<DerivativeReadback> {
    if (!objectVersionId.trim()) {
      throw new Error('content_processing_derivative_version_missing');
    }
    const inspection = await this.inspectDerivative(filePath);
    const file = await stat(filePath);
    return {
      profileVersion: OT_VIDEO_1_PROFILE.version,
      objectVersionId,
      byteCount: file.size,
      sha256: await fileSha256(filePath),
      container: 'mp4',
      durationMs: inspection.probe.durationMs,
      width: inspection.probe.codedWidth,
      height: inspection.probe.codedHeight,
      framesPerSecond: inspection.probe.framesPerSecond,
      videoCodec: inspection.videoCodec,
      pixelFormat: inspection.pixelFormat,
      audioCodec: inspection.audioCodec,
      audioProfile: inspection.audioProfile,
      audioSampleRateHz: inspection.audioSampleRateHz,
      audioChannels: inspection.audioChannels,
      audioBitrateBps: inspection.audioBitrateBps,
      fastStart: inspection.fastStart,
      decodeFailure: false,
      sourceMetadataRemoved: inspection.sourceMetadataRemoved,
    };
  }

  private async extractAudioSegment(
    sourcePath: string,
    audioPath: string,
    segment: AudioSegmentPlan,
  ) {
    const result = await this.processRunner.run({
      executable: this.config.ffmpegPath,
      args: [
        '-nostdin',
        '-v',
        'error',
        '-ss',
        (segment.startMs / 1_000).toFixed(3),
        '-to',
        (segment.endMs / 1_000).toFixed(3),
        '-i',
        sourcePath,
        '-vn',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        audioPath,
      ],
      timeoutMs: this.config.timeoutMs,
      shell: false,
    });
    if (result.exitCode !== 0) throw new Error('content_processing_audio_extract_failed');
  }

  private async transcribeSegment(
    operationId: string,
    segment: AudioSegmentPlan,
    audioPath: string,
  ) {
    const bytes = await readFile(audioPath);
    const form = new FormData();
    form.set('file', new Blob([bytes], { type: 'audio/mp4' }), 'segment.m4a');
    form.set('model', OT_TRANSCRIBE_1_OPERATION.model);
    form.set('language', OT_TRANSCRIBE_1_OPERATION.language);
    form.set('response_format', 'verbose_json');
    return this.openAiRequest<OpenAiTranscription>('/v1/audio/transcriptions', {
      method: 'POST',
      idempotencyKey: `${operationId}:${segment.segmentId}`,
      body: form,
    });
  }

  private async readModel(model: string) {
    const response = await this.openAiRequest<{ id?: string }>(
      `/v1/models/${encodeURIComponent(model)}`,
      { method: 'GET' },
    );
    if (response.id !== model) throw new Error('content_processing_openai_model_mismatch');
    return model;
  }

  private async openAiRequest<T>(
    endpoint: string,
    input: {
      method: 'GET' | 'POST';
      idempotencyKey?: string | undefined;
      body?: FormData | unknown;
    },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const requestBody: BodyInit | undefined =
      input.body === undefined
        ? undefined
        : input.body instanceof FormData
          ? input.body
          : JSON.stringify(input.body);
    const isForm = input.body instanceof FormData;
    try {
      const response = await this.fetchImpl(
        new URL(endpoint, this.config.openAiBaseUrl ?? 'https://api.openai.com').toString(),
        {
          method: input.method,
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${this.config.openAiApiKey}`,
            'openai-project': this.config.openAiProjectId,
            ...(this.config.openAiOrganizationId
              ? { 'openai-organization': this.config.openAiOrganizationId }
              : {}),
            ...(input.idempotencyKey ? { 'idempotency-key': input.idempotencyKey } : {}),
            ...(input.body === undefined || isForm ? {} : { 'content-type': 'application/json' }),
          },
          ...(requestBody === undefined ? {} : { body: requestBody }),
        },
      );
      if (!response.ok) throw new Error('content_processing_openai_request_failed');
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async withTempDirectory<T>(operationId: string, run: (directory: string) => Promise<T>) {
    const directory = await mkdtemp(
      path.join(
        this.config.tempRoot ?? tmpdir(),
        `one-time-media-${digest(operationId).slice(0, 12)}-`,
      ),
    );
    try {
      return await run(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

export class NodeBoundedProcessRunner implements BoundedProcessRunner {
  run(input: {
    executable: string;
    args: readonly string[];
    timeoutMs: number;
    shell: false;
  }): Promise<{ exitCode: number; stdout: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(input.executable, [...input.args], {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [];
      let outputBytes = 0;
      child.stdout.on('data', (chunk: Buffer) => {
        outputBytes += chunk.byteLength;
        if (outputBytes > 4 * 1024 * 1024) child.kill();
        else stdout.push(chunk);
      });
      child.stderr.resume();
      const timer = setTimeout(() => child.kill(), input.timeoutMs);
      child.once('error', reject);
      child.once('close', (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? -1, stdout: Buffer.concat(stdout).toString('utf8') });
      });
    });
  }
}

type OpenAiTranscription = {
  text?: string;
  segments?: readonly { start: number; end: number; text: string }[];
};

type OpenAiResponse = {
  status?: string;
  incomplete_details?: unknown;
  output_text?: string;
  output?: readonly {
    content?: readonly { type?: string; text?: string; refusal?: string }[];
  }[];
};

type ProbeJson = {
  format?: { format_name?: string; duration?: string; tags?: Record<string, string> };
  streams?: readonly {
    codec_type?: string;
    codec_name?: string;
    profile?: string;
    pix_fmt?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    sample_rate?: string;
    channels?: number;
    bit_rate?: string;
    tags?: { rotate?: string };
    side_data_list?: readonly { rotation?: number }[];
  }[];
};

function mediaProbe(input: ProbeJson): MediaProbeReadback {
  const streams = input.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const durationMs = Math.round(Number(input.format?.duration) * 1_000);
  const rotation = Number(video?.side_data_list?.[0]?.rotation ?? video?.tags?.rotate ?? 0);
  const normalizedRotation = (((rotation % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  if (
    !video ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    ![0, 90, 180, 270].includes(normalizedRotation)
  ) {
    throw new Error('content_processing_ffprobe_readback_invalid');
  }
  return {
    probeVersion: 'OT-FFPROBE-1',
    readable: true,
    decodeFailure: false,
    container: input.format?.format_name?.split(',')[0] ?? '',
    durationMs,
    codedWidth: video.width ?? 0,
    codedHeight: video.height ?? 0,
    framesPerSecond: frameRate(video.r_frame_rate),
    rotationDegrees: normalizedRotation,
    videoCodec: video.codec_name ?? null,
    pixelFormat: video.pix_fmt ?? null,
    audioCodec: audio?.codec_name ?? null,
    audioProfile: audio?.profile ?? null,
    audioSampleRateHz: audio?.sample_rate ? Number(audio.sample_rate) : null,
    audioChannels: audio?.channels ?? null,
    videoStreamCount: streams.filter((stream) => stream.codec_type === 'video').length,
    audioStreamCount: streams.filter((stream) => stream.codec_type === 'audio').length,
  };
}

function frameRate(value: string | undefined) {
  const [numerator, denominator] = (value ?? '0/1').split('/').map(Number);
  const result = numerator! / denominator!;
  return Number.isFinite(result) ? result : 0;
}

function safeSegmentId(segment: AudioSegmentPlan) {
  return digest(segment.segmentId).slice(0, 24);
}

async function mp4MoovPrecedesMdat(filePath: string) {
  const handle = await open(filePath, 'r');
  try {
    const size = (await handle.stat()).size;
    let offset = 0;
    let sawMoov = false;
    for (let boxes = 0; boxes < 128 && offset + 8 <= size; boxes += 1) {
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) return false;
      const size32 = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      const headerBytes = size32 === 1 ? 16 : 8;
      const boxSize =
        size32 === 0
          ? size - offset
          : size32 === 1 && bytesRead >= 16
            ? Number(header.readBigUInt64BE(8))
            : size32;
      if (!Number.isSafeInteger(boxSize) || boxSize < headerBytes || offset + boxSize > size) {
        return false;
      }
      if (type === 'moov') sawMoov = true;
      if (type === 'mdat') return sawMoov;
      offset += boxSize;
    }
    return false;
  } finally {
    await handle.close();
  }
}

function hasOnlyTechnicalMetadata(input: ProbeJson) {
  const allowed = new Set([
    'encoder',
    'major_brand',
    'minor_version',
    'compatible_brands',
    'handler_name',
    'vendor_id',
    'language',
    'rotate',
  ]);
  const tagSets = [input.format?.tags, ...(input.streams ?? []).map((stream) => stream.tags)];
  return tagSets.every((tags) =>
    Object.entries(tags ?? {}).every(
      ([key, value]) =>
        allowed.has(key.toLowerCase()) && (key.toLowerCase() !== 'rotate' || value === '0'),
    ),
  );
}

async function fileSha256(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
