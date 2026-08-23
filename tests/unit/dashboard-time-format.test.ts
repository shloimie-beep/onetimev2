import { describe, expect, it } from 'vitest';
import { formatIsoLabel } from '../../packages/domain/src/dashboard/service.ts';

describe('owner dashboard time labels', () => {
  it('formats the locked 7 PM Asia/Jerusalem class time instead of UTC', () => {
    expect(formatIsoLabel('2026-08-16T16:00:00.000Z')).toContain('7:00 PM Israel time');
  });
});
