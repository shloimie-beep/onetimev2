import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

import { loadConfig } from '../../../packages/config/src/index.ts';

const production = {
  NODE_ENV: 'production',
  ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
  ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
  ONE_TIME_FIRST_CLASS_AT: '2026-08-16T19:00:00+03:00',
  ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T18:00:00+03:00',
  AUTH_CSRF_SECRET: 'content-media-production-csrf-secret',
  PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'content-media-production-payload-key',
} as const;

const providers = {
  CONTENT_S3_BUCKET: 'one-time-private-media',
  CONTENT_S3_KMS_KEY_ARN: 'arn:aws:kms:eu-central-1:123456789012:key/example',
  AWS_REGION: 'eu-central-1',
  CONTENT_FFMPEG_PATH: '/usr/bin/ffmpeg',
  CONTENT_FFPROBE_PATH: '/usr/bin/ffprobe',
  OPENAI_API_KEY: 'synthetic-openai-key',
  OPENAI_PROJECT_ID: 'proj_onetime',
  VIMEO_ACCESS_TOKEN: 'synthetic-vimeo-token',
  VIMEO_ACCOUNT_ID: 'vimeo-account-1',
  VIMEO_WEBHOOK_SECRET: 'synthetic-vimeo-webhook-secret',
} as const;

describe('content media configuration', () => {
  it('is default-off with no provider or upload capability', () => {
    expect(loadConfig({ NODE_ENV: 'test' })).toMatchObject({
      contentMediaMode: 'off',
      contentMediaEnabled: false,
      contentMediaProviderCanary: false,
      contentDriveConfigured: false,
      localMediaImportEnabled: false,
    });
  });

  it('keeps the narrow local import endpoint default-off and requires its HMAC key', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_LOCAL_MEDIA_IMPORT_ENABLED: 'true',
      }),
    ).toThrow(/HMAC_KEY/i);
    expect(
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_LOCAL_MEDIA_IMPORT_ENABLED: 'true',
        ONE_TIME_LOCAL_MEDIA_IMPORT_HMAC_KEY: 'h'.repeat(48),
      }),
    ).toMatchObject({
      localMediaImportEnabled: true,
      localMediaImportHmacKey: 'h'.repeat(48),
    });
  });

  it('allows a synthetic canary only with exact non-production authority', () => {
    expect(
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_CONTENT_MEDIA_MODE: 'synthetic_canary',
        ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authority-test-1',
        ONE_TIME_CONTENT_CANARY_ID: 'canary-test-1',
      }),
    ).toMatchObject({
      contentMediaMode: 'synthetic_canary',
      contentMediaEnabled: true,
      contentMediaProviderCanary: false,
      contentMediaAuthorizationId: 'authority-test-1',
      contentMediaCanaryId: 'canary-test-1',
    });
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ONE_TIME_CONTENT_MEDIA_MODE: 'synthetic_canary',
      }),
    ).toThrow(/authorization ID and one-recording canary ID/i);
  });

  it('fails closed for provider mode outside the exact production canary lane', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'development',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
        ONE_TIME_CONTENT_MEDIA_MODE: 'provider_canary',
        ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authority-provider-1',
        ONE_TIME_CONTENT_CANARY_ID: 'canary-provider-1',
      }),
    ).toThrow(/production_operator_canary/i);
  });

  it('keeps an incomplete optional Drive configuration nonblocking and provider-off', () => {
    expect(
      loadConfig({ NODE_ENV: 'test', GOOGLE_DRIVE_FOLDER_ID: 'incoming-folder' }),
    ).toMatchObject({ contentDriveConfigured: false });
  });

  it('accepts exact provider-canary configuration without enabling Drive', () => {
    const config = loadConfig({
      ...production,
      ONE_TIME_CONTENT_MEDIA_MODE: 'provider_canary',
      ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authority-provider-1',
      ONE_TIME_CONTENT_CANARY_ID: 'canary-provider-1',
      ...providers,
    });
    expect(config).toMatchObject({
      contentMediaMode: 'provider_canary',
      contentMediaEnabled: true,
      contentMediaProviderCanary: true,
      contentAwsRegion: 'eu-central-1',
      contentDriveConfigured: false,
      oneTimeFirstClassAt: '2026-08-16T19:00:00+03:00',
      oneTimeFreeAccessExpiresAt: '2026-09-11T18:00:00+03:00',
    });
  });

  it('accepts only the exact production-broad tuple and keeps provider readiness explicit', () => {
    const incomplete = loadConfig({
      ...production,
      ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_MODE: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authority-broad-1',
    });
    expect(incomplete).toMatchObject({
      contentMediaMode: 'production_broad',
      contentMediaEnabled: true,
      contentMediaProductionBroad: true,
      contentMediaProviderCanary: false,
      contentMediaProvidersReady: false,
      contentMediaBatchSize: 2,
      contentMediaConcurrency: 1,
    });

    expect(
      loadConfig({
        ...production,
        ...providers,
        ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_broad',
        ONE_TIME_CONTENT_MEDIA_MODE: 'production_broad',
        ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authority-broad-1',
        ONE_TIME_CONTENT_MEDIA_BATCH_SIZE: '10',
        ONE_TIME_CONTENT_MEDIA_CONCURRENCY: '4',
      }),
    ).toMatchObject({
      contentMediaProductionBroad: true,
      contentMediaProvidersReady: true,
      contentMediaBatchSize: 10,
      contentMediaConcurrency: 4,
    });

    expect(() =>
      loadConfig({
        ...production,
        ONE_TIME_CONTENT_MEDIA_MODE: 'production_broad',
        ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'authority-broad-1',
      }),
    ).toThrow(/production_broad/i);
  });

  it('ships the production FFmpeg and ffprobe executables at the configured paths', async () => {
    const dockerfile = await readFile(new URL('../../../Dockerfile', import.meta.url), 'utf8');
    expect(dockerfile).toContain('apk add --no-cache ffmpeg');
    expect(dockerfile).toContain('CONTENT_FFMPEG_PATH=/usr/bin/ffmpeg');
    expect(dockerfile).toContain('CONTENT_FFPROBE_PATH=/usr/bin/ffprobe');
  });
});
