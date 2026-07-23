import { describe, expect, it } from 'vitest';
import { loadNarrowContentFactoryRuntime } from '../../../apps/worker/src/content-factory/runtime.ts';
import { contentFactoryWorkerSafeErrorCode } from '../../../packages/domain/src/content/content-factory-worker.ts';
import { safeLogFields } from '../../../packages/domain/src/delivery/redaction.ts';

const valid = {
  DATABASE_URL: 'postgres://isolated.invalid/onetime',
  CONTENT_FACTORY_WORKER_ENABLED: 'true',
  CONTENT_FACTORY_PROCESSING_MODE: 'synthetic',
  CONTENT_FACTORY_STORAGE_DRIVER: 'volume',
  CONTENT_FACTORY_STORAGE_ROOT:
    process.platform === 'win32' ? 'C:\\content-factory' : '/var/lib/onetime/content-factory',
};

describe('narrow content-factory worker runtime', () => {
  it('accepts only the database, mounted volume, and synthetic processing contract', () => {
    const runtime = loadNarrowContentFactoryRuntime(valid);
    expect(runtime.appConfig.databaseUrl).toBe(valid.DATABASE_URL);
    expect(runtime.storageSource).toEqual({
      CONTENT_FACTORY_STORAGE_DRIVER: 'volume',
      CONTENT_FACTORY_STORAGE_ROOT: valid.CONTENT_FACTORY_STORAGE_ROOT,
      CONTENT_FACTORY_MAX_UPLOAD_BYTES: '2147483648',
    });
  });

  it('ignores unrelated provider configuration instead of bootstrapping those lanes', () => {
    const runtime = loadNarrowContentFactoryRuntime({
      ...valid,
      DELIVERY_PROVIDER_MODE: 'provider',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      RESEND_API_KEY: 'not-visible-to-the-narrow-runtime',
      HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
      ONE_TIME_TELEGRAM_WEBHOOK_ENABLED: 'true',
    });
    expect(runtime.appConfig.deliveryProviderMode).toBe('sink');
    expect(runtime.appConfig.resendApiKey).toBeUndefined();
    expect(runtime.appConfig.highLevelEventSyncMode).toBe('disabled');
    expect(runtime.appConfig.oneTimeTelegramWebhookEnabled).toBe(false);
  });

  it.each([
    ['CONTENT_FACTORY_WORKER_ENABLED', 'false', 'content_factory_worker_not_enabled'],
    [
      'CONTENT_FACTORY_PROCESSING_MODE',
      'vimeo',
      'content_factory_external_provider_mode_forbidden',
    ],
    ['CONTENT_FACTORY_STORAGE_DRIVER', 'local', 'content_factory_volume_storage_required'],
    ['DATABASE_URL', '', 'content_factory_database_required'],
    ['CONTENT_FACTORY_STORAGE_ROOT', '', 'content_factory_storage_root_required'],
  ])('fails closed for %s', (key, value, code) => {
    expect(() => loadNarrowContentFactoryRuntime({ ...valid, [key]: value })).toThrow(code);
  });

  it('records only a safe SQLSTATE when PostgreSQL rejects a worker stage', () => {
    expect(contentFactoryWorkerSafeErrorCode({ code: '23514', detail: 'private row detail' })).toBe(
      'content_factory_database_23514',
    );
    expect(contentFactoryWorkerSafeErrorCode(new Error('private database message'))).toBe(
      'content_factory_processing_failed',
    );
  });

  it('retains only the narrow worker safe proof fields', () => {
    expect(
      safeLogFields({
        stage: 'review',
        completed: false,
        provider_calls_performed: false,
        safe_error_code: 'content_factory_database_23514',
        transcript: 'private transcript body',
        storage_locator: 'private volume locator',
      }),
    ).toEqual({
      stage: 'review',
      completed: false,
      provider_calls_performed: false,
      safe_error_code: 'content_factory_database_23514',
    });
  });
});
