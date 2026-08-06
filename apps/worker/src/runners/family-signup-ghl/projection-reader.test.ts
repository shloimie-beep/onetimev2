import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../../packages/config/src/index.ts';
import {
  governedCampaignNormalizedEmailHash,
  governedCampaignProviderContactRefHash,
} from '../../../../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import {
  FAMILY_SIGNUP_GHL_PIPELINE_ID,
  FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID,
  familySignupGhlHouseholdRefHash,
} from './provider.ts';
import { HighLevelFamilySignupProjectionReader } from './projection-reader.ts';
import type { FamilySignupGhlProjectionRecoveryClaim } from './types.ts';

const LOCATION_ID = 'pBSnOK2nkdxp6gf9Rg3o';
const claim: FamilySignupGhlProjectionRecoveryClaim = {
  intentId: 'family-signup-projection-recovery-test',
  adultId: 'adult-projection-recovery-test',
  householdId: 'household-projection-recovery-test',
  normalizedEmail: 'adult@example.test',
  accessState: 'free',
  product: 'one_time_mishnayos',
  runtimeTier: 'production',
  verificationEnvironmentId: 'production_broad',
  providerContactId: 'provider-contact-projection-recovery-test',
  providerOpportunityId: 'provider-opportunity-projection-recovery-test',
};

describe('Family-signup HighLevel projection recovery reader', () => {
  it('performs exactly two GET readbacks and returns only hash authority', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          contact: {
            id: claim.providerContactId,
            locationId: LOCATION_ID,
            email: claim.normalizedEmail,
            dnd: false,
            tags: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        json({
          opportunity: {
            id: claim.providerOpportunityId,
            contactId: claim.providerContactId,
            pipelineId: FAMILY_SIGNUP_GHL_PIPELINE_ID,
            pipelineStageId: FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID,
          },
        }),
      );
    const reader = new HighLevelFamilySignupProjectionReader(testConfig(), fetchMock);

    await expect(reader.readProjection(claim, 'projection-recovery:test')).resolves.toMatchObject({
      identityProjection: {
        normalizedEmailHash: governedCampaignNormalizedEmailHash(claim.normalizedEmail),
        providerContactRefHash: governedCampaignProviderContactRefHash(
          LOCATION_ID,
          claim.providerContactId,
        ),
        marketingSuppressed: false,
        serviceSuppressed: false,
      },
      householdProjection: {
        providerContactRefHash: governedCampaignProviderContactRefHash(
          LOCATION_ID,
          claim.providerContactId,
        ),
        providerHouseholdRefHash: familySignupGhlHouseholdRefHash(
          LOCATION_ID,
          claim.providerOpportunityId,
        ),
        providerRevision: 1,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      expect(String(url)).not.toContain('/workflow/');
      expect(String(url)).not.toContain('/upsert');
      expect(JSON.stringify(init).toLowerCase()).not.toContain('student');
    }
  });

  it('fails closed before opportunity readback when the adult email does not match', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json({
        contact: {
          id: claim.providerContactId,
          locationId: LOCATION_ID,
          email: 'different@example.test',
          dnd: false,
        },
      }),
    );
    const reader = new HighLevelFamilySignupProjectionReader(testConfig(), fetchMock);

    await expect(reader.readProjection(claim, 'projection-recovery:test')).rejects.toThrow(
      'projection_contact_readback_mismatch',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'test-provider-token',
  });
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
