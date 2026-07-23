import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { ContentFactoryError } from './content-factory.ts';

const LOCATOR = /^volume:v1:([0-9a-f-]{36})$/;
const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
]);

export type DurableContentFactoryObject = {
  displayName: string;
  mimeType: string;
  byteLength: number;
  sourceSha256: string;
  storageLocator: string;
  privateRefDigest: string;
};

export class VolumeContentFactoryStorage {
  readonly driver = 'volume' as const;
  private readonly objectsDirectory: string;

  constructor(
    private readonly root: string,
    private readonly maxBytes: number,
  ) {
    if (!path.isAbsolute(root)) {
      throw new Error('CONTENT_FACTORY_STORAGE_ROOT must be an absolute mounted path.');
    }
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new Error('CONTENT_FACTORY_MAX_UPLOAD_BYTES must be a positive integer.');
    }
    this.objectsDirectory = path.join(path.resolve(root), 'objects');
  }

  async stage(input: {
    stream: Readable | AsyncIterable<Buffer | Uint8Array | string>;
    displayName: string;
    declaredMimeType: string;
    declaredLength?: number;
  }): Promise<DurableContentFactoryObject> {
    const displayName = validateDisplayName(input.displayName);
    const mimeType = validateMime(input.declaredMimeType);
    if (input.declaredLength && input.declaredLength > this.maxBytes) {
      throw new ContentFactoryError(
        'VALIDATION_ERROR',
        'Video exceeds the protected upload limit.',
      );
    }
    await mkdir(this.objectsDirectory, { recursive: true, mode: 0o700 });
    const token = randomUUID();
    const temporaryPath = this.objectPath(token, true);
    const finalPath = this.objectPath(token, false);
    const file = await open(temporaryPath, 'wx', 0o600);
    const digest = createHash('sha256');
    const signature = Buffer.alloc(16);
    let signatureLength = 0;
    let byteLength = 0;
    let closed = false;
    try {
      for await (const value of input.stream) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        byteLength += chunk.length;
        if (byteLength > this.maxBytes) {
          throw new ContentFactoryError(
            'VALIDATION_ERROR',
            'Video exceeds the protected upload limit.',
          );
        }
        if (signatureLength < signature.length) {
          const copyLength = Math.min(chunk.length, signature.length - signatureLength);
          chunk.copy(signature, signatureLength, 0, copyLength);
          signatureLength += copyLength;
        }
        digest.update(chunk);
        await file.write(chunk);
      }
      if (byteLength < 16) {
        throw new ContentFactoryError('VALIDATION_ERROR', 'Choose a valid, non-empty video file.');
      }
      assertVideoSignature(signature, mimeType);
      await file.sync();
      await file.close();
      closed = true;
      await rename(temporaryPath, finalPath);
      await chmod(finalPath, 0o600).catch(() => undefined);
      const storageLocator = `volume:v1:${token}`;
      const sourceSha256 = digest.digest('hex');
      return {
        displayName,
        mimeType,
        byteLength,
        sourceSha256,
        storageLocator,
        privateRefDigest: sha256(`${storageLocator}\0${sourceSha256}`),
      };
    } catch (error) {
      if (!closed) await file.close().catch(() => undefined);
      await unlink(temporaryPath).catch(() => undefined);
      await unlink(finalPath).catch(() => undefined);
      throw error;
    }
  }

  async inspect(locator: string) {
    const objectPath = this.resolve(locator);
    const details = await stat(objectPath);
    if (!details.isFile() || details.size < 1) {
      throw new ContentFactoryError('VALIDATION_ERROR', 'Private source object is unavailable.');
    }
    return { byteLength: details.size, objectPath };
  }

  async remove(locator: string) {
    await unlink(this.resolve(locator)).catch(() => undefined);
  }

  resolve(locator: string) {
    const match = LOCATOR.exec(locator);
    if (!match) {
      throw new ContentFactoryError('VALIDATION_ERROR', 'Private source locator is invalid.');
    }
    return this.objectPath(match[1]!, false);
  }

  private objectPath(token: string, temporary: boolean) {
    const candidate = path.join(
      this.objectsDirectory,
      `${token}${temporary ? '.partial' : '.media'}`,
    );
    const resolved = path.resolve(candidate);
    const root = `${path.resolve(this.objectsDirectory)}${path.sep}`;
    if (!resolved.startsWith(root)) {
      throw new ContentFactoryError('VALIDATION_ERROR', 'Private source locator is invalid.');
    }
    return resolved;
  }
}

export function contentFactoryStorageFromEnv(source: NodeJS.ProcessEnv = process.env) {
  const driver = source.CONTENT_FACTORY_STORAGE_DRIVER ?? 'volume';
  if (driver !== 'volume') {
    throw new Error('CONTENT_FACTORY_STORAGE_DRIVER must be volume in this deployment.');
  }
  const root = source.CONTENT_FACTORY_STORAGE_ROOT;
  if (!root) throw new Error('CONTENT_FACTORY_STORAGE_ROOT is required.');
  const maxBytes = Number(source.CONTENT_FACTORY_MAX_UPLOAD_BYTES ?? 2_147_483_648);
  return new VolumeContentFactoryStorage(root, maxBytes);
}

function validateDisplayName(value: string) {
  const name = value.normalize('NFKC').trim();
  if (
    !name ||
    name.length > 240 ||
    name !== path.basename(name) ||
    /[\\/\0]/.test(name) ||
    /\.(?:exe|com|bat|cmd|msi|ps1|sh|js|jar|dll|xlsx?|csv|ods)$/i.test(name)
  ) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Choose a supported video file.');
  }
  return name;
}

function validateMime(value: string) {
  const mimeType = value.split(';')[0]!.trim().toLowerCase();
  if (!VIDEO_TYPES.has(mimeType)) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Choose a supported video MIME type.');
  }
  return mimeType;
}

function assertVideoSignature(signature: Buffer, mimeType: string) {
  const mp4 = signature.subarray(4, 8).toString('ascii') === 'ftyp';
  const webm = signature.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const avi =
    signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
    signature.subarray(8, 12).toString('ascii') === 'AVI ';
  const valid =
    mimeType === 'video/x-msvideo'
      ? avi
      : mimeType.includes('webm') || mimeType.includes('matroska')
        ? webm
        : mp4;
  if (
    !valid ||
    signature.subarray(0, 2).toString('ascii') === 'MZ' ||
    signature.subarray(0, 2).toString('ascii') === 'PK'
  ) {
    throw new ContentFactoryError(
      'VALIDATION_ERROR',
      'File contents do not match the selected video type.',
    );
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
