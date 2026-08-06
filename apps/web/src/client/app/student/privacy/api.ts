import type { PrivacyPolicyVersions } from '../../../../../../../packages/contracts/src/privacy/index.ts';
import type {
  PrivacyConsentView,
  PrivacyRequestView,
} from '../../parent/privacy/PrivacyDataRightsPanel.tsx';

export type StudentPrivacySnapshot = {
  policy_versions: PrivacyPolicyVersions;
  student: {
    student_id: string;
    display_name: string;
    relationship: 'self';
    consents: readonly PrivacyConsentView[];
  };
  requests: readonly PrivacyRequestView[];
  export_disclosure: { included: readonly string[]; excluded: readonly string[] };
};

export class StudentPrivacyApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'StudentPrivacyApiError';
  }
}

export function createStudentPrivacyApi(
  input: { fetcher?: typeof fetch; basePath?: string; idempotencyKey?: () => string } = {},
) {
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const basePath = input.basePath ?? '/api/app/student/privacy';
  const nextIdempotencyKey = input.idempotencyKey ?? browserIdempotencyKey;

  async function read(response: Response) {
    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
      const code =
        isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'REQUEST_FAILED';
      const message =
        isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : 'The Student privacy request could not be completed.';
      throw new StudentPrivacyApiError(code, message, response.status);
    }
    return payload.data as StudentPrivacySnapshot & {
      snapshot?: StudentPrivacySnapshot;
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
    if (!data.snapshot) throw new Error('The refreshed Student privacy snapshot is unavailable.');
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
      if (!data.csrf_token) throw new Error('Student privacy CSRF proof is unavailable.');
      return {
        snapshot: {
          policy_versions: data.policy_versions,
          student: data.student,
          requests: data.requests,
          export_disclosure: data.export_disclosure,
        },
        csrf_token: data.csrf_token,
      };
    },
    changeConsent(
      input: { scope: 'recording_participation' | 'member_recognition'; grant: boolean },
      csrfToken: string,
    ) {
      return mutate('/consents', input, csrfToken);
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
    return `student-privacy-${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  const encoded = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  if (!encoded || /^0+$/u.test(encoded)) {
    throw new Error('Secure browser randomness is required for Student privacy requests.');
  }
  return `student-privacy-${encoded}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
