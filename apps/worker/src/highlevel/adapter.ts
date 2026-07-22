import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type {
  HighLevelAdapter,
  HighLevelProjection,
  HighLevelProviderOperationContext,
} from '../../../../packages/domain/src/highlevel/dispatcher.ts';

export class HighLevelHttpAdapter implements HighLevelAdapter {
  constructor(private readonly config: AppConfig) {}

  async upsertContact(input: HighLevelProjection, context: HighLevelProviderOperationContext) {
    const contact = await this.request('/contacts/upsert', context, {
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
    await this.request(`/contacts/${encodeURIComponent(input.providerContactId)}/tags`, context, {
      method: 'POST',
      body: JSON.stringify({ tags: input.tagsToAdd }),
    });
  }

  private async request(
    path: string,
    context: HighLevelProviderOperationContext,
    init: RequestInit,
  ) {
    const token = this.config.highLevelPrivateIntegrationsToken;
    if (!token) throw new Error('HIGHLEVEL_PROVIDER_UNCONFIGURED');
    const response = await fetch(new URL(path, this.config.highLevelApiBaseUrl), {
      ...init,
      signal: AbortSignal.timeout(this.config.highLevelProviderTimeoutMs),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': context.operationKey,
        Version: this.config.highLevelApiVersion,
      },
    });
    if (!response.ok) throw new Error(`HIGHLEVEL_PROVIDER_HTTP_${response.status}`);
    return (await response.json()) as unknown;
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
