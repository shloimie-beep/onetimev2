import { createHash } from 'node:crypto';

export type ScopedCrmActor = {
  accountKey: string;
  productKey: string;
  userKey: string;
  role: string;
  roleLabel: string;
};

export function makeStrongEtag(resourceType: string, resourceId: string, version: number) {
  const digest = createHash('sha256')
    .update(`${resourceType}:${resourceId}:${version}`)
    .digest('base64url');
  return `"${digest}"`;
}

export function parseStrongEtag(value: string | undefined) {
  if (!value || !/^"[^"]+"$/.test(value)) return null;
  return value;
}

export function canonicalRequestHash(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
