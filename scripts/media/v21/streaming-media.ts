import { createHash } from 'node:crypto';

import {
  CONTENT_PROCESSING_MAX_BYTES,
  CONTENT_PROCESSING_STREAM_CHUNK_BYTES,
  type ExecutablePlan,
  type MediaProbeReadback,
} from '../../../packages/contracts/src/content/processing/index.ts';

export type BoundedStreamDigest = {
  byteCount: number;
  sha256: string;
  largestChunkBytes: number;
  wholeFileBuffered: false;
};

export async function digestBoundedMediaStream(
  chunks: AsyncIterable<Uint8Array>,
): Promise<BoundedStreamDigest> {
  const hash = createHash('sha256');
  let byteCount = 0;
  let largestChunkBytes = 0;
  for await (const chunk of chunks) {
    if (chunk.byteLength < 1 || chunk.byteLength > CONTENT_PROCESSING_STREAM_CHUNK_BYTES) {
      throw new Error('content_processing_stream_chunk_out_of_bounds');
    }
    byteCount += chunk.byteLength;
    if (byteCount > CONTENT_PROCESSING_MAX_BYTES) {
      throw new Error('content_processing_stream_too_large');
    }
    largestChunkBytes = Math.max(largestChunkBytes, chunk.byteLength);
    hash.update(chunk);
  }
  if (byteCount < 1) throw new Error('content_processing_stream_empty');
  return {
    byteCount,
    sha256: hash.digest('hex'),
    largestChunkBytes,
    wholeFileBuffered: false,
  };
}

export function buildFfprobeReadbackPlan(inputLocator: string): ExecutablePlan {
  assertOpaqueLocator(inputLocator);
  return {
    executable: 'ffprobe',
    shell: false,
    args: [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      '-show_entries',
      'format=duration,format_name:stream=index,codec_type,codec_name,profile,pix_fmt,width,height,avg_frame_rate,sample_rate,channels:stream_tags=rotate',
      inputLocator,
    ],
  };
}

export function parseFfprobeReadbackJson(raw: string): MediaProbeReadback {
  if (Buffer.byteLength(raw, 'utf8') > 1024 * 1024) {
    throw new Error('content_processing_probe_too_large');
  }
  const parsed = JSON.parse(raw) as {
    format?: { duration?: string; format_name?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      profile?: string;
      pix_fmt?: string;
      width?: number;
      height?: number;
      avg_frame_rate?: string;
      sample_rate?: string;
      channels?: number;
      tags?: { rotate?: string };
      side_data_list?: Array<{ rotation?: number }>;
    }>;
  };
  const videoStreams = (parsed.streams ?? []).filter((stream) => stream.codec_type === 'video');
  const audioStreams = (parsed.streams ?? []).filter((stream) => stream.codec_type === 'audio');
  const video = videoStreams[0];
  const audio = audioStreams[0];
  const rotation = normalizeRotation(
    Number(video?.side_data_list?.[0]?.rotation ?? video?.tags?.rotate ?? 0),
  );
  const result: MediaProbeReadback = {
    probeVersion: 'OT-FFPROBE-1',
    readable: true,
    decodeFailure: false,
    container: parsed.format?.format_name ?? '',
    durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    codedWidth: video?.width ?? 0,
    codedHeight: video?.height ?? 0,
    framesPerSecond: parseFrameRate(video?.avg_frame_rate),
    rotationDegrees: rotation,
    videoCodec: video?.codec_name ?? null,
    pixelFormat: video?.pix_fmt ?? null,
    audioCodec: audio?.codec_name ?? null,
    audioProfile: audio?.profile ?? null,
    audioSampleRateHz: audio?.sample_rate ? Number(audio.sample_rate) : null,
    audioChannels: audio?.channels ?? null,
    videoStreamCount: videoStreams.length,
    audioStreamCount: audioStreams.length,
  };
  if (
    !result.container ||
    result.durationMs < 1 ||
    result.codedWidth < 1 ||
    result.codedHeight < 1 ||
    result.framesPerSecond <= 0
  ) {
    throw new Error('content_processing_invalid_probe');
  }
  return result;
}

function assertOpaqueLocator(locator: string) {
  if (!locator.trim() || /(?:https?:\/\/|[;&|`$<>])/i.test(locator)) {
    throw new Error('content_processing_unsafe_media_locator');
  }
}

function parseFrameRate(value?: string) {
  if (!value) return 0;
  const [numerator, denominator = '1'] = value.split('/');
  const rate = Number(numerator) / Number(denominator);
  return Number.isFinite(rate) ? rate : 0;
}

function normalizeRotation(value: number): MediaProbeReadback['rotationDegrees'] {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  throw new Error('content_processing_unsupported_rotation');
}
