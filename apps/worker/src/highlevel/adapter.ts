import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type {
  HighLevelAdapter,
  HighLevelProjection,
  HighLevelProviderOperationContext,
} from '../../../../packages/domain/src/highlevel/dispatcher.ts';
import { HighLevelHttpClient } from '../../../../packages/domain/src/highlevel/http-client.ts';

export class HighLevelHttpAdapter implements HighLevelAdapter {
  private readonly client: HighLevelHttpClient;

  constructor(private readonly config: AppConfig) {
    this.client = new HighLevelHttpClient({
      apiBaseUrl: config.highLevelApiBaseUrl,
      apiVersion: config.highLevelApiVersion,
      privateIntegrationsToken: config.highLevelPrivateIntegrationsToken,
      timeoutMs: config.highLevelProviderTimeoutMs,
    });
  }

  async upsertContact(input: HighLevelProjection, context: HighLevelProviderOperationContext) {
    const contact = await this.client.request('/contacts/upsert', context.operationKey, {
      method: 'POST',
      body: JSON.stringify({
        locationId: input.locationId,
        email: input.adult.email,
        phone: input.adult.phone ?? undefined,
        name: input.adult.displayName,
        customFields: input.customFields.map((field) => ({
          id: field.id,
          field_value: field.value,
        })),
      }),
    });
    const contactId = providerContactId(contact);
    return { providerContactId: contactId };
  }

  async addTags(
    input: { locationId: string; providerContactId: string; tagsToAdd: string[] },
    context: HighLevelProviderOperationContext,
  ) {
    await this.client.request(
      `/contacts/${encodeURIComponent(input.providerContactId)}/tags`,
      context.operationKey,
      {
        method: 'POST',
        body: JSON.stringify({ tags: input.tagsToAdd }),
      },
    );
  }

  async readTags(
    input: { locationId: string; providerContactId: string },
    context: HighLevelProviderOperationContext,
  ) {
    void input.locationId;
    const value = await this.client.request(
      `/contacts/${encodeURIComponent(input.providerContactId)}`,
      context.operationKey,
      { method: 'GET' },
    );
    return providerContactTags(value);
  }
}

function providerContactId(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('HIGHLEVEL_PROVIDER_RESPONSE_INVALID');
  const record = value as Record<string, unknown>;
  const contact = record.contact;
  if (contact && typeof contact === 'object') {
    const id = (contact as Record<string, unknown>).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  if (typeof record.id === 'string' && record.id.length > 0) return record.id;
  throw new Error('HIGHLEVEL_PROVIDER_CONTACT_ID_MISSING');
}

function providerContactTags(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('HIGHLEVEL_PROVIDER_RESPONSE_INVALID');
  const record = value as Record<string, unknown>;
  const contact =
    record.contact && typeof record.contact === 'object'
      ? (record.contact as Record<string, unknown>)
      : record;
  if (!Array.isArray(contact.tags)) throw new Error('HIGHLEVEL_PROVIDER_TAG_READBACK_INVALID');
  return contact.tags.map((tag) => {
    if (typeof tag === 'string') return tag;
    if (
      tag &&
      typeof tag === 'object' &&
      typeof (tag as Record<string, unknown>).name === 'string'
    ) {
      return String((tag as Record<string, unknown>).name);
    }
    throw new Error('HIGHLEVEL_PROVIDER_TAG_READBACK_INVALID');
  });
}
