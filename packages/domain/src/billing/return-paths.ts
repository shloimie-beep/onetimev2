const checkoutSuccessPath = '/app/billing/checkout/success';
const checkoutCancelPath = '/app/billing/checkout/cancel';
const portalReturnPath = '/app/parent';

export type BillingReturnPaths = {
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  portalReturnUrl: string;
};

export class BillingReturnPathError extends Error {
  constructor(message = 'Billing return path rejected.') {
    super(message);
  }
}

export function buildBillingReturnPaths(canonicalPublicOrigin: string | null): BillingReturnPaths {
  if (!canonicalPublicOrigin)
    throw new BillingReturnPathError('Billing canonical origin is missing.');
  const origin = parseCanonicalOrigin(canonicalPublicOrigin);
  return {
    checkoutSuccessUrl: buildFixedUrl(origin, checkoutSuccessPath),
    checkoutCancelUrl: buildFixedUrl(origin, checkoutCancelPath),
    portalReturnUrl: buildFixedUrl(origin, portalReturnPath),
  };
}

export function assertNoBrowserReturnPath(value: unknown) {
  if (value !== undefined) {
    throw new BillingReturnPathError('Browser-supplied billing return paths are not accepted.');
  }
}

export function isRejectedReturnPath(value: string) {
  try {
    rejectUnsafePath(value);
    return false;
  } catch {
    return true;
  }
}

function parseCanonicalOrigin(raw: string) {
  const parsed = new URL(raw);
  if (
    parsed.protocol !== 'https:' &&
    parsed.hostname !== 'localhost' &&
    parsed.hostname !== '127.0.0.1'
  ) {
    throw new BillingReturnPathError();
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new BillingReturnPathError();
  }
  return parsed.origin;
}

function buildFixedUrl(origin: string, path: string) {
  rejectUnsafePath(path);
  return new URL(path, origin).toString();
}

function rejectUnsafePath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new BillingReturnPathError();
  if (path.includes('\\') || path.includes('#') || path.includes('%2f') || path.includes('%5c')) {
    throw new BillingReturnPathError();
  }
  const parsed = new URL(path, 'https://fixture-origin.invalid');
  if (parsed.origin !== 'https://fixture-origin.invalid') throw new BillingReturnPathError();
  if (![checkoutSuccessPath, checkoutCancelPath, portalReturnPath].includes(parsed.pathname)) {
    throw new BillingReturnPathError();
  }
  if (parsed.search || parsed.hash) throw new BillingReturnPathError();
}
