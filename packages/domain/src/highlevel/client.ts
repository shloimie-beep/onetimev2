import { setTimeout as delay } from 'node:timers/promises';
import type { HighLevelContactIdentity } from '../../../contracts/src/highlevel/index.ts';
import { HIGHLEVEL_API_VERSION, HIGHLEVEL_APP_URL } from './constants.ts';
import type { HighLevelRuntimeConfig } from './config.ts';
import { assertHighLevelProviderReady, inspectHighLevelReadiness } from './config.ts';
import { normalizeHighLevelEmail, normalizeHighLevelPhone, stableDigest } from './normalization.ts';

export type HighLevelContact = {
  id: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  customFields?: Record<string, string | null> | undefined;
};

export type HighLevelSubscription = {
  id: string;
  contactId: string;
  status: string;
  currentPeriodEnd?: string | undefined;
};

export type HighLevelTransaction = {
  id: string;
  contactId: string;
  subscriptionId?: string | undefined;
  status: string;
  createdAt: string;
};

export type HighLevelConversation = { id: string; contactId: string; updatedAt: string };
export type HighLevelMessage = { id: string; conversationId: string; direction: string };

export type HighLevelClient = {
  health(): Promise<ReturnType<typeof inspectHighLevelReadiness>>;
  upsertContact(input: {
    identity: HighLevelContactIdentity;
    customFields?: Record<string, string | null> | undefined;
  }): Promise<HighLevelContact>;
  getContact(contactId: string): Promise<HighLevelContact | null>;
  searchContact(input: {
    email?: string | null;
    phone?: string | null;
  }): Promise<HighLevelContact[]>;
  addTags(contactId: string, tags: readonly string[]): Promise<void>;
  removeTags(contactId: string, tags: readonly string[]): Promise<void>;
  setCustomFields(contactId: string, fields: Record<string, string | null>): Promise<void>;
  addContactToWorkflow(contactId: string, workflowId: string): Promise<void>;
  removeContactFromWorkflow(contactId: string, workflowId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<HighLevelSubscription | null>;
  listSubscriptions(input?: {
    contactId?: string | undefined;
    cursor?: string | undefined;
  }): Promise<HighLevelSubscription[]>;
  listTransactions(input?: {
    subscriptionId?: string | undefined;
    cursor?: string | undefined;
  }): Promise<HighLevelTransaction[]>;
  getConversations(contactId: string): Promise<HighLevelConversation[]>;
  getMessages(conversationId: string): Promise<HighLevelMessage[]>;
  addHistoricalInboundMessage(input: {
    contactId: string;
    messageId: string;
    subject: string;
    occurredAt: string;
    bodyDigest: string;
    importTag: string;
    suppressAutomation: true;
  }): Promise<{ providerReferenceHash: string }>;
  openContactUrl(contactId: string): string;
};

export class HighLevelProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly httpStatus?: number | undefined,
  ) {
    super(code);
  }
}

