import { argon2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  isStudentPin,
  PASSWORD_POLICIES,
  type AuthRole,
} from '../../../contracts/src/identity/auth/index.ts';

export const ARGON2ID_POLICY_VERSION = 'argon2id-v1' as const;
export const ARGON2ID_PARAMETERS = {
  memory_kib: 19_456,
  passes: 2,
  parallelism: 1,
  tag_length: 32,
  salt_length: 16,
} as const;

export type PasswordRejectionReason =
  'too_short' | 'too_long' | 'invalid_format' | 'common' | 'compromised' | 'identity_equivalent';

export type PasswordEvaluation =
  { accepted: true } | { accepted: false; reason: PasswordRejectionReason };

export type PasswordIdentityContext = {
  email?: string;
  username?: string;
  names?: readonly string[];
};

export type PasswordEvaluationInput = PasswordIdentityContext & {
  role: AuthRole;
  password: string;
  common_passwords?: ReadonlySet<string>;
  is_compromised?: (password: string) => boolean;
};

export function normalizeAuthIdentifier(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

export function normalizePasswordComparisonValue(value: string): string {
  return normalizeAuthIdentifier(value).replace(/\s+/gu, ' ');
}

export function unicodeCodePointLength(value: string): number {
  return [...value].length;
}

export function evaluatePassword(input: PasswordEvaluationInput): PasswordEvaluation {
  const policy = input.role === 'student' ? PASSWORD_POLICIES.student : PASSWORD_POLICIES.adult;
  const length = unicodeCodePointLength(input.password);
  if (length < policy.minimum_code_points) return { accepted: false, reason: 'too_short' };
  if (length > policy.maximum_code_points) return { accepted: false, reason: 'too_long' };
  if (policy.composition_rule === 'exact_six_ascii_digits' && !isStudentPin(input.password)) {
    return { accepted: false, reason: 'invalid_format' };
  }

  const normalizedPassword = normalizePasswordComparisonValue(input.password);
  if (
    policy.reject_common &&
    input.common_passwords &&
    [...input.common_passwords].some(
      (candidate) => normalizePasswordComparisonValue(candidate) === normalizedPassword,
    )
  ) {
    return { accepted: false, reason: 'common' };
  }
  if (policy.reject_compromised && input.is_compromised?.(input.password)) {
    return { accepted: false, reason: 'compromised' };
  }

  const identityValues = [input.email, input.username, ...(input.names ?? [])].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  if (
    policy.reject_identity_equivalent &&
    identityValues.some(
      (candidate) => normalizePasswordComparisonValue(candidate) === normalizedPassword,
    )
  ) {
    return { accepted: false, reason: 'identity_equivalent' };
  }
  return { accepted: true };
}

export function hashAuthPassword(password: string): string {
  const salt = randomBytes(ARGON2ID_PARAMETERS.salt_length);
  const hash = argon2Sync('argon2id', {
    message: Buffer.from(password),
    nonce: salt,
    memory: ARGON2ID_PARAMETERS.memory_kib,
    passes: ARGON2ID_PARAMETERS.passes,
    parallelism: ARGON2ID_PARAMETERS.parallelism,
    tagLength: ARGON2ID_PARAMETERS.tag_length,
  });
  return [
    ARGON2ID_POLICY_VERSION,
    'v=19',
    `m=${ARGON2ID_PARAMETERS.memory_kib},t=${ARGON2ID_PARAMETERS.passes},p=${ARGON2ID_PARAMETERS.parallelism}`,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

type ParsedPasswordHash = {
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  hash: Buffer;
};

function parsePasswordHash(storedHash: string): ParsedPasswordHash | null {
  const [policyVersion, argonVersion, encodedParameters, encodedSalt, encodedHash, extra] =
    storedHash.split('$');
  if (
    policyVersion !== ARGON2ID_POLICY_VERSION ||
    argonVersion !== 'v=19' ||
    !encodedParameters ||
    !encodedSalt ||
    !encodedHash ||
    extra !== undefined
  ) {
    return null;
  }
  const parameters = Object.fromEntries(
    encodedParameters.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, Number(value)];
    }),
  );
  if (
    !Number.isSafeInteger(parameters.m) ||
    !Number.isSafeInteger(parameters.t) ||
    !Number.isSafeInteger(parameters.p) ||
    Number(parameters.m) <= 0 ||
    Number(parameters.t) <= 0 ||
    Number(parameters.p) <= 0
  ) {
    return null;
  }
  const salt = Buffer.from(encodedSalt, 'base64url');
  const hash = Buffer.from(encodedHash, 'base64url');
  if (!salt.length || !hash.length) return null;
  return {
    memory: Number(parameters.m),
    passes: Number(parameters.t),
    parallelism: Number(parameters.p),
    salt,
    hash,
  };
}

export function verifyAuthPassword(password: string, storedHash: string): boolean {
  const parsed = parsePasswordHash(storedHash);
  if (!parsed) {
    argon2Sync('argon2id', {
      message: Buffer.from(password),
      nonce: Buffer.alloc(ARGON2ID_PARAMETERS.salt_length),
      memory: ARGON2ID_PARAMETERS.memory_kib,
      passes: ARGON2ID_PARAMETERS.passes,
      parallelism: ARGON2ID_PARAMETERS.parallelism,
      tagLength: ARGON2ID_PARAMETERS.tag_length,
    });
    return false;
  }
  const actual = argon2Sync('argon2id', {
    message: Buffer.from(password),
    nonce: parsed.salt,
    memory: parsed.memory,
    passes: parsed.passes,
    parallelism: parsed.parallelism,
    tagLength: parsed.hash.length,
  });
  return actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash);
}

export function authPasswordHashNeedsUpgrade(storedHash: string): boolean {
  const parsed = parsePasswordHash(storedHash);
  return (
    !parsed ||
    parsed.memory !== ARGON2ID_PARAMETERS.memory_kib ||
    parsed.passes !== ARGON2ID_PARAMETERS.passes ||
    parsed.parallelism !== ARGON2ID_PARAMETERS.parallelism ||
    parsed.hash.length !== ARGON2ID_PARAMETERS.tag_length ||
    parsed.salt.length !== ARGON2ID_PARAMETERS.salt_length
  );
}

export function verifyAuthPasswordWithUpgrade(
  password: string,
  storedHash: string,
): { valid: false } | { valid: true; replacement_hash: string | null } {
  if (!verifyAuthPassword(password, storedHash)) return { valid: false };
  return {
    valid: true,
    replacement_hash: authPasswordHashNeedsUpgrade(storedHash) ? hashAuthPassword(password) : null,
  };
}

export function normalizeLegacyAuthRole(role: string): AuthRole | null {
  if (role === 'owner' || role === 'rabbi' || role === 'admin') return 'admin';
  if (role === 'parent' || role === 'student') return role;
  return null;
}
