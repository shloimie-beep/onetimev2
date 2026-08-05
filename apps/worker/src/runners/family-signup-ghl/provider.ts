import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../../../packages/config/src/index.ts';
import type {
  FamilySignupGhlAcceptedEffect,
  FamilySignupGhlClaim,
  FamilySignupGhlContactResult,
  FamilySignupGhlProvider,
} from './types.ts';
import { FamilySignupGhlProviderError } from './types.ts';

export const FAMILY_SIGNUP_GHL_WORKFLOW_ID = '95a6f461-1a04-4260-b379-246fdcc45af7';
export const FAMILY_SIGNUP_GHL_PIPELINE_ID = 'RTTGVfbMv5aM92BQqklL';
export const FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID = 'b87ce5c3-d877-4009-99bd-6012da7e455d';

const CONTACT_FIELDS = {
  parentId: 'xHPAvxHOpvZ6GbrRZBvn',
  householdId: 'PIuJBPvZGI3FTp4ZRpay',
  customerStatus: 'eyXioXxAMuaZpxSaRcEN',
  signupSource: 'kRNVyi6Fm5N5dobXU9ZL',
  sourceChannel: 'OmtEb9OQ42bcQIw1ov4J',
} as const;

type JsonObject = Record<string, unknown>;

export class HighLevelFamilySignupProvider implements FamilySignupGhlProvider {
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

  async upsertAdultContact(
    claim: FamilySignupGhlClaim,
    operationKey: string,
  ): Promise<FamilySignupGhlContactResult> {
    const matches = await this.searchExactEmail(claim.normalizedEmail, operationKey);
    if (matches.length > 1) {
      return { state: 'identity_review', safeErrorCode: 'multiple_exact_email_matches' };
    }
    const before = matches[0]
      ? await this.getContact(matches[0].id, `${operationKey}:before`)
      : null;
    const names = splitDisplayName(claim.displayName);
    const response = await this.request('/contacts/upsert', operationKey, {
      method: 'POST',
      body: JSON.stringify({
        locationId: this.locationId,
        firstName: names.firstName,
        lastName: names.lastName,
        name: claim.displayName,
        email: claim.normalizedEmail,
        timezone: claim.timezone,
        source: 'One Time Family signup',
        createNewIfDuplicateAllowed: false,
        customFields: [
          { id: CONTACT_FIELDS.parentId, fieldValue: claim.adultId },
          { id: CONTACT_FIELDS.householdId, fieldValue: claim.householdId },
          { id: CONTACT_FIELDS.customerStatus, fieldValue: 'Prelaunch' },
          { id: CONTACT_FIELDS.signupSource, fieldValue: 'Family account signup' },
          { id: CONTACT_FIELDS.sourceChannel, fieldValue: 'Website' },
        ],
      }),
    });
    const contact = providerObject(response, 'contact');
    const contactId = requiredText(contact.id ?? (response as JsonObject | null)?.id, 'contact_id');
    if (matches[0] && matches[0].id !== contactId) {
      return { state: 'identity_review', safeErrorCode: 'multiple_exact_email_matches' };
    }
    const after = await this.getContact(contactId, `${operationKey}:readback`);
    if (
      normalizeEmail(after.email) !== claim.normalizedEmail ||
      requiredText(after.locationId, 'contact_location_id') !== this.locationId
    ) {
      throw new FamilySignupGhlProviderError('contact_readback_mismatch', true);
    }
    if (before && suppressionSnapshot(before) !== suppressionSnapshot(after)) {
      return { state: 'identity_review', safeErrorCode: 'provider_suppression_drift' };
    }
    return {
      state: 'accepted',
      providerResourceId: contactId,
      providerResponseDigest: digestJson({ response, readback: after }),
    };
  }