export class HttpHighLevelClient implements HighLevelClient {
  constructor(
    private readonly config: HighLevelRuntimeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async health() {
    return inspectHighLevelReadiness(this.config);
  }

  async upsertContact(input: {
    identity: HighLevelContactIdentity;
    customFields?: Record<string, string | null> | undefined;
  }) {
    const body = {
      locationId: this.config.highLevelLocationId,
      firstName: input.identity.firstName,
      lastName: input.identity.lastName,
      email: normalizeHighLevelEmail(input.identity.email),
      phone: normalizeHighLevelPhone(input.identity.phone),
      customFields: toCustomFields(input.customFields ?? {}),
    };
    const response = await this.request<{ contact?: ProviderContact; id?: string }>(
      '/contacts/upsert',
      { method: 'POST', body },
    );
    return fromProviderContact(
      response.contact ?? {
        id: response.id ?? 'unknown',
        email: body.email,
        phone: body.phone,
        customFields: input.customFields ?? {},
      },
    );
  }

  async getContact(contactId: string) {
    const response = await this.request<{ contact?: ProviderContact }>(`/contacts/${contactId}`, {
      method: 'GET',
    });
    return response.contact ? fromProviderContact(response.contact) : null;
  }

  async searchContact(input: { email?: string | null; phone?: string | null }) {
    const response = await this.request<{ contacts?: ProviderContact[] }>('/contacts/search', {
      method: 'POST',
      body: {
        locationId: this.config.highLevelLocationId,
        email: normalizeHighLevelEmail(input.email),
        phone: normalizeHighLevelPhone(input.phone),
      },
    });
    return (response.contacts ?? []).map(fromProviderContact);
  }

  async addTags(contactId: string, tags: readonly string[]) {
    await this.updateTags('add', contactId, tags);
  }

  async removeTags(contactId: string, tags: readonly string[]) {
    await this.updateTags('remove', contactId, tags);
  }

  async setCustomFields(contactId: string, fields: Record<string, string | null>) {
    await this.request(`/contacts/${contactId}`, {
      method: 'PUT',
      body: { customFields: toCustomFields(fields) },
    });
  }

  async addContactToWorkflow(contactId: string, workflowId: string) {
    await this.request(`/contacts/${contactId}/workflow/${workflowId}`, { method: 'POST' });
  }

  async removeContactFromWorkflow(contactId: string, workflowId: string) {
    await this.request(`/contacts/${contactId}/workflow/${workflowId}`, { method: 'DELETE' });
  }

  async getSubscription(subscriptionId: string) {
    const response = await this.request<{ subscription?: HighLevelSubscription }>(
      `/payments/subscriptions/${subscriptionId}`,
      { method: 'GET' },
    );
    return response.subscription ?? null;
  }

  async listSubscriptions(
    input: { contactId?: string | undefined; cursor?: string | undefined } = {},
  ) {
    const params = new URLSearchParams();
    if (input.contactId) params.set('contactId', input.contactId);
    if (input.cursor) params.set('cursor', input.cursor);
    const suffix = params.size ? `?${params}` : '';
    const response = await this.request<{ subscriptions?: HighLevelSubscription[] }>(
      `/payments/subscriptions${suffix}`,
      { method: 'GET' },
    );
    return response.subscriptions ?? [];
  }

  async listTransactions(
    input: { subscriptionId?: string | undefined; cursor?: string | undefined } = {},
  ) {
    const params = new URLSearchParams();
    if (input.subscriptionId) params.set('subscriptionId', input.subscriptionId);
    if (input.cursor) params.set('cursor', input.cursor);
    const suffix = params.size ? `?${params}` : '';
    const response = await this.request<{ transactions?: HighLevelTransaction[] }>(
      `/payments/transactions${suffix}`,
      { method: 'GET' },
    );
    return response.transactions ?? [];
  }

  async getConversations(contactId: string) {
    const response = await this.request<{ conversations?: HighLevelConversation[] }>(
      `/conversations/search?contactId=${encodeURIComponent(contactId)}`,
      { method: 'GET' },
    );
    return response.conversations ?? [];
  }

  async getMessages(conversationId: string) {
    const response = await this.request<{ messages?: HighLevelMessage[] }>(
      `/conversations/${conversationId}/messages`,
      { method: 'GET' },
    );
    return response.messages ?? [];
  }

  async addHistoricalInboundMessage(input: {
    contactId: string;
    messageId: string;
    subject: string;
    occurredAt: string;
    bodyDigest: string;
    importTag: string;
    suppressAutomation: true;
  }) {
    const digest = stableDigest(input);
    await this.request('/conversations/messages', {
      method: 'POST',
      body: {
        type: 'Email',
        contactId: input.contactId,
        direction: 'inbound',
        source: 'onetime_resend_backlog_import',
        subject: input.subject,
        occurredAt: input.occurredAt,
        metadata: {
          original_message_id: input.messageId,
          body_digest: input.bodyDigest,
          import_tag: input.importTag,
          suppress_automation: true,
        },
      },
    });
    return { providerReferenceHash: digest.slice(0, 48) };
  }

  openContactUrl(contactId: string) {
    return buildHighLevelContactUrl(this.config.highLevelLocationId ?? '', contactId);
  }

  private async updateTags(type: 'add' | 'remove', contactId: string, tags: readonly string[]) {
    if (tags.length === 0) return;
    await this.request(`/contacts/bulk/tags/update/${type}`, {
      method: 'POST',
      body: { locationId: this.config.highLevelLocationId, contactIds: [contactId], tags },
    });
  }

  private async request<T>(
    path: string,
    input: { method: string; body?: unknown | undefined },
  ): Promise<T> {
    assertHighLevelProviderReady(this.config);
    const url = `${this.config.highLevelBaseUrl.replace(/\/+$/, '')}${path}`;
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.highLevelRequestTimeoutMs);
      try {
        const requestInit: RequestInit = {
          method: input.method,
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${this.config.highLevelPrivateIntegrationToken}`,
            'content-type': 'application/json',
            version: HIGHLEVEL_API_VERSION,
          },
          signal: controller.signal,
        };
        if (input.body !== undefined) requestInit.body = JSON.stringify(input.body);
        const response = await this.fetchImpl(url, requestInit);
        if (!response.ok) throw mapHighLevelHttpError(response.status);
        return (await response.json()) as T;
      } catch (error) {
        if (!shouldRetry(error, attempt, this.config.highLevelMaxRetries)) throw error;
        attempt += 1;
        await delay(Math.min(5_000, 250 * 2 ** attempt));
      } finally {
        clearTimeout(timeout);
      }
    }
  }
}

export class MockHighLevelClient implements HighLevelClient {
  readonly contacts = new Map<string, HighLevelContact>();
  readonly workflowEnrollments: Array<{ contactId: string; workflowId: string; action: string }> =
    [];

  async health() {
    return {
      ready: true,
      mode: 'mock' as const,
      blockers: [],
      tokenConfigured: false,
      locationConfigured: true,
      syncEnabled: true,
      reconciliationEnabled: true,
    };
  }

  async upsertContact(input: {
    identity: HighLevelContactIdentity;
    customFields?: Record<string, string | null> | undefined;
  }) {
    const email = normalizeHighLevelEmail(input.identity.email);
    const phone = normalizeHighLevelPhone(input.identity.phone);
    const existing = [...this.contacts.values()].find(
      (contact) => (email && contact.email === email) || (phone && contact.phone === phone),
    );
    const contact: HighLevelContact = {
      id: existing?.id ?? `mock_contact_${this.contacts.size + 1}`,
      email,
      phone,
      tags: existing?.tags ?? [],
      customFields: { ...(existing?.customFields ?? {}), ...(input.customFields ?? {}) },
    };
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async getContact(contactId: string) {
    return this.contacts.get(contactId) ?? null;
  }

  async searchContact(input: { email?: string | null; phone?: string | null }) {
    const email = normalizeHighLevelEmail(input.email);
    const phone = normalizeHighLevelPhone(input.phone);
    return [...this.contacts.values()].filter(
      (contact) => (email && contact.email === email) || (phone && contact.phone === phone),
    );
  }

  async addTags(contactId: string, tags: readonly string[]) {
    const contact = this.contacts.get(contactId);
    if (!contact) throw new Error('mock_contact_not_found');
    contact.tags = [...new Set([...contact.tags, ...tags])];
  }

  async removeTags(contactId: string, tags: readonly string[]) {
    const contact = this.contacts.get(contactId);
    if (!contact) throw new Error('mock_contact_not_found');
    contact.tags = contact.tags.filter((tag) => !tags.includes(tag));
  }

  async setCustomFields(contactId: string, fields: Record<string, string | null>) {
    const contact = this.contacts.get(contactId);
    if (!contact) throw new Error('mock_contact_not_found');
    contact.customFields = { ...(contact.customFields ?? {}), ...fields };
  }

  async addContactToWorkflow(contactId: string, workflowId: string) {
    this.workflowEnrollments.push({ contactId, workflowId, action: 'add' });
  }

  async removeContactFromWorkflow(contactId: string, workflowId: string) {
    this.workflowEnrollments.push({ contactId, workflowId, action: 'remove' });
  }

  async getSubscription(subscriptionId: string) {
    return { id: subscriptionId, contactId: 'mock_contact_1', status: 'active' };
  }

  async listSubscriptions() {
    return [{ id: 'mock_subscription_1', contactId: 'mock_contact_1', status: 'active' }];
  }

  async listTransactions() {
    return [
      {
        id: 'mock_transaction_1',
        contactId: 'mock_contact_1',
        subscriptionId: 'mock_subscription_1',
        status: 'succeeded',
        createdAt: new Date(0).toISOString(),
      },
    ];
  }

  async getConversations(contactId: string) {
    return [{ id: 'mock_conversation_1', contactId, updatedAt: new Date(0).toISOString() }];
  }

  async getMessages(conversationId: string) {
    return [{ id: 'mock_message_1', conversationId, direction: 'inbound' }];
  }

  async addHistoricalInboundMessage(input: {
    contactId: string;
    messageId: string;
    subject: string;
    occurredAt: string;
    bodyDigest: string;
    importTag: string;
    suppressAutomation: true;
  }) {
    return { providerReferenceHash: stableDigest(input).slice(0, 48) };
  }

  openContactUrl(contactId: string) {
    return buildHighLevelContactUrl('mock_location', contactId);
  }
}

type ProviderContact = {
  id?: string;
  contactId?: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  customFields?: Record<string, string | null>;
};

function fromProviderContact(contact: ProviderContact): HighLevelContact {
  return {
    id: String(contact.id ?? contact.contactId ?? ''),
    email: normalizeHighLevelEmail(contact.email),
    phone: normalizeHighLevelPhone(contact.phone),
    tags: contact.tags ?? [],
    customFields: contact.customFields ?? {},
  };
}

function toCustomFields(fields: Record<string, string | null>) {
  return Object.entries(fields).map(([key, value]) => ({ key, value }));
}

function mapHighLevelHttpError(status: number) {
  if (status === 401) return new HighLevelProviderError('highlevel_unauthorized', false, status);
  if (status === 403) return new HighLevelProviderError('highlevel_forbidden', false, status);
  if (status === 404) return new HighLevelProviderError('highlevel_not_found', false, status);
  if (status === 409) return new HighLevelProviderError('highlevel_conflict', false, status);
  if (status === 429) return new HighLevelProviderError('highlevel_rate_limited', true, status);
  if (status >= 500) return new HighLevelProviderError('highlevel_unavailable', true, status);
  return new HighLevelProviderError('highlevel_rejected', false, status);
}

function shouldRetry(error: unknown, attempt: number, maxRetries: number) {
  return error instanceof HighLevelProviderError && error.retryable && attempt < maxRetries;
}

export function buildHighLevelContactUrl(locationId: string, contactId: string) {
  const encodedLocation = encodeURIComponent(locationId);
  const encodedContact = encodeURIComponent(contactId);
  return `${HIGHLEVEL_APP_URL}/v2/location/${encodedLocation}/contacts/detail/${encodedContact}`;
}
