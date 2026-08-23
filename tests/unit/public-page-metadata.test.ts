import { describe, expect, it } from 'vitest';
import {
  defaultProductionPublicOrigin,
  publicCanonicalUrl,
  publicOriginFromEnv,
} from '../../scripts/public-page-metadata.ts';

describe('public page metadata origins', () => {
  it('defaults explicitly to the production public origin', () => {
    expect(publicOriginFromEnv('')).toBe(defaultProductionPublicOrigin);
    expect(publicCanonicalUrl('/', defaultProductionPublicOrigin)).toBe(
      `${defaultProductionPublicOrigin}/`,
    );
  });

  it('uses the staging origin for canonical and Open Graph URLs at build time', () => {
    const stagingOrigin = publicOriginFromEnv('https://ot99-web-staging.up.railway.app/app');

    expect(stagingOrigin).toBe('https://ot99-web-staging.up.railway.app');
    expect(publicCanonicalUrl('/', stagingOrigin)).toBe('https://ot99-web-staging.up.railway.app/');
    expect(publicCanonicalUrl('/signup', stagingOrigin)).toBe(
      'https://ot99-web-staging.up.railway.app/signup',
    );
    expect(publicCanonicalUrl('/signup', stagingOrigin)).not.toContain('join.onetimeonetime.com');
    expect(publicCanonicalUrl('/cancellation-refund', stagingOrigin)).toBe(
      'https://ot99-web-staging.up.railway.app/cancellation-refund',
    );
  });

  it('rejects non-root-relative canonical paths', () => {
    expect(() => publicCanonicalUrl('signup', defaultProductionPublicOrigin)).toThrow(
      'root-relative',
    );
    expect(() => publicCanonicalUrl('//evil.example.test', defaultProductionPublicOrigin)).toThrow(
      'root-relative',
    );
  });
});
