import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';

describe('application base URL configuration', () => {
  it('defaults the authenticated application origin independently from the public signup origin', () => {
    const config = loadConfig({ NODE_ENV: 'test' });

    expect(config.publicBaseUrl).toBe('https://join.onetimeonetime.com');
    expect(config.applicationBaseUrl).toBe('https://app.onetimeonetime.com');
  });

  it('loads APP_BASE_URL without changing PUBLIC_BASE_URL', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.example.test',
      APP_BASE_URL: 'https://app.example.test',
    });

    expect(config.publicBaseUrl).toBe('https://join.example.test');
    expect(config.applicationBaseUrl).toBe('https://app.example.test');
  });
});
