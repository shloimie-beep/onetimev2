import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type {
  HighLevelAdapter,
  HighLevelProjection,
} from '../../../../packages/domain/src/highlevel/dispatcher.ts';

export class HighLevelHttpAdapter implements HighLevelAdapter {
  constructor(private readonly config: AppConfig) {}

  async project(input: HighLevelProjection) {
    const contact = await this.request('/contacts/upsert', {
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
    await this.request(`/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags: input.tagsToAdd }),
    });
    return { providerContactId: contactId };
  }

  private async request(path: string, init: RequestInit) {
    const token = this.config.highLevelPrivateIntegrationsToken;
    if (!token) throw new Error('HIGHLEVEL_PROVIDER_UNCONFIGURED');
    const response = await fetch(new URL(path, this.config.highLevelApiBaseUrl), {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
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
