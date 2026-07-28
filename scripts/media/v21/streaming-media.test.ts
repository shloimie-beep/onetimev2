import { describe, expect, it } from 'vitest';

import { CONTENT_PROCESSING_STREAM_CHUNK_BYTES } from '../../../packages/contracts/src/content/processing/index.ts';
import {
  buildFfprobeReadbackPlan,
  digestBoundedMediaStream,
  parseFfprobeReadbackJson,
} from './streaming-media.ts';

describe('P20 bounded media utilities', () => {
  it('hashes incrementally and rejects an oversized stream chunk', async () => {
    async function* valid() {
      yield new Uint8Array([1, 2]);
      yield new Uint8Array([3]);
    }
    await expect(digestBoundedMediaStream(valid())).resolves.toMatchObject({
      byteCount: 3,
      largestChunkBytes: 2,
      wholeFileBuffered: false,
    });

    async function* invalid() {
      yield new Uint8Array(CONTENT_PROCESSING_STREAM_CHUNK_BYTES + 1);
    }
    await expect(digestBoundedMediaStream(invalid())).rejects.toThrow(
      'content_processing_stream_chunk_out_of_bounds',
    );
  });

  it('builds an argv-only ffprobe readback without shell or URL input', () => {
    expect(buildFfprobeReadbackPlan('managed/source-1')).toMatchObject({
      executable: 'ffprobe',
      shell: false,
      args: expect.arrayContaining(['-show_format', '-show_streams', 'managed/source-1']),
    });
    expect(() => buildFfprobeReadbackPlan('https://public.example/video')).toThrow(
      'content_processing_unsafe_media_locator',
    );
  });

  it('parses a bounded ffprobe readback and preserves rotation for normalization', () => {
    expect(
      parseFfprobeReadbackJson(
        JSON.stringify({
          format: { duration: '60.5', format_name: 'matroska,webm' },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              pix_fmt: 'yuv420p',
              width: 1080,
              height: 1920,
              avg_frame_rate: '30000/1001',
              side_data_list: [{ rotation: -90 }],
            },
            {
              codec_type: 'audio',
              codec_name: 'aac',
              profile: 'LC',
              sample_rate: '48000',
              channels: 2,
            },
          ],
        }),
      ),
    ).toMatchObject({
      durationMs: 60_500,
      codedWidth: 1080,
      codedHeight: 1920,
      rotationDegrees: 270,
      videoStreamCount: 1,
      audioStreamCount: 1,
    });
  });
});
