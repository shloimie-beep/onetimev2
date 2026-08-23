import { createHash } from 'node:crypto';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ExecutableFfmpegOpenAiClient,
  type BoundedProcessRunner,
  type ContentProcessingMediaStore,
} from './ffmpeg-openai-client.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('ExecutableFfmpegOpenAiClient', () => {
  it('uses argument arrays, no shell, exact local locators, and removes operation temp files', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'media-client-test-'));
    roots.push(fixtureRoot);
    const ffmpeg = path.join(fixtureRoot, 'ffmpeg');
    const ffprobe = path.join(fixtureRoot, 'ffprobe');
    await writeFile(ffmpeg, 'fake ffmpeg');
    await writeFile(ffprobe, 'fake ffprobe');
    const calls: Parameters<BoundedProcessRunner['run']>[0][] = [];
    let operationDirectory = '';
    const runner: BoundedProcessRunner = {
      run: vi.fn(async (input) => {
        calls.push(input);
        if (input.executable === ffprobe) {
          return { exitCode: 0, stdout: probeJson() };
        }
        if (input.args.includes('null')) return { exitCode: 0, stdout: '' };
        const outputPath = input.args.at(-1)!;
        operationDirectory = path.dirname(outputPath);
        await writeFile(outputPath, mp4Fixture());
        return { exitCode: 0, stdout: '' };
      }),
    };
    const store: ContentProcessingMediaStore = {
      readDerivative: vi.fn(async () => null),
      downloadSource: vi.fn(async (_source, destination) => writeFile(destination, 'source bytes')),
      uploadDerivative: vi.fn(async (input) => input.readback),
    };
    const client = createClient({ fixtureRoot, ffmpeg, ffprobe, runner, store });

    await client.reconcileOrTranscode({
      operationId: 'a'.repeat(64),
      source: source() as never,
      readback: {} as never,
      plan: {
        command: {
          executable: 'ffmpeg',
          shell: false,
          args: ['-nostdin', '-i', 'managed_original_locator', '-y', 'derivative_locator'],
        },
      } as never,
    });

    const transcode = calls.find((call) => call.executable === ffmpeg)!;
    expect(transcode.shell).toBe(false);
    expect(transcode.args[transcode.args.indexOf('-i') + 1]).toMatch(/source$/u);
    expect(transcode.args.at(-1)).toMatch(/derivative\.mp4$/u);
    await expect(stat(operationDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('uses stable operation-derived OpenAI idempotency for transcription segments', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'media-client-test-'));
    roots.push(fixtureRoot);
    const ffmpeg = path.join(fixtureRoot, 'ffmpeg');
    const ffprobe = path.join(fixtureRoot, 'ffprobe');
    await writeFile(ffmpeg, 'fake ffmpeg');
    await writeFile(ffprobe, 'fake ffprobe');
    const requestHeaders: Headers[] = [];
    const fetchImpl = vi.fn(async (request: string | URL | Request, init?: RequestInit) => {
      const url = String(request);
      if (url.includes('/v1/models/')) {
        return json({ id: decodeURIComponent(url.split('/').at(-1)!) });
      }
      requestHeaders.push(new Headers(init?.headers));
      return json({ text: 'hello', segments: [{ start: 0, end: 1, text: 'hello' }] });
    });
    const runner: BoundedProcessRunner = {
      run: vi.fn(async (input) => {
        await writeFile(input.args.at(-1)!, 'audio bytes');
        return { exitCode: 0, stdout: '' };
      }),
    };
    const store: ContentProcessingMediaStore = {
      readDerivative: vi.fn(async () => null),
      downloadSource: vi.fn(async (_source, destination) => writeFile(destination, 'source bytes')),
      uploadDerivative: vi.fn(async (input) => input.readback),
    };
    const client = createClient({ fixtureRoot, ffmpeg, ffprobe, runner, store, fetchImpl });

    await client.reconcileOrTranscribe({
      operationId: 'b'.repeat(64),
      source: source() as never,
      operation: {
        version: 'OT-TRANSCRIBE-1',
        provider: 'openai',
        model: 'gpt-4o-mini-transcribe',
        language: 'en',
      } as never,
      segments: [{ segmentId: 'segment-1', startMs: 0, endMs: 1_000 }] as never,
    });

    expect(requestHeaders).toHaveLength(1);
    expect(requestHeaders[0]?.get('idempotency-key')).toBe(`${'b'.repeat(64)}:segment-1`);
  });

  it('fails closed on incomplete or refused Responses output', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'media-client-test-'));
    roots.push(fixtureRoot);
    const ffmpeg = path.join(fixtureRoot, 'ffmpeg');
    const ffprobe = path.join(fixtureRoot, 'ffprobe');
    await writeFile(ffmpeg, 'fake ffmpeg');
    await writeFile(ffprobe, 'fake ffprobe');
    const fetchImpl = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      return url.includes('/v1/models/')
        ? json({ id: decodeURIComponent(url.split('/').at(-1)!) })
        : json({
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output: [{ content: [{ type: 'refusal', refusal: 'cannot comply' }] }],
          });
    });
    const store: ContentProcessingMediaStore = {
      readDerivative: vi.fn(async () => null),
      downloadSource: vi.fn(async () => undefined),
      uploadDerivative: vi.fn(async (input) => input.readback),
    };
    const client = createClient({
      fixtureRoot,
      ffmpeg,
      ffprobe,
      runner: { run: vi.fn(async () => ({ exitCode: 0, stdout: probeJson() })) },
      store,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(
      client.reconcileOrGenerateDrafts({
        operationId: 'c'.repeat(64),
        operation: { model: 'gpt-5-mini' },
        sourceId: 'source-1',
        sourceSha256: '1'.repeat(64),
        transcriptDigest: '2'.repeat(64),
        transcriptText: 'text',
        schema: {},
      } as never),
    ).rejects.toThrow('content_processing_openai_response_uncertain');
  });

  it('rejects a structurally probeable source when bounded decode fails', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'media-client-test-'));
    roots.push(fixtureRoot);
    const ffmpeg = path.join(fixtureRoot, 'ffmpeg');
    const ffprobe = path.join(fixtureRoot, 'ffprobe');
    await writeFile(ffmpeg, 'fake ffmpeg');
    await writeFile(ffprobe, 'fake ffprobe');
    const runner: BoundedProcessRunner = {
      run: vi.fn(async (input) =>
        input.executable === ffprobe
          ? { exitCode: 0, stdout: probeJson() }
          : { exitCode: 1, stdout: '' },
      ),
    };
    const store: ContentProcessingMediaStore = {
      readDerivative: vi.fn(async () => null),
      downloadSource: vi.fn(async (_source, destination) => writeFile(destination, 'corrupt')),
      uploadDerivative: vi.fn(async (input) => input.readback),
    };
    const client = createClient({ fixtureRoot, ffmpeg, ffprobe, runner, store });

    await expect(client.probeSource(source() as never)).rejects.toThrow(
      'content_processing_source_decode_failed',
    );
    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        executable: ffmpeg,
        args: expect.arrayContaining(['-xerror', 'null']),
        shell: false,
      }),
    );
  });
});

