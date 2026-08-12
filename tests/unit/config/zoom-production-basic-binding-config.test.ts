import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../packages/config/src/index.ts';

const now = new Date('2026-08-12T10:30:00.000Z');
const receipt = {
  ZOOM_PRODUCTION_BASIC_BINDING_ACCOUNT_MATCHES: 'true',
  ZOOM_PRODUCTION_BASIC_BINDING_HOST_MATCHES: 'true',
  ZOOM_PRODUCTION_BASIC_BINDING_REGISTRATION_REQUIRED: 'false',
  ZOOM_PRODUCTION_BASIC_BINDING_MEETING_IS_RECURRING: 'true',
  ZOOM_PRODUCTION_BASIC_BINDING_TIMEZONE: 'Asia/Jerusalem',
  ZOOM_PRODUCTION_BASIC_BINDING_WEEKLY_DAYS: '1,2,3,4,5',
  ZOOM_PRODUCTION_BASIC_BINDING_FIRST_OCCURRENCE_AT: '2026-08-16T19:00:00+03:00',
  ZOOM_PRODUCTION_BASIC_BINDING_JOIN_BEFORE_HOST: 'false',
  ZOOM_PRODUCTION_BASIC_BINDING_PARTICIPANT_VIDEO: 'false',
  ZOOM_PRODUCTION_BASIC_BINDING_AUTO_RECORDING: 'none',
  ZOOM_PRODUCTION_BASIC_BINDING_MEETING_REF_DIGEST:
    'a3b2c1d0e9f8172635445566778899aabbccddeeff00112233445566778899aa',
  ZOOM_PRODUCTION_BASIC_BINDING_CHECKED_AT: '2026-08-12T10:00:00.000Z',
  ZOOM_PRODUCTION_BASIC_BINDING_EXPIRES_AT: '2026-08-12T11:00:00.000Z',
} as const;

describe('Zoom production-basic verified binding receipt configuration', () => {
  it('is absent by default and therefore cannot activate the binding', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).zoomProductionBasicVerifiedBinding).toBeUndefined();
  });

  it('parses only a complete digest-only, registration-off verification receipt', () => {
    expect(
      loadConfig({ NODE_ENV: 'test', ...receipt }, { now }).zoomProductionBasicVerifiedBinding,
    ).toEqual({
      account_matches: true,
      host_matches: true,
      registration_required: false,
      meeting_is_recurring: true,
      timezone: 'Asia/Jerusalem',
      weekly_days: [1, 2, 3, 4, 5],
      first_occurrence_at: '2026-08-16T19:00:00+03:00',
      join_before_host: false,
      participant_video: false,
      auto_recording: 'none',
      meeting_ref_digest: receipt.ZOOM_PRODUCTION_BASIC_BINDING_MEETING_REF_DIGEST,
      checked_at: receipt.ZOOM_PRODUCTION_BASIC_BINDING_CHECKED_AT,
      expires_at: receipt.ZOOM_PRODUCTION_BASIC_BINDING_EXPIRES_AT,
    });
  });

  it('rejects partial, invalid, or registration-required receipts', () => {
    expect(() =>
      loadConfig(
        {
          NODE_ENV: 'test',
          ZOOM_PRODUCTION_BASIC_BINDING_ACCOUNT_MATCHES: 'true',
        },
        { now },
      ),
    ).toThrow(/receipt requires/i);
    expect(() =>
      loadConfig(
        {
          NODE_ENV: 'test',
          ...receipt,
          ZOOM_PRODUCTION_BASIC_BINDING_REGISTRATION_REQUIRED: 'true',
        },
        { now },
      ),
    ).toThrow(/registration off/i);
    expect(() =>
      loadConfig(
        {
          NODE_ENV: 'test',
          ...receipt,
          ZOOM_PRODUCTION_BASIC_BINDING_MEETING_REF_DIGEST: 'not-a-digest',
        },
        { now },
      ),
    ).toThrow(/meeting reference digest/i);
  });

  it('rejects a non-recurring, future, stale, or overly long receipt', () => {
    for (const override of [
      { ZOOM_PRODUCTION_BASIC_BINDING_MEETING_IS_RECURRING: 'false' },
      {
        ZOOM_PRODUCTION_BASIC_BINDING_CHECKED_AT: '2026-08-12T10:31:00.000Z',
        ZOOM_PRODUCTION_BASIC_BINDING_EXPIRES_AT: '2026-08-12T11:00:00.000Z',
      },
      {
        ZOOM_PRODUCTION_BASIC_BINDING_CHECKED_AT: '2026-07-12T10:29:59.000Z',
        ZOOM_PRODUCTION_BASIC_BINDING_EXPIRES_AT: '2026-08-12T10:31:00.000Z',
      },
      {
        ZOOM_PRODUCTION_BASIC_BINDING_CHECKED_AT: '2026-08-12T10:00:00.000Z',
        ZOOM_PRODUCTION_BASIC_BINDING_EXPIRES_AT: '2026-09-12T10:00:01.000Z',
      },
    ] as const) {
      expect(() => loadConfig({ NODE_ENV: 'test', ...receipt, ...override }, { now })).toThrow(
        /recurring meeting.*31 days/i,
      );
    }
  });

  it.each([
    ['ZOOM_PRODUCTION_BASIC_BINDING_TIMEZONE', 'UTC'],
    ['ZOOM_PRODUCTION_BASIC_BINDING_WEEKLY_DAYS', '1,2,3,4,7'],
    ['ZOOM_PRODUCTION_BASIC_BINDING_FIRST_OCCURRENCE_AT', '2026-08-16T18:00:00+03:00'],
    ['ZOOM_PRODUCTION_BASIC_BINDING_JOIN_BEFORE_HOST', 'true'],
    ['ZOOM_PRODUCTION_BASIC_BINDING_PARTICIPANT_VIDEO', 'true'],
    ['ZOOM_PRODUCTION_BASIC_BINDING_AUTO_RECORDING', 'cloud'],
  ])('rejects an unsafe or mismatched meeting fact: %s', (field, value) => {
    expect(() => loadConfig({ NODE_ENV: 'test', ...receipt, [field]: value }, { now })).toThrow(
      /exact recurring meeting.*7 PM Jerusalem schedule/i,
    );
  });

  it('caps the receipt at the configured free-access end', () => {
    expect(() =>
      loadConfig(
        {
          NODE_ENV: 'test',
          ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-08-12T10:45:00.000Z',
          ...receipt,
        },
        { now },
      ),
    ).toThrow(/free-access period/i);
  });
});