  async upsertHouseholdOpportunity(
    claim: FamilySignupGhlClaim,
    operationKey: string,
  ): Promise<FamilySignupGhlAcceptedEffect> {
    if (!claim.providerContactId) {
      throw new Error('family_signup_ghl_contact_required_before_opportunity');
    }
    const response = await this.request('/opportunities/upsert', operationKey, {
      method: 'POST',
      body: JSON.stringify({
        locationId: this.locationId,
        pipelineId: FAMILY_SIGNUP_GHL_PIPELINE_ID,
        pipelineStageId: FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID,
        contactId: claim.providerContactId,
        name: `One Time Family ${claim.householdId}`,
        status: 'open',
        monetaryValue: 0,
      }),
    });
    const opportunity = providerObject(response, 'opportunity');
    const opportunityId = requiredText(
      opportunity.id ?? (response as JsonObject | null)?.id,
      'opportunity_id',
    );
    const readbackRoot = await this.request(
      `/opportunities/${encodeURIComponent(opportunityId)}`,
      `${operationKey}:readback`,
      { method: 'GET' },
    );
    const readback = providerObject(readbackRoot, 'opportunity');
    if (
      requiredText(readback.contactId, 'opportunity_contact_id') !== claim.providerContactId ||
      requiredText(readback.pipelineId, 'opportunity_pipeline_id') !==
        FAMILY_SIGNUP_GHL_PIPELINE_ID ||
      requiredText(readback.pipelineStageId, 'opportunity_stage_id') !==
        FAMILY_SIGNUP_GHL_SIGNED_UP_STAGE_ID
    ) {
      throw new FamilySignupGhlProviderError('opportunity_readback_mismatch', true);
    }
    return {
      providerResourceId: opportunityId,
      providerResponseDigest: digestJson({ response, readback }),
    };
  }

  async enrollConfirmationWorkflow(
    claim: FamilySignupGhlClaim,
    operationKey: string,
  ): Promise<FamilySignupGhlAcceptedEffect> {
    if (!claim.providerContactId || !claim.providerOpportunityId) {
      throw new Error('family_signup_ghl_projection_required_before_workflow');
    }
    const response = await this.request(
      `/contacts/${encodeURIComponent(claim.providerContactId)}/workflow/${FAMILY_SIGNUP_GHL_WORKFLOW_ID}`,
      operationKey,
      { method: 'POST', body: '{}' },
    );
    return {
      providerResourceId: `${claim.providerContactId}:${FAMILY_SIGNUP_GHL_WORKFLOW_ID}`,
      providerResponseDigest: digestJson(response),
    };
  }

  private async searchExactEmail(email: string, operationKey: string) {
    const url = new URL('/contacts/', this.baseUrl);
    url.searchParams.set('locationId', this.locationId);
    url.searchParams.set('query', email);
    url.searchParams.set('limit', '100');
    const value = await this.request(url, `${operationKey}:search`, { method: 'GET' });
    const contacts = Array.isArray((value as JsonObject | null)?.contacts)
      ? ((value as JsonObject).contacts as unknown[])
      : null;
    if (!contacts) throw new FamilySignupGhlProviderError('contact_search_invalid', false);
    return contacts
      .map((entry) => providerObject(entry))
      .filter((entry) => normalizeEmail(entry.email) === email)
      .map((entry) => ({ id: requiredText(entry.id, 'contact_id') }));
  }

  private async getContact(contactId: string, operationKey: string): Promise<JsonObject> {
    const value = await this.request(`/contacts/${encodeURIComponent(contactId)}`, operationKey, {
      method: 'GET',
    });
    return providerObject(value, 'contact');
  }

  private async request(
    path: string | URL,
    operationKey: string,
    init: RequestInit,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImplementation(new URL(path, this.baseUrl), {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': operationKey,
          Version: this.apiVersion,
          ...init.headers,
        },
      });
    } catch {
      throw new FamilySignupGhlProviderError('provider_transport_unknown', true);
    }
    if (!response.ok) {
      throw new FamilySignupGhlProviderError(
        `provider_http_${response.status}`,
        response.status >= 500,
      );
    }
    const body = await response.text();
    if (body.trim() === '') return { accepted: true, status: response.status };
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new FamilySignupGhlProviderError('provider_response_invalid', true);
    }
  }
}

function providerObject(value: unknown, nestedKey?: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FamilySignupGhlProviderError('provider_response_invalid', true);
  }
  const root = value as JsonObject;
  if (!nestedKey) return root;
  const nested = root[nestedKey];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as JsonObject;
  }
  return root;
}

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/u);
  return {
    firstName: parts[0] ?? displayName,
    lastName: parts.slice(1).join(' ') || undefined,
  };
}

function suppressionSnapshot(contact: JsonObject): string {
  return stableJson({
    dnd: contact.dnd ?? null,
    dndSettings: contact.dndSettings ?? null,
    inboundDndSettings: contact.inboundDndSettings ?? null,
    tags: Array.isArray(contact.tags)
      ? [...contact.tags].map(String).sort((a, b) => a.localeCompare(b))
      : [],
  });
}

function digestJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value), 'utf8').digest('hex');
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
    throw new FamilySignupGhlProviderError(`${field}_missing`, true);
  }
  return value;
}
