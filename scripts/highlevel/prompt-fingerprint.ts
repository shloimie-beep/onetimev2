import { createHash } from 'node:crypto';
import { canonicalTextForHash } from '../ops/canonical-text.ts';

export function promptFingerprint(value: string) {
  return createHash('sha256').update(canonicalTextForHash(value)).digest('hex');
}
