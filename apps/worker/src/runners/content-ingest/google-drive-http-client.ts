import { createHash, createSign } from 'node:crypto';

import type { DriveProviderFile } from './runner.ts';
import {
  GOOGLE_DRIVE_CONTENT_INGEST_REGISTRY_KEY,
  type GoogleDriveContentClient,
} from './google-drive-adapter.ts';

export interface GoogleDriveRegistryGuard {
  read(): Promise<{ providerAccountRefHash: string; observedAt: string }>;
}

export type GoogleDriveAccessTokenProvider = () => Promise<string>;

export class GoogleDriveHttpClient implements GoogleDriveContentClient {
  constructor(
    private readonly config: {
      folderId: string;
      serviceAccountEmail: string;
      timeoutMs: number;
    },
    private readonly accessToken: GoogleDriveAccessTokenProvider,
    private readonly registry: GoogleDriveRegistryGuard,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async readIdentity() {
    const registry = await this.registry.read();
    const [about, folder] = await Promise.all([
      this.requestJson<{ user?: { permissionId?: string; emailAddress?: string } }>(
        'https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress)',
      ),
      this.requestJson<{ id?: string; mimeType?: string; trashed?: boolean }>(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.config.folderId)}?fields=id,mimeType,trashed&supportsAllDrives=true`,
      ),
    ]);
    const accountRefHash = digestRequired(about.user?.permissionId);
    const serviceAccountRefHash = digestRequired(
      about.user?.emailAddress ?? this.config.serviceAccountEmail,
    );
    const folderHash = digest(this.config.folderId);
    if (
      registry.providerAccountRefHash !== accountRefHash ||
      folder.id !== this.config.folderId ||
      folder.mimeType !== 'application/vnd.google-apps.folder' ||
      folder.trashed === true
    ) {
      throw new Error('content_drive_identity_readback_mismatch');
    }
    return {
      registryBindingKey: GOOGLE_DRIVE_CONTENT_INGEST_REGISTRY_KEY,
      providerAccountRefHash: accountRefHash,
      serviceAccountRefHash,
      registeredIncomingFolderIdHash: folderHash,
      observedAt: this.clock().toISOString(),
    };
  }

  async listPage(input: { registeredIncomingFolderId: string; pageToken?: string }) {
    if (input.registeredIncomingFolderId !== this.config.folderId) {
      throw new Error('content_drive_folder_binding_mismatch');
    }
    await this.readIdentity();
    const query = new URLSearchParams({
      q: `'${escapeDriveQuery(this.config.folderId)}' in parents and trashed = false`,
      fields:
        'nextPageToken,files(id,name,mimeType,size,version,md5Checksum,modifiedTime,parents,trashed)',
      pageSize: '2',
      orderBy: 'modifiedTime desc,name',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (input.pageToken) query.set('pageToken', input.pageToken);
    const page = await this.requestJson<{
      files?: readonly DriveFileJson[];
      nextPageToken?: string;
    }>(`https://www.googleapis.com/drive/v3/files?${query.toString()}`);
    const files = (page.files ?? []).map((file) => driveFile(file, this.config.folderId));
    return {
      files,
      ...(page.nextPageToken ? { nextPageToken: page.nextPageToken } : {}),
    };
  }

  async *openRange(input: {
    fileId: string;
    start: number;
    endExclusive: number;
    expectedChangeMarker: string;
  }): AsyncIterable<Uint8Array> {
    await this.readIdentity();
    const metadata = await this.requestJson<DriveFileJson>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,size,version,md5Checksum,modifiedTime,parents,trashed&supportsAllDrives=true`,
    );
    const file = driveFile(metadata, this.config.folderId);
    if (
      file.changeMarker !== input.expectedChangeMarker ||
      input.start < 0 ||
      input.endExclusive <= input.start ||
      input.endExclusive > file.byteCount
    ) {
      throw new Error('content_drive_range_binding_mismatch');
    }
    const token = await this.accessToken();
    const response = await fetchWithTimeout(
      this.fetchImpl,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?alt=media&supportsAllDrives=true`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          range: `bytes=${input.start}-${input.endExclusive - 1}`,
        },
      },
      this.config.timeoutMs,
    );
    const expectedLength = input.endExclusive - input.start;
    if (
      response.status !== 206 ||
      !response.body ||
      response.headers.get('content-range') !==
        `bytes ${input.start}-${input.endExclusive - 1}/${file.byteCount}` ||
      response.headers.get('content-length') !== String(expectedLength)
    ) {
      throw new Error('content_drive_range_readback_failed');
    }
    const reader = response.body.getReader();
    let receivedByteCount = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (chunk.value.byteLength > 0) {
          receivedByteCount += chunk.value.byteLength;
          if (receivedByteCount > expectedLength) {
            throw new Error('content_drive_range_readback_failed');
          }
          yield chunk.value;
        }
      }
      if (receivedByteCount !== expectedLength) {
        throw new Error('content_drive_range_readback_failed');
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async requestJson<T>(url: string): Promise<T> {
    const token = await this.accessToken();
    const response = await fetchWithTimeout(
      this.fetchImpl,
      url,
      { method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' } },
      this.config.timeoutMs,
    );
    if (!response.ok) throw new Error('content_drive_read_failed');
    return (await response.json()) as T;
  }
}

export function createGoogleServiceAccountTokenProvider(input: {
  serviceAccountJson: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch | undefined;
  clock?: (() => Date) | undefined;
}): { serviceAccountEmail: string; accessToken: GoogleDriveAccessTokenProvider } {
  const credentials = parseServiceAccount(input.serviceAccountJson);
  const fetchImpl = input.fetchImpl ?? fetch;
  const clock = input.clock ?? (() => new Date());
  return {
    serviceAccountEmail: credentials.client_email,
    accessToken: async () => {
      const issuedAt = Math.floor(clock().getTime() / 1_000);
      const assertion = signJwt(
        {
          alg: 'RS256',
          typ: 'JWT',
        },
        {
          iss: credentials.client_email,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          aud: credentials.token_uri,
          iat: issuedAt,
          exp: issuedAt + 3_600,
        },
        credentials.private_key,
      );
      const response = await fetchWithTimeout(
        fetchImpl,
        credentials.token_uri,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
          }),
        },
        input.timeoutMs,
      );
      const body = (await response.json().catch(() => ({}))) as { access_token?: string };
      if (!response.ok || !body.access_token)
        throw new Error('content_drive_authentication_failed');
      return body.access_token;
    },
  };
}

