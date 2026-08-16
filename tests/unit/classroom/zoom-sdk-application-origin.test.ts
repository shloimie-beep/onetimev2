import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { createZoomClassOccurrenceProvider } from '../../../packages/domain/src/index.ts';

const zoomEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_BASE_URL: 'https://app.onetimeonetime.com',
  ZOOM_CLASSROOM_ENABLED: 'true',
  ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
  ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
  ZOOM_MEETING_SDK_CLIENT_ID: 'sdk-client-fixture',
  ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk-secret-fixture',
  ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://app.onetimeonetime.com',
  ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
  ZOOM_S2S_ACCOUNT_ID: 'account-fixture',
  ZOOM_S2S_CLIENT_ID: 's2s-client-fixture',
  ZOOM_S2S_CLIENT_SECRET: 's2s-secret-fixture',
  ZOOM_HOST_USER_ID: 'host-fixture',
};

describe('Zoom occurrence Meeting SDK origin binding', () => {
  it('accepts the exact HTTPS application origin while the public signup origin remains separate', () => {
    expect(createZoomClassOccurrenceProvider(loadConfig(zoomEnv))).toBeDefined();
  });

  it.each([
    'https://join.onetimeonetime.com',
    'https://evil.example.test',
    'http://app.onetimeonetime.com',
  ])('rejects a non-application SDK origin %s', (allowedOrigin) => {
    const config = loadConfig({
      ...zoomEnv,
      ZOOM_MEETING_SDK_ALLOWED_ORIGIN: allowedOrigin,
    });

    expect(createZoomClassOccurrenceProvider(config)).toBeUndefined();
  });
});
