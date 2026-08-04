import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../packages/config/src/index.ts';

const production = {
  NODE_ENV: 'production',
  ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
  ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
  ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-13T19:24:00+03:00',
  AUTH_CSRF_SECRET: 'content-media-production-csrf-secret',
  PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'content-media-production-payload-key',
} as const;

describe('content media configuration', () => {
  it('is default-off with no provider or upload capability', () => {
    expect(loadConfig({ NODE_ENV: 'test' })).toMatchObject({
      contentMediaMode: 'off',
      contentMediaEnabled: false,
      contentMediaProviderCanary: false,
      contentDriveConfigured: false,
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
      CONTENT_S3_BUCKET: 'one-time-private-media',
      CONTENT_S3_KMS_KEY_ARN: 'arn:aws:kms:eu-central-1:123456789012:key/example',
      AWS_REGION: 'eu-central-1',
      CONTENT_FFMPEG_PATH: '/opt/one-time/bin/ffmpeg',
      CONTENT_FFPROBE_PATH: '/opt/one-time/bin/ffprobe',
      OPENAI_API_KEY: 'synthetic-openai-key',
      OPENAI_PROJECT_ID: 'proj_onetime',
      VIMEO_ACCESS_TOKEN: 'synthetic-vimeo-token',
      VIMEO_ACCOUNT_ID: 'vimeo-account-1',
      VIMEO_WEBHOOK_SECRET: 'synthetic-vimeo-webhook-secret',
    });
    expect(config).toMatchObject({
      contentMediaMode: 'provider_canary',
      contentMediaEnabled: true,
      contentMediaProviderCanary: true,
      contentAwsRegion: 'eu-central-1',
      contentDriveConfigured: false,
    });
  });
});
