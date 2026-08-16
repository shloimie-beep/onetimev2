import type {
  CreateParentStudentCommand,
  ParentHouseholdMutationResponse,
  ParentHouseholdSnapshot,
  ParentStudentLifecycleCommand,
  ResetParentStudentCredentialCommand,
  UpdateParentStudentCommand,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import type { ParentSummarySnapshot } from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';
import type {
  ParentWelcomeEventCommand,
  ParentWelcomeEventResult,
  ParentWelcomePlaybackDescriptor,
  ParentWelcomeVideoReady,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';

export type ParentHouseholdBootstrap = {
  snapshot: ParentHouseholdSnapshot;
  csrf_token: string;
};

export type ParentSummaryBootstrap = {
  snapshot: ParentSummarySnapshot;
  csrf_token: string;
};

export class ParentHouseholdApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParentHouseholdApiError';
  }
}

export function createParentHouseholdApi(
  input: {
    fetcher?: typeof fetch;
    basePath?: string;
    idempotencyKey?: () => string;
  } = {},
) {
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const basePath = input.basePath ?? '/api/app/parent';
  const nextIdempotencyKey = input.idempotencyKey ?? browserIdempotencyKey;

  async function read<T>(response: Response): Promise<T> {
    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || payload.success !== true || !('data' in payload)) {
      const code =
        isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'REQUEST_FAILED';
      const message =
        isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : 'The Parent request could not be completed.';
      throw new ParentHouseholdApiError(code, message, response.status);
    }
    return payload.data as T;
  }

  async function mutate<TBody>(
    path: string,
    method: 'POST' | 'PATCH',
    body: TBody,
    csrfToken: string,
    idempotencyKey = nextIdempotencyKey(),
  ) {
    return read<ParentHouseholdMutationResponse>(
      await fetcher(`${basePath}${path}`, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(body),
      }),
    );
  }

  return {
    async load() {
      return read<ParentHouseholdBootstrap>(
        await fetcher(`${basePath}/household`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }),
      );
    },

    async loadSummary() {
      return read<ParentSummaryBootstrap>(
        await fetcher(`${basePath}/summary`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }),
      );
    },

    async loadWelcomePlayback(path: ParentWelcomeVideoReady['playback_descriptor_path']) {
      if (!/^\/api\/app\/parent\/welcome-video\/[A-Za-z0-9._%:-]+\/playback$/u.test(path)) {
        throw new ParentHouseholdApiError(
          'PARENT_WELCOME_PATH_INVALID',
          'Welcome video unavailable.',
          400,
        );
      }
      return read<{ descriptor: ParentWelcomePlaybackDescriptor }>(
        await fetcher(path, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }),
      );
    },

    async recordWelcomeEvent(
      command: ParentWelcomeEventCommand,
      csrfToken: string,
      idempotencyKey = nextIdempotencyKey(),
    ) {
      return read<ParentWelcomeEventResult>(
        await fetcher(`${basePath}/welcome-video/events`, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: true,
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': csrfToken,
            'x-idempotency-key': idempotencyKey,
          },
          body: JSON.stringify(command),
        }),
      );
    },

    createStudent(command: CreateParentStudentCommand, csrfToken: string, idempotencyKey?: string) {
      return mutate('/students', 'POST', command, csrfToken, idempotencyKey);
    },

    updateStudent(command: UpdateParentStudentCommand, csrfToken: string, idempotencyKey?: string) {
      const { student_id: studentId, ...body } = command;
      return mutate(
        `/students/${encodeURIComponent(studentId)}`,
        'PATCH',
        body,
        csrfToken,
        idempotencyKey,
      );
    },

    archiveStudent(
      command: ParentStudentLifecycleCommand,
      csrfToken: string,
      idempotencyKey?: string,
    ) {
      const { student_id: studentId, ...body } = command;
      return mutate(
        `/students/${encodeURIComponent(studentId)}/archive`,
        'POST',
        body,
        csrfToken,
        idempotencyKey,
      );
    },

    restoreStudent(
      command: ParentStudentLifecycleCommand,
      csrfToken: string,
      idempotencyKey?: string,
    ) {
      const { student_id: studentId, ...body } = command;
      return mutate(
        `/students/${encodeURIComponent(studentId)}/restore`,
        'POST',
        body,
        csrfToken,
        idempotencyKey,
      );
    },

    resetStudentCredential(
      command: ResetParentStudentCredentialCommand,
      csrfToken: string,
      idempotencyKey?: string,
    ) {
      const { student_id: studentId, ...body } = command;
      return mutate(
        `/students/${encodeURIComponent(studentId)}/credential-reset`,
        'POST',
        body,
        csrfToken,
        idempotencyKey,
      );
    },
  };
}

export type ParentHouseholdApi = ReturnType<typeof createParentHouseholdApi>;

function browserIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `parent-${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  const encoded = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  if (!encoded || /^0+$/u.test(encoded)) {
    throw new Error('Secure browser randomness is required for Parent mutations.');
  }
  return `parent-${encoded}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
