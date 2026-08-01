import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import {
  createContentPublicationFeatureRegistration,
  disabledVimeoBinding,
} from '../../../apps/web/src/server/features/content/publication/index.ts';

describe('P21 path-complete content-publication registration', () => {
  it('registers repository routes without enabling a provider effect', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      AUTH_CSRF_SECRET: 'test-content-publication-integration-secret',
    });
    const registration = createContentPublicationFeatureRegistration({
      resolveIdentity: async () => null,
      verifyCsrf: async () => false,
    });
    const binding = disabledVimeoBinding(config);
    expect(registration.mountPath).toBe('/api');
    expect(binding.active).toBe(false);
    expect(binding.mutation_policy).toBe('prohibited');
    expect(binding.allowed_operation_types).toEqual([]);
  });
});
