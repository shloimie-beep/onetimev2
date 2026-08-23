import type { PrivacyPolicyVersions } from '../../../../../../../packages/contracts/src/privacy/index.ts';
import type { PrivacyConsentView, PrivacyRequestView } from './PrivacyDataRightsPanel.tsx';

export type ParentPrivacyStudentView = {
  student_id: string;
  display_name: string;
  relationship: 'self' | 'dependent';
  state: 'active' | 'archived';
  consents: readonly PrivacyConsentView[];
};

export type ParentPrivacySnapshot = {
  policy_versions: PrivacyPolicyVersions;
  students: readonly ParentPrivacyStudentView[];
  requests: readonly PrivacyRequestView[];
  export_disclosure: { included: readonly string[]; excluded: readonly string[] };
};

export class ParentPrivacyApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParentPrivacyApiError';
  }
}

export function createParentPrivacyApi(
  input: { fetcher?: typeof fetch; basePath?: string; idempotencyKey?: () => string } = {},
) {
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const basePath = input.basePath ?? '/api/app/parent/privacy';
  const nextIdempotencyKey = input.idempotencyKey ?? browserIdempotencyKey;

  async function read(response: Response) {
    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
      const code =
        isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'REQUEST_FAILED';
      const message =
        isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : 'The privacy request could not be completed.';
      throw new ParentPrivacyApiError(code, message, response.status);
    }
    return payload.data as ParentPrivacySnapshot & {
      snapshot?: ParentPrivacySnapshot;
      csrf_token?: string;
    };
  }

  async function mutate(path: string, body: unknown, csrfToken: string) {
    const data = await read(
      await fetcher(`${basePath}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-idempotency-key': nextIdempotencyKey(),
        },
        body: JSON.stringify(body),
      }),
    );
    if (!data.snapshot) throw new Error('The refreshed privacy snapshot is unavailable.');
    return data.snapshot;
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
      if (!data.csrf_token) throw new Error('Parent privacy CSRF proof is unavailable.');
      return {
        snapshot: {
          policy_versions: data.policy_versions,
          students: data.students,
          requests: data.requests,
          export_disclosure: data.export_disclosure,
        },
        csrf_token: data.csrf_token,
      };
    },
    changeConsent(
      input: { studentId: string; scope: PrivacyConsentView['scope']; grant: boolean },
      csrfToken: string,
    ) {
      return mutate(
        '/consents',
        { student_id: input.studentId, scope: input.scope, grant: input.grant },
        csrfToken,
      );
    },
    createRequest(
      input: { kind: PrivacyRequestView['kind']; currentPassword: string },
      csrfToken: string,
    ) {
      return mutate(
        '/requests',
        { kind: input.kind, current_password: input.currentPassword },
        csrfToken,
      );
    },
  };
}

function browserIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `privacy-${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  const encoded = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  if (!encoded || /^0+$/u.test(encoded)) {
    throw new Error('Secure browser randomness is required for privacy requests.');
  }
  return `privacy-${encoded}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
