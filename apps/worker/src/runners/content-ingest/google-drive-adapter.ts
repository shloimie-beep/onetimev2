import type { DriveIngestProvider, DriveProviderFile } from './runner.ts';

export const GOOGLE_DRIVE_CONTENT_INGEST_REGISTRY_KEY =
  'google_drive_content_ingest_optional' as const;

export type GoogleDriveIdentityReadback = {
  registryBindingKey: typeof GOOGLE_DRIVE_CONTENT_INGEST_REGISTRY_KEY;
  providerAccountRefHash: string;
  serviceAccountRefHash: string;
  registeredIncomingFolderIdHash: string;
  observedAt: string;
};

export interface GoogleDriveContentClient {
  readIdentity(): Promise<GoogleDriveIdentityReadback>;
  listPage(input: {
    registeredIncomingFolderId: string;
    pageToken?: string;
  }): Promise<{ files: readonly DriveProviderFile[]; nextPageToken?: string }>;
  openRange(input: {
    fileId: string;
    start: number;
    endExclusive: number;
    expectedChangeMarker: string;
  }): AsyncIterable<Uint8Array>;
}

/** Optional/nonblocking Drive intake. A missing adapter never affects direct app upload. */
export class GoogleDriveContentIngestAdapter implements DriveIngestProvider {
  constructor(
    private readonly enabled: boolean,
    private readonly registeredIncomingFolderId: string | undefined,
    private readonly client: GoogleDriveContentClient | null,
  ) {}

  async readCanonicalIdentity() {
    const client = this.requireClient();
    const identity = await client.readIdentity();
    if (
      identity.registryBindingKey !== GOOGLE_DRIVE_CONTENT_INGEST_REGISTRY_KEY ||
      !sha256(identity.providerAccountRefHash) ||
      !sha256(identity.serviceAccountRefHash) ||
      !sha256(identity.registeredIncomingFolderIdHash)
    ) {
      throw new Error('content_drive_identity_readback_mismatch');
    }
    return identity;
  }

  async listPage(input: { registeredIncomingFolderId: string; pageToken?: string }) {
    if (input.registeredIncomingFolderId !== this.registeredIncomingFolderId) {
      throw new Error('content_drive_folder_binding_mismatch');
    }
    await this.readCanonicalIdentity();
    return this.requireClient().listPage(input);
  }

  openRange(input: {
    fileId: string;
    start: number;
    endExclusive: number;
    expectedChangeMarker: string;
  }) {
    return this.requireClient().openRange(input);
  }

  private requireClient() {
    if (!this.enabled || !this.registeredIncomingFolderId || !this.client) {
      throw new Error('content_drive_provider_off');
    }
    return this.client;
  }
}

function sha256(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}
