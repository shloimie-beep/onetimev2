export type ParentPreferencesSnapshot = {
  household_id: string;
  time_zone: string;
  portal_class_reminders: boolean;
  email_class_reminders: boolean;
  whatsapp_class_reminders: false;
  whatsapp_available: false;
  parent_newsletter_consent: boolean;
  newsletter_consent_policy_version: string;
  newsletter_consent_recorded_at: string | null;
  active_student_count: number;
  revision: number;
  updated_at: string;
};

export class ParentPreferencesApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParentPreferencesApiError';
  }
}

export function createParentPreferencesApi(
  input: { fetcher?: typeof fetch; basePath?: string; idempotencyKey?: () => string } = {},
) {
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const basePath = input.basePath ?? '/api/app/parent/preferences';
  const nextIdempotencyKey = input.idempotencyKey ?? browserIdempotencyKey;

  async function read(response: Response) {
    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
      const code =
        isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'REQUEST_FAILED';
      const message =
        isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : 'Parent preferences could not be completed.';
      throw new ParentPreferencesApiError(code, message, response.status);
    }
    return payload.data as { snapshot: ParentPreferencesSnapshot; csrf_token?: string };
  }

  return {
    async load() {
      const data = await read(
        await fetcher(basePath, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }),
      );
      if (!data.csrf_token) throw new Error('Parent preference CSRF proof is unavailable.');
      return { snapshot: data.snapshot, csrf_token: data.csrf_token };
    },
    async update(snapshot: ParentPreferencesSnapshot, csrfToken: string) {
      const data = await read(
        await fetcher(basePath, {
          method: 'PATCH',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': csrfToken,
            'x-idempotency-key': nextIdempotencyKey(),
          },
          body: JSON.stringify({
            time_zone: snapshot.time_zone,
            portal_class_reminders: snapshot.portal_class_reminders,
            email_class_reminders: snapshot.email_class_reminders,
            parent_newsletter_consent: snapshot.parent_newsletter_consent,
            expected_revision: snapshot.revision,
          }),
        }),
      );
      return data.snapshot;
    },
  };
}

function browserIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `preferences-${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  const encoded = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  if (!encoded || /^0+$/u.test(encoded)) {
    throw new Error('Secure browser randomness is required for preference updates.');
  }
  return `preferences-${encoded}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
