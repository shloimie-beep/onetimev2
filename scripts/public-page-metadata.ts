const productionPublicOrigin = 'https://join.onetimeonetime.com';

export function publicOriginFromEnv(value = process.env.PUBLIC_BASE_URL) {
  const raw = value?.trim() || productionPublicOrigin;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('PUBLIC_BASE_URL must be an absolute URL.');
  }
  if (!isAllowedPublicProtocol(parsed)) {
    throw new Error('PUBLIC_BASE_URL must use https, except for localhost development.');
  }
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export function publicCanonicalUrl(pathname = '/', origin = publicOriginFromEnv()) {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    throw new Error('Canonical page paths must be root-relative.');
  }
  return new URL(pathname, `${origin}/`).toString();
}

function isAllowedPublicProtocol(parsed: URL) {
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol !== 'http:') return false;
  return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
}

export const defaultProductionPublicOrigin = productionPublicOrigin;
