import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../../../packages/config/src/index.ts';
import {
  governedCampaignNormalizedEmailHash,
  governedCampaignProviderContactRefHash,
} from '../../../../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import {
  FAMILY_SIGNUP_GHL_PIPELINE_ID,
  FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID,
  familySignupGhlHouseholdRefHash,
} from './provider.ts';
import type {
  FamilySignupGhlProjectionReader,
  FamilySignupGhlProjectionRecoveryClaim,
  FamilySignupGhlProjectionReadback,
} from './types.ts';
import { FamilySignupGhlProviderError } from './types.ts';

type JsonObject = Record<string, unknown>;

/**
 * Recovery reader for Family projections that predate the local identity writer.
 * Its transport is deliberately GET-only and cannot enroll a workflow or mutate
 * a HighLevel contact, opportunity, sender, mailbox, or account setting.
 */
export class HighLevelFamilySignupProjectionReader implements FamilySignupGhlProjectionReader {
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly locationId: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(config: AppConfig, fetchImplementation: typeof fetch = fetch) {
    if (!config.highLevelPrivateIntegrationsToken) {
      throw new Error('HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN is required');
    }
    this.baseUrl = config.highLevelApiBaseUrl;
    this.apiVersion = config.highLevelApiVersion;
    this.locationId = config.highLevelLocationId;
    this.token = config.highLevelPrivateIntegrationsToken;
    this.timeoutMs = config.highLevelProviderTimeoutMs;
    this.fetchImplementation = fetchImplementation;
  }

  async readProjection(
    claim: FamilySignupGhlProjectionRecoveryClaim,
    operationKey: string,
  ): Promise<FamilySignupGhlProjectionReadback> {
    const contact = providerObject(
      await this.get(`/contacts/${encodeURIComponent(claim.providerContactId)}`, operationKey),
      'contact',
    );
    if (
      requiredText(contact.id, 'contact_id') !== claim.providerContactId ||
      requiredText(contact.locationId, 'contact_location_id') !== this.locationId ||
      normalizeEmail(contact.email) !== claim.normalizedEmail
    ) {
      throw new FamilySignupGhlProviderError('projection_contact_readback_mismatch', false);
    }
    const suppression = emailSuppression(contact);
    if (suppression === null) {
      throw new FamilySignupGhlProviderError('projection_suppression_unavailable', false);
    }

    const opportunity = providerObject(
      await this.get(
        `/opportunities/${encodeURIComponent(claim.providerOpportunityId)}`,
        operationKey,
      ),
      'opportunity',
    );
    if (
      requiredText(opportunity.id, 'opportunity_id') !== claim.providerOpportunityId ||
      requiredText(opportunity.contactId, 'opportunity_contact_id') !== claim.providerContactId ||
      requiredText(opportunity.pipelineId, 'opportunity_pipeline_id') !==
        FAMILY_SIGNUP_GHL_PIPELINE_ID ||
      requiredText(opportunity.pipelineStageId, 'opportunity_stage_id') !==
        FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID
    ) {
      throw new FamilySignupGhlProviderError('projection_opportunity_readback_mismatch', false);
    }

    const providerContactRefHash = governedCampaignProviderContactRefHash(
      this.locationId,
      claim.providerContactId,
    );
    const readbackDigest = digestJson({ contact, opportunity });
    return {
      identityProjection: {
        normalizedEmailHash: governedCampaignNormalizedEmailHash(claim.normalizedEmail),
        providerContactRefHash,
        marketingSuppressed: suppression,
        serviceSuppressed: suppression,
        suppressionEvidenceDigest: digestText(suppressionSnapshot(contact)),
      },
      householdProjection: {
        providerContactRefHash,
        providerHouseholdRefHash: familySignupGhlHouseholdRefHash(
          this.locationId,
          claim.providerOpportunityId,
        ),
        providerRevision: 1,
        readbackDigest,
      },
    };
  }

  private async get(path: string, operationKey: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImplementation(new URL(path, this.baseUrl), {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          Version: this.apiVersion,
          'X-One-Time-Readback-Operation': operationKey,
        },
      });
    } catch {
      throw new FamilySignupGhlProviderError('projection_readback_transport_failed', false);
    }
    if (!response.ok) {
      throw new FamilySignupGhlProviderError(`projection_readback_http_${response.status}`, false);
    }
    const body = await response.text();
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new FamilySignupGhlProviderError('projection_readback_response_invalid', false);
    }
  }
}

function providerObject(value: unknown, nestedKey: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FamilySignupGhlProviderError('projection_readback_response_invalid', false);
  }
  const root = value as JsonObject;
  const nested = root[nestedKey];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as JsonObject;
  }
  return root;
}

function emailSuppression(contact: JsonObject): boolean | null {
  if (contact.dnd === true) return true;
  if (contact.dnd !== false && contact.dnd !== undefined && contact.dnd !== null) return null;
  const settings = providerRecord(contact.dndSettings);
  const email = providerRecord(settings?.Email);
  if (email?.status === 'active' || email?.status === 'permanent') return true;
  if (email?.status === 'inactive') return false;
  return contact.dnd === false ? false : null;
}

function suppressionSnapshot(contact: JsonObject): string {
  return stableJson({
    dnd: contact.dnd ?? null,
    dndSettings: contact.dndSettings ?? null,
    inboundDndSettings: contact.inboundDndSettings ?? null,
    tags: Array.isArray(contact.tags)
      ? [...contact.tags].map(String).sort((left, right) => left.localeCompare(right))
      : [],
  });
}

function providerRecord(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null;
}

function digestJson(value: unknown): string {
  return digestText(stableJson(value));
}

function digestText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as JsonObject).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FamilySignupGhlProviderError(`projection_${field}_missing`, false);
  }
  return value;
}