function createClient(input: {
  fixtureRoot: string;
  ffmpeg: string;
  ffprobe: string;
  runner: BoundedProcessRunner;
  store: ContentProcessingMediaStore;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl =
    input.fetchImpl ??
    (vi.fn(async (request: string | URL | Request) =>
      json({ id: decodeURIComponent(String(request).split('/').at(-1)!) }),
    ) as typeof fetch);
  return new ExecutableFfmpegOpenAiClient(
    {
      ffmpegPath: input.ffmpeg,
      ffprobePath: input.ffprobe,
      openAiApiKey: 'test-only-key',
      openAiProjectId: 'project-1',
      timeoutMs: 1_000,
      tempRoot: input.fixtureRoot,
      openAiBaseUrl: 'https://openai.invalid',
    },
    { read: vi.fn(async () => ({ providerAccountRefHash: sha('project-1'), observedAt: '' })) },
    input.store,
    input.runner,
    fetchImpl,
  );
}

function source() {
  return {
    id: 'source-1',
    sha256: '1'.repeat(64),
    objectVersionId: 'version-1',
    byteCount: 12,
  };
}

function probeJson() {
  return JSON.stringify({
    format: {
      format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
      duration: '1',
      tags: { major_brand: 'isom', encoder: 'Lavf' },
    },
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        pix_fmt: 'yuv420p',
        width: 1280,
        height: 720,
        r_frame_rate: '30/1',
      },
      {
        codec_type: 'audio',
        codec_name: 'aac',
        profile: 'LC',
        sample_rate: '48000',
        channels: 2,
        bit_rate: '128000',
        tags: { handler_name: 'SoundHandler', vendor_id: 'test' },
      },
    ],
  });
}

function mp4Fixture() {
  return Buffer.concat([mp4Box('ftyp'), mp4Box('moov'), mp4Box('mdat')]);
}

function mp4Box(type: string) {
  const box = Buffer.alloc(8);
  box.writeUInt32BE(8, 0);
  box.write(type, 4, 4, 'ascii');
  return box;
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
