import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export type CommunicationsCursorMode = 'global' | 'contact';

export type CommunicationsCursorFilters = {
  from: string;
  to: string;
  channel?: string | undefined;
  direction?: string | undefined;
  intent_type?: string | undefined;
  status?: string | undefined;
  source?: string | undefined;
  limit: number;
};

export type CommunicationsCursorPayload = {
  v: 1;
  mode: CommunicationsCursorMode;
  scope_hash: string;
  contact_hash?: string | undefined;
  filters_hash: string;
  last_created_at: string;
  last_id: string;
  expires_at: string;
};

export class CommunicationsCursorError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function hashCursorScope(secret: string, values: readonly string[]) {
  return createHash('sha256')
    .update(['communications-v1', secret, ...values].join('\0'))
    .digest('hex');
}

export function hashCursorFilters(secret: string, filters: CommunicationsCursorFilters) {
  const normalized = {
    from: filters.from,
    to: filters.to,
    channel: filters.channel ?? null,
    direction: filters.direction ?? null,
    intent_type: filters.intent_type ?? null,
    status: filters.status ?? null,
    source: filters.source ?? null,
    limit: filters.limit,
  };
  return hashCursorScope(secret, [JSON.stringify(normalized)]);
}

export function encodeCommunicationsCursor(secret: string, payload: CommunicationsCursorPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cursorKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'otc1',
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decodeCommunicationsCursor(secret: string, token: string, now = new Date()) {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'otc1') {
    throw new CommunicationsCursorError('CURSOR_MALFORMED');
  }
  try {
    const iv = Buffer.from(requiredPart(parts[1]), 'base64url');
    const encrypted = Buffer.from(requiredPart(parts[2]), 'base64url');
    const tag = Buffer.from(requiredPart(parts[3]), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', cursorKey(secret), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );
    const parsed = JSON.parse(plaintext) as Partial<CommunicationsCursorPayload>;
    if (
      parsed.v !== 1 ||
      (parsed.mode !== 'global' && parsed.mode !== 'contact') ||
      !parsed.scope_hash ||
      !parsed.filters_hash ||
      !parsed.last_created_at ||
      !parsed.last_id ||
      !parsed.expires_at
    ) {
      throw new CommunicationsCursorError('CURSOR_BODY_INVALID');
    }
    if (new Date(parsed.expires_at).getTime() <= now.getTime()) {
      throw new CommunicationsCursorError('CURSOR_EXPIRED');
    }
    return parsed as CommunicationsCursorPayload;
  } catch (error) {
    if (error instanceof CommunicationsCursorError) throw error;
    throw new CommunicationsCursorError('CURSOR_TAMPERED');
  }
}

export function assertCursorBinding(actual: string, expected: string, code: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new CommunicationsCursorError(code);
  }
}

function cursorKey(secret: string) {
  return createHash('sha256').update(`ot44-communications-cursor\0${secret}`).digest();
}

function requiredPart(value: string | undefined) {
  if (!value) throw new CommunicationsCursorError('CURSOR_MALFORMED');
  return value;
}
