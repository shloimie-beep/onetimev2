import { createSign } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeLearningDeliveryDriveFile,
  learningDeliverySha256Hex,
} from './learning-delivery.ts';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);

type FetchLike = typeof fetch;

export type LearningDeliveryPrivateInput = {
  sourceKind: 'drive' | 'local_drop';
  privatePath: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  sourceSha256: string;
  sourceRefDigest: string;
  rawUrlPresent: false;
};

export function inspectLearningDeliveryInputAdapters(input: {
  driveFolderIdPresent: boolean;
  driveServiceAccountPresent: boolean;
}) {
  const missing = [
    ...(input.driveFolderIdPresent ? [] : ['GOOGLE_DRIVE_FOLDER_ID']),
    ...(input.driveServiceAccountPresent ? [] : ['GOOGLE_DRIVE_SERVICE_ACCOUNT']),
  ];
  return {
    inputAdapter: missing.length === 0 ? ('DRIVE' as const) : ('LOCAL_DROP' as const),
    adapters: {
      drive: { ready: missing.length === 0, missing },
      local_drop: { ready: true as const, private_copy_required: true as const },
    },
  };
}

export async function stageLearningDeliveryLocalDrop(input: {
  sourcePath: string;
  privateDirectory: string;
}): Promise<LearningDeliveryPrivateInput> {
  const sourcePath = await realpath(input.sourcePath);
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.size < 1) {
    throw new Error('learning_delivery_local_drop_invalid_source');
  }
  const extension = path.extname(sourcePath).toLowerCase();
  if (!VIDEO_EXTENSIONS.has(extension)) {
    throw new Error('learning_delivery_local_drop_unsupported_extension');
  }
  const privateDirectory = path.resolve(input.privateDirectory);
  await mkdir(privateDirectory, { recursive: true });
  const sourceSha256 = learningDeliverySha256Hex(await readFile(sourcePath));
  const displayName = path.basename(sourcePath);
  const privatePath = path.join(
    privateDirectory,
    `${sourceSha256.slice(0, 20)}${extension || '.mp4'}`,
  );
  if (path.resolve(privatePath).startsWith(`${privateDirectory}${path.sep}`) === false) {
    throw new Error('learning_delivery_local_drop_private_path_escape');
  }
  await copyFile(sourcePath, privatePath);
  try {
    await chmod(privatePath, 0o600);
  } catch {
    // Windows ACLs remain inherited from the private operator directory.
  }
  return {
    sourceKind: 'local_drop',
    privatePath,
    displayName,
    mimeType: mimeTypeForExtension(extension),
    sizeBytes: sourceStat.size,
    sourceSha256,
    sourceRefDigest: learningDeliverySha256Hex(`local_drop\0${sourceSha256}`),
    rawUrlPresent: false,
  };
}

type DriveServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  modifiedTime?: string;
};

export function createLearningDeliveryDriveInputAdapter(input: {
  folderId: string;
  serviceAccount?: DriveServiceAccount;
  accessToken?: string;
  fetchImpl?: FetchLike;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!input.folderId.trim()) throw new Error('learning_delivery_drive_folder_required');
  if (!input.accessToken && !input.serviceAccount) {
    throw new Error('learning_delivery_drive_credentials_required');
  }

  async function token() {
    if (input.accessToken) return input.accessToken;
    return serviceAccountAccessToken(input.serviceAccount!, fetchImpl);
  }

  return {
    async listIncomingVideos() {
      const query = `'${input.folderId.replaceAll("'", "\\'")}' in parents and trashed = false`;
      const url = new URL(`${DRIVE_API}/files`);
      url.searchParams.set('q', query);
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('fields', 'files(id,name,mimeType,size,md5Checksum,modifiedTime)');
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!response.ok) throw new Error(`learning_delivery_drive_list_${response.status}`);
      const payload = (await response.json()) as { files?: DriveFile[] };
      return (payload.files ?? []).flatMap((file) => {
        const normalized = normalizeLearningDeliveryDriveFile({
          providerFileId: file.id,
          parentFolderId: input.folderId,
          displayName: file.name,
          mimeType: file.mimeType,
          sizeBytes: Number(file.size ?? 0),
          providerMd5Checksum: file.md5Checksum ?? null,
          modifiedAt: file.modifiedTime ?? null,
        });
        return normalized.accepted
          ? [
              {
                privateProviderFileId: file.id,
                metadata: normalized.metadata,
                sourceRefDigest: normalized.sourceRefDigest,
              },
            ]
          : [];
      });
    },

    async downloadPrivately(inputFile: {
      privateProviderFileId: string;
      displayName: string;
      mimeType: string;
      privateDirectory: string;
    }): Promise<LearningDeliveryPrivateInput> {
      const response = await fetchImpl(
        `${DRIVE_API}/files/${encodeURIComponent(inputFile.privateProviderFileId)}?alt=media`,
        { headers: { Authorization: `Bearer ${await token()}` } },
      );
      if (!response.ok) throw new Error(`learning_delivery_drive_download_${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1) throw new Error('learning_delivery_drive_empty_download');
      const privateDirectory = path.resolve(inputFile.privateDirectory);
      await mkdir(privateDirectory, { recursive: true });
      const sourceSha256 = learningDeliverySha256Hex(bytes);
      const extension = safeDriveExtension(inputFile.displayName, inputFile.mimeType);
      const privatePath = path.join(privateDirectory, `${sourceSha256.slice(0, 20)}${extension}`);
      await writeFile(privatePath, bytes, { mode: 0o600 });
      return {
        sourceKind: 'drive',
        privatePath,
        displayName: path.basename(inputFile.displayName),
        mimeType: inputFile.mimeType,
        sizeBytes: bytes.length,
        sourceSha256,
        sourceRefDigest: learningDeliverySha256Hex(
          `drive\0${inputFile.privateProviderFileId}\0${sourceSha256}`,
        ),
        rawUrlPresent: false,
      };
    },
  };
}

async function serviceAccountAccessToken(account: DriveServiceAccount, fetchImpl: FetchLike) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: DRIVE_SCOPE,
      aud: account.token_uri ?? GOOGLE_TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3_300,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(account.private_key))}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetchImpl(account.token_uri ?? GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`learning_delivery_drive_oauth_${response.status}`);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error('learning_delivery_drive_oauth_token_missing');
  return payload.access_token;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function safeDriveExtension(displayName: string, mimeType: string) {
  const extension = path.extname(path.basename(displayName)).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return extension;
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/webm') return '.webm';
  return '.mp4';
}

function mimeTypeForExtension(extension: string) {
  if (extension === '.mov') return 'video/quicktime';
  if (extension === '.webm') return 'video/webm';
  if (extension === '.avi') return 'video/x-msvideo';
  if (extension === '.mkv') return 'video/x-matroska';
  return 'video/mp4';
}
