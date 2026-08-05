import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../../packages/config/src/index.ts';
import { HighLevelFamilySignupProvider } from './provider.ts';
import type { FamilySignupGhlClaim } from './types.ts';

const adultClaim: FamilySignupGhlClaim = {
  intentId: 'family-signup-intent-provider-test',
  leaseToken: 'lease-provider-test',
  step: 'contact_upsert',
  attemptCount: 1,
  adultId: 'adult-provider-test',
  householdId: 'household-provider-test',
  normalizedEmail: 'adult@example.test',
  displayName: 'Adult Example',
  timezone: 'Asia/Jerusalem',
  accessState: 'free',
  freeAccessExpiresAt: '2026-09-11T15:00:00.000Z',
  generalMarketingConsent: false,
  parentNewsletterConsent: false,
  providerContactId: null,
  providerOpportunityId: null,
};

describe('Family-signup HighLevel provider', () => {
  it('upserts one adult without Student, tag, DND, or suppression mutation fields', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ contacts: [], count: 0 }))
      .mockResolvedValueOnce(
        json({ contact: { id: 'provider-contact-1', email: adultClaim.normalizedEmail } }),
      )
      .mockResolvedValueOnce(
        json({
          contact: {
            id: 'provider-contact-1',
            email: adultClaim.normalizedEmail,
            locationId: 'pBSnOK2nkdxp6gf9Rg3o',
            tags: [],
            dnd: false,
          },
        }),
      );
    const provider = new HighLevelFamilySignupProvider(
      loadConfig({
        NODE_ENV: 'test',
        HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
      }),
      fetchMock,
    );
    await expect(
      provider.upsertAdultContact(adultClaim, 'family-signup-intent-provider-test:contact'),
    ).resolves.toMatchObject({ state: 'accepted', providerResourceId: 'provider-contact-1' });

    const request = fetchMock.mock.calls[1];
    const body = JSON.parse(String(request?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      email: adultClaim.normalizedEmail,
      locationId: 'pBSnOK2nkdxp6gf9Rg3o',
      createNewIfDuplicateAllowed: false,
    });
    expect(body).not.toHaveProperty('tags');
    expect(body).not.toHaveProperty('dnd');
    expect(body).not.toHaveProperty('dndSettings');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('student');
  });

  it('quarantines duplicate exact emails before any write', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json({
        contacts: [
          { id: 'provider-contact-1', email: adultClaim.normalizedEmail },
          { id: 'provider-contact-2', email: adultClaim.normalizedEmail.toUpperCase() },
        ],
        count: 2,
      }),
    );
    const provider = new HighLevelFamilySignupProvider(
      loadConfig({
        NODE_ENV: 'test',
        HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
      }),
      fetchMock,
    );
    await expect(
      provider.upsertAdultContact(adultClaim, 'family-signup-intent-provider-test:contact'),
    ).resolves.toEqual({
      state: 'identity_review',
      safeErrorCode: 'multiple_exact_email_matches',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
