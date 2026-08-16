import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type {
  ParentWelcomeAssetBinding,
  ParentWelcomeAssetKind,
  ParentWelcomeAssetResolver,
} from '../../../../../../../packages/domain/src/portals/parent-welcome/asset-delivery.ts';
import { createParentWelcomeS3AssetRuntime } from './asset-runtime.ts';

const principal = {
  role: 'parent' as const,
  adult_id: 'adult-parent',
  household_id: 'household-parent',
  session_id: 'session-parent',
};

const media = Buffer.from('0123456789abcdef', 'utf8');

function binding(assetKind: ParentWelcomeAssetKind): ParentWelcomeAssetBinding {
  const common = {
    account_key: 'one-time-account',
    product_key: 'one_time_mishnayos' as const,
    runtime_tier: 'production' as const,
    verification_environment_id: 'production_broad',
    slot_key: 'parent_companion_welcome' as const,
    video_version_id: 'welcome-approved-v1',
    content_id: 'content-approved',
    content_version_id: 'content-version-approved',
    publication_generation: 2,
    approval_projection_digest: 'a'.repeat(64),
    source_key: 'source-approved',
    source_sha256: 'b'.repeat(64),
    source_object_version_id: 'source-object-version-1',
    storage_provider: 's3' as const,
    bucket_ref: 'one-time-private-media',
    object_version_id: `asset-object-version-${assetKind}`,
    payload_sha256: 'd'.repeat(64),
  };
  if (assetKind === 'media') {
    return {
      ...common,
      asset_kind: 'media',
      object_key: `derivative_${'c'.repeat(64)}`,
      byte_count: media.length,
      content_type: 'video/mp4',
      width: null,
      height: null,
    };
  }
  if (assetKind === 'captions') {
    const body = Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nWelcome\n', 'utf8');
    return {
      ...common,
      asset_kind: 'captions',
      object_key: `parent_welcome_captions_${'c'.repeat(64)}`,
      byte_count: body.length,
      content_type: 'text/vtt',
      width: null,
      height: null,
    };
  }
  return {
    ...common,
    asset_kind: 'poster',
    object_key: `parent_welcome_poster_${'c'.repeat(64)}`,
    byte_count: 6,
    content_type: 'image/webp',
    width: 1600,
    height: 900,
  };
}

function setup(input: {
  resolve?: (kind: ParentWelcomeAssetKind) => ParentWelcomeAssetBinding | null;
}) {
  const resolver = {
    resolveAsset: vi.fn(async ({ asset_kind }: { asset_kind: ParentWelcomeAssetKind }) =>
      input.resolve ? input.resolve(asset_kind) : binding(asset_kind),
    ),
  } satisfies ParentWelcomeAssetResolver;
  const send = vi.fn(async (command: GetObjectCommand) => {
    const resolved = binding(
      command.input.Key?.includes('captions')
        ? 'captions'
        : command.input.Key?.includes('poster')
          ? 'poster'
          : 'media',
    );
    const fullBody =
      resolved.asset_kind === 'media'
        ? media
        : resolved.asset_kind === 'captions'
          ? Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nWelcome\n', 'utf8')
          : Buffer.from('RIFFxx', 'utf8');
    const range = command.input.Range?.match(/^bytes=(\d+)-(\d+)$/u);
    const start = range ? Number(range[1]) : 0;
    const end = range ? Number(range[2]) : fullBody.length - 1;
    const body = fullBody.subarray(start, end + 1);
    return {
      Body: Readable.from([body]),
      VersionId: resolved.object_version_id,
      ContentLength: body.length,
      ContentType: resolved.content_type,
      ...(range ? { ContentRange: `bytes ${start}-${end}/${fullBody.length}` } : {}),
    };
  });
  const runtime = createParentWelcomeS3AssetRuntime({
    resolver,
    s3Client: { send } as unknown as Pick<S3Client, 'send'>,
    expectedBucketRef: 'one-time-private-media',
  });
  const app = express();
  app.get('/:assetKind', async (req, res) => {
    await runtime.send(req, res, {
      principal,
      video_version_id: 'welcome-approved-v1',
      asset_kind: req.params.assetKind as ParentWelcomeAssetKind,
    });
  });
  return { app, resolver, send };
}

