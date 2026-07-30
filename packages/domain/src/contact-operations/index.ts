import { createHash } from 'node:crypto';

const UNSAFE = /(?:https?:\/\/|bearer|token|password|secret)/iu;

export function adminDirectorySha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalAdminDirectoryJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalAdminDirectoryJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalAdminDirectoryJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalAdminDirectoryRequestHash(value: unknown) {
  return adminDirectorySha256(canonicalAdminDirectoryJson(value));
}

export function safeDirectoryLabel(value: string, field: string) {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!normalized || normalized.length > 120 || UNSAFE.test(normalized)) {
    throw new Error(`admin_directory_invalid_${field}`);
  }
  return normalized;
}

export function safeDirectoryIdentifier(value: string, field: string) {
  if (!/^[A-Za-z0-9_:-]{3,180}$/u.test(value)) {
    throw new Error(`admin_directory_invalid_${field}`);
  }
  return value;
}
