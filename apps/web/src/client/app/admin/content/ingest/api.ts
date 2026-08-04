import type {
  MultipartUploadPlan,
  UploadSessionRecord,
} from '../../../../../../../../packages/contracts/src/content/ingest/index.ts';

type UploadState = { version: number; completion: Promise<void> };
type BrowserUploadSession = Omit<UploadSessionRecord, 'idempotencyKey' | 'requestHash'>;

export function createContentIngestApi(input: {
  csrfToken: string;
  onProtectedStateCleared: () => void;
  fetchImpl?: typeof fetch | undefined;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const uploads = new Map<string, UploadState>();

  return {
    async beginUpload(file: File): Promise<{
      session: UploadSessionRecord;
      plan: MultipartUploadPlan;
    }> {
      const response = await privateJson<{
        data: { session: BrowserUploadSession; plan: MultipartUploadPlan };
      }>(
        fetchImpl,
        '/api/app/content/ingest/sessions',
        {
          method: 'POST',
          headers: jsonHeaders(input.csrfToken),
          body: JSON.stringify({
            file_name: file.name,
            mime_type: file.type,
            byte_count: file.size,
          }),
        },
        input.onProtectedStateCleared,
      );
      uploads.set(response.data.session.id, {
        version: response.data.session.version,
        completion: Promise.resolve(),
      });
      return {
        session: response.data.session as UploadSessionRecord,
        plan: response.data.plan,
      };
    },

    async uploadPart(request: { session: UploadSessionRecord; partNumber: number; body: Blob }) {
      const state = requireUploadState(uploads, request.session.id);
      const partSha256 = await blobDigest(request.body);
      const authorization = await privateJson<{
        data: { uploadUrl: string; requiredHeaders: Readonly<Record<string, string>> };
      }>(
        fetchImpl,
        `/api/app/content/ingest/sessions/${encodeURIComponent(request.session.id)}/parts/${request.partNumber}/authorize`,
        {
          method: 'POST',
          headers: jsonHeaders(input.csrfToken),
          body: JSON.stringify({
            expected_version: state.version,
            byte_count: request.body.size,
            part_sha256: partSha256,
          }),
        },
        input.onProtectedStateCleared,
      );
      const uploaded = await fetchImpl(authorization.data.uploadUrl, {
        method: 'PUT',
        headers: authorization.data.requiredHeaders,
        body: request.body,
      });
      if (!uploaded.ok) throw new Error('Recording part upload failed.');
      const providerPartRef =
        uploaded.headers.get('etag') ?? uploaded.headers.get('x-provider-part-ref');
      if (!providerPartRef) throw new Error('Recording part readback was missing.');

      const complete = async () => {
        const completed = await privateJson<{ data: { session: BrowserUploadSession } }>(
          fetchImpl,
          `/api/app/content/ingest/sessions/${encodeURIComponent(request.session.id)}/parts/${request.partNumber}/complete`,
          {
            method: 'POST',
            headers: jsonHeaders(input.csrfToken),
            body: JSON.stringify({
              expected_version: state.version,
              byte_count: request.body.size,
              part_sha256: partSha256,
              provider_part_ref: providerPartRef,
            }),
          },
          input.onProtectedStateCleared,
        );
        state.version = completed.data.session.version;
      };
      state.completion = state.completion.then(complete, complete);
      await state.completion;
    },

    async confirmUpload(session: UploadSessionRecord) {
      const state = requireUploadState(uploads, session.id);
      await state.completion;
      await privateJson(
        fetchImpl,
        `/api/app/content/ingest/sessions/${encodeURIComponent(session.id)}/confirm`,
        {
          method: 'POST',
          headers: jsonHeaders(input.csrfToken),
          body: JSON.stringify({
            expected_version: state.version,
            idempotency_key: await browserDigest(`content-confirm\0${session.id}`),
          }),
        },
        input.onProtectedStateCleared,
      );
      uploads.delete(session.id);
    },
  };
}

function requireUploadState(states: Map<string, UploadState>, uploadSessionId: string) {
  const state = states.get(uploadSessionId);
  if (!state) throw new Error('Recording upload session is unavailable.');
  return state;
}

async function privateJson<T>(
  fetchImpl: typeof fetch,
  path: string,
  init: RequestInit,
  onProtectedStateCleared: () => void,
): Promise<T> {
  const response = await fetchImpl(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  if (response.status === 401) onProtectedStateCleared();
  if (!response.ok) {
    throw new Error(
      body.code === 'content_media_default_off'
        ? 'Recording intake is not enabled.'
        : (body.message ?? 'Recording intake request failed.'),
    );
  }
  return body as T;
}

function jsonHeaders(csrfToken: string) {
  return {
    accept: 'application/json',
    'cache-control': 'no-store',
    'content-type': 'application/json',
    pragma: 'no-cache',
    'x-csrf-token': csrfToken,
  };
}

async function blobDigest(blob: Blob) {
  return bytesDigest(await blob.arrayBuffer());
}

async function browserDigest(value: string) {
  return bytesDigest(new TextEncoder().encode(value));
}

async function bytesDigest(value: BufferSource) {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