describe('Parent welcome S3 asset runtime', () => {
  it('proxies the exact private MP4 version with a full 200 response', async () => {
    const { app, resolver, send } = setup({});
    const response = await request(app, '/media');

    expect(response.status).toBe(200);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-type')).toContain('video/mp4');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(media);
    expect(resolver.resolveAsset).toHaveBeenCalledWith({
      principal,
      video_version_id: 'welcome-approved-v1',
      asset_kind: 'media',
    });
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command?.input).toMatchObject({
      Bucket: 'one-time-private-media',
      Key: `derivative_${'c'.repeat(64)}`,
      VersionId: 'asset-object-version-media',
      ChecksumMode: 'ENABLED',
    });
    expect(JSON.stringify(Object.fromEntries(response.headers))).not.toMatch(
      /source_|derivative_|bucket|drive|vimeo|s3:\/\//iu,
    );
  });

  it('serves a satisfiable media Range as 206 and rejects malformed/out-of-bounds ranges as 416', async () => {
    const partial = setup({});
    const response = await request(partial.app, '/media', { range: 'bytes=4-7' });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 4-7/16');
    expect(response.headers.get('content-length')).toBe('4');
    expect(await response.text()).toBe('4567');
    expect(partial.send.mock.calls[0]?.[0].input.Range).toBe('bytes=4-7');

    for (const header of ['bytes=99-', 'bytes=0-1,4-5']) {
      const invalid = setup({});
      const rejected = await request(invalid.app, '/media', { range: header });
      expect(rejected.status).toBe(416);
      expect(rejected.headers.get('content-range')).toBe('bytes */16');
      expect(invalid.send).not.toHaveBeenCalled();
    }
  });

  it('serves exact VTT and governed poster artifacts without honoring media Range semantics', async () => {
    const { app, send } = setup({});
    const captions = await request(app, '/captions', { range: 'bytes=1-2' });
    expect(captions.status).toBe(200);
    expect(captions.headers.get('content-type')).toContain('text/vtt');
    expect(await captions.text()).toContain('WEBVTT');
    expect(send.mock.calls[0]?.[0].input.Range).toBeUndefined();

    const poster = await request(app, '/poster');
    expect(poster.status).toBe(200);
    expect(poster.headers.get('content-type')).toContain('image/webp');
    expect(Buffer.from(await poster.arrayBuffer())).toEqual(Buffer.from('RIFFxx', 'utf8'));
  });

  it('fails closed without touching S3 for absent, stale, revoked, or cross-household resolution', async () => {
    const { app, send } = setup({ resolve: () => null });
    const response = await request(app, '/media');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(Object.fromEntries(response.headers))).not.toMatch(
      /drive|vimeo|source_|object-version|s3:\/\//iu,
    );
  });

  it('fails closed when the governed bucket does not match the runtime binding', async () => {
    const { app, send } = setup({
      resolve: (kind) => ({ ...binding(kind), bucket_ref: 'unexpected-private-bucket' }),
    });
    const response = await request(app, '/media');
    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('fails closed when S3 returns any object version other than the exact approved binding', async () => {
    const { app, send } = setup({});
    send.mockResolvedValueOnce({
      Body: Readable.from([media]),
      VersionId: 'stale-object-version',
      ContentLength: media.length,
      ContentType: 'video/mp4',
    } as never);
    const response = await request(app, '/media');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect(JSON.stringify(Object.fromEntries(response.headers))).not.toMatch(
      /stale-object-version|source_|derivative_|bucket/iu,
    );
  });

  it('rechecks the approval after S3 readback and fails closed when it was revoked in flight', async () => {
    const { app, resolver, send } = setup({});
    resolver.resolveAsset.mockResolvedValueOnce(binding('media')).mockResolvedValueOnce(null);
    const response = await request(app, '/media');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect(send).toHaveBeenCalledOnce();
    expect(resolver.resolveAsset).toHaveBeenCalledTimes(2);
  });
});

async function request(app: Express, pathname: string, headers?: Record<string, string>) {
  const server = await new Promise<ReturnType<Express['listen']>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${address.port}${pathname}`, headers ? { headers } : {});
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