type DriveFileJson = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  version?: string;
  md5Checksum?: string;
  modifiedTime?: string;
  parents?: readonly string[];
  trashed?: boolean;
};

function driveFile(file: DriveFileJson, folderId: string): DriveProviderFile {
  const byteCount = Number(file.size);
  if (
    !file.id ||
    !file.name ||
    !file.mimeType ||
    !Number.isSafeInteger(byteCount) ||
    byteCount < 1 ||
    file.trashed === true ||
    file.parents?.length !== 1 ||
    file.parents[0] !== folderId
  ) {
    throw new Error('content_drive_file_readback_invalid');
  }
  return {
    fileId: file.id,
    parentFolderId: folderId,
    displayFilename: file.name,
    mimeType: file.mimeType,
    byteCount,
    changeMarker: digest(
      [file.version ?? '', file.md5Checksum ?? '', file.modifiedTime ?? '', file.size].join('\0'),
    ),
  };
}

function parseServiceAccount(value: string) {
  const parsed = JSON.parse(value) as Partial<{
    client_email: string;
    private_key: string;
    token_uri: string;
  }>;
  if (
    !parsed.client_email ||
    !parsed.private_key ||
    parsed.token_uri !== 'https://oauth2.googleapis.com/token'
  ) {
    throw new Error('content_drive_service_account_invalid');
  }
  return parsed as { client_email: string; private_key: string; token_uri: string };
}

function signJwt(header: object, payload: object, privateKey: string) {
  const content = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(content);
  signer.end();
  return `${content}.${signer.sign(privateKey, 'base64url')}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function digestRequired(value: string | undefined) {
  if (!value) throw new Error('content_drive_live_identity_unavailable');
  return digest(value);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeDriveQuery(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
