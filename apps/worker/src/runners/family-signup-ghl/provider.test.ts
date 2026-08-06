import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../../packages/config/src/index.ts';
import {
  governedCampaignNormalizedEmailHash,
  governedCampaignProviderContactRefHash,
} from '../../../../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import {
  FAMILY_SIGNUP_GHL_PIPELINE_ID,
  FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID,
  HighLevelFamilySignupProvider,
  familySignupGhlHouseholdRefHash,
} from './provider.ts';
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
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
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
    ).resolves.toMatchObject({
      state: 'accepted',
      providerResourceId: 'provider-contact-1',
      identityProjection: {
        normalizedEmailHash: governedCampaignNormalizedEmailHash(adultClaim.normalizedEmail),
        providerContactRefHash: governedCampaignProviderContactRefHash(
          'pBSnOK2nkdxp6gf9Rg3o',
          'provider-contact-1',
        ),
        marketingSuppressed: false,
        serviceSuppressed: false,
      },
    });

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

  it('returns only hashed adult and household mapping authority after opportunity readback', async () => {
    const providerContactId = 'provider-contact-1';
    const providerOpportunityId = 'provider-opportunity-1';
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ opportunity: { id: providerOpportunityId } }))
      .mockResolvedValueOnce(
        json({
          opportunity: {
            id: providerOpportunityId,
            contactId: providerContactId,
            pipelineId: FAMILY_SIGNUP_GHL_PIPELINE_ID,
            pipelineStageId: FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID,
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
      provider.upsertHouseholdOpportunity(
        { ...adultClaim, step: 'household_opportunity_upsert', providerContactId },
        'family-signup-intent-provider-test:opportunity',
      ),
    ).resolves.toMatchObject({
      providerResourceId: providerOpportunityId,
      householdProjection: {
        providerContactRefHash: governedCampaignProviderContactRefHash(
          'pBSnOK2nkdxp6gf9Rg3o',
          providerContactId,
        ),
        providerHouseholdRefHash: familySignupGhlHouseholdRefHash(
          'pBSnOK2nkdxp6gf9Rg3o',
          providerOpportunityId,
        ),
        providerRevision: 1,
      },
    });
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
