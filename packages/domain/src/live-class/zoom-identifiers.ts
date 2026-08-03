import { stableKey } from '../lead/normalize.ts';

export const ZOOM_CUSTOMER_KEY_MAX_LENGTH = 36;
const ZOOM_CUSTOMER_KEY_PATTERN = /^zoom_ck_[a-f0-9]{24}$/;

export function zoomCustomerKey(parts: string[]) {
  const key = stableKey('zoom_ck', parts);
  if (key.length > ZOOM_CUSTOMER_KEY_MAX_LENGTH || !ZOOM_CUSTOMER_KEY_PATTERN.test(key)) {
    throw new Error('Zoom customer key generation failed.');
  }
  return key;
}

export function assertZoomCustomerKey(value: string) {
  if (value.length > ZOOM_CUSTOMER_KEY_MAX_LENGTH || !ZOOM_CUSTOMER_KEY_PATTERN.test(value)) {
    throw new Error('Zoom customer key is invalid.');
  }
  return value;
}
