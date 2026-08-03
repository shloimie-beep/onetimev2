import { describe, expect, it } from 'vitest';
import { databaseInstant } from './database-instant.ts';

describe('databaseInstant', () => {
  it('preserves millisecond precision from PostgreSQL Date values', () => {
    const source = new Date('2026-08-03T18:17:27.366Z');

    expect(databaseInstant(source, 'Login budget reset').toISOString()).toBe(
      '2026-08-03T18:17:27.366Z',
    );
  });

  it('accepts exact timestamp strings and rejects invalid values', () => {
    expect(databaseInstant('2026-08-03T18:17:27.366Z', 'Login budget reset').toISOString()).toBe(
      '2026-08-03T18:17:27.366Z',
    );
    expect(() => databaseInstant('not-a-timestamp', 'Login budget reset')).toThrow(
      /invalid database timestamp/u,
    );
  });
});
