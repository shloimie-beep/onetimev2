import { describe, expect, it } from 'vitest';
import { redactProviderMetadata } from '../../../packages/domain/src/index.ts';

describe('OT-71 content metadata redaction', () => {
  it('removes raw provider URLs, URL-shaped keys, and credential-like values recursively', () => {
    const redacted = redactProviderMetadata({
      title: 'Safe title',
      source_url: 'https://vimeo.example.test/private/recording',
      nested: {
        href: 'https://drive.google.com/file/private',
        notes: ['Keep this', 'https://zoom.example.test/meeting/private'],
        token: 'secret-launch-token',
      },
    });

    expect(redacted.count).toBeGreaterThanOrEqual(5);
    const serialized = JSON.stringify(redacted.value);
    expect(serialized).toContain('Safe title');
    expect(serialized).not.toMatch(/https?:\/\/|vimeo|zoom|drive\.google|secret-launch-token/i);
    expect(serialized).toMatch(/redacted_field_/);
  });
});
