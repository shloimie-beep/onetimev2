import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TISHA_BAV_COMMUNICATION_CATALOG_VERSION,
  TISHA_BAV_EMAIL_CATALOG,
  TISHA_BAV_EMAIL_SENDER,
  TISHA_BAV_EVENT_DISPLAY,
  TISHA_BAV_EVENT_START,
  TISHA_BAV_WORKFLOW_SCHEDULE,
} from '../../packages/domain/src/index.ts';

const firstName = '{{default contact.first_name "there"}}';
const schedule = ['Thursday, July 23, 2026', '3:00 PM Eastern'].join('\n');

describe("Tisha B'Av 2026 email copy", () => {
  it('preserves the exact sender, subjects, preview, bodies, and protected CTA paths', () => {
    expect(TISHA_BAV_COMMUNICATION_CATALOG_VERSION).toBe('tisha-bav-2026-email-copy-v2');
    expect(TISHA_BAV_EMAIL_SENDER).toEqual({
      visibleName: 'Rabbi Eli Scheller | One Time Mishnayos',
      from: 'info@onetimeonetime.com',
      replyTo: 'info@onetimeonetime.com',
    });

    expect(TISHA_BAV_EMAIL_CATALOG.warm_invitation).toMatchObject({
      subject: "Join me live this Tisha B'Av",
      preview: 'A live program on Thursday at 3:00 PM Eastern.',
      cta: { label: 'Reserve My Place', path: '/tisha-bav' },
      delivery: { kind: 'manual_prepare_only', offsetMinutes: null, sendAt: null },
    });
    expect(TISHA_BAV_EMAIL_CATALOG.warm_invitation.body).toBe(
      [
        `Hi ${firstName},`,
        '',
        "This Tisha B'Av, I will be hosting a live online program.",
        '',
        schedule,
        '',
        "Register below and we'll email the private access before the program begins.",
        '',
        '[Reserve My Place]',
        '',
        'I hope you can join me.',
        '',
        'Rabbi Eli Scheller',
        'One Time Mishnayos',
      ].join('\n'),
    );

    expect(TISHA_BAV_EMAIL_CATALOG.registration_confirmation).toMatchObject({
      subject: "You're registered for Rabbi Eli Scheller's live Tisha B'Av program",
      preview: null,
      cta: { label: 'View Event Details', path: '/tisha-bav' },
      delivery: { kind: 'registration_triggered', offsetMinutes: 0, sendAt: null },
    });
    expect(TISHA_BAV_EMAIL_CATALOG.registration_confirmation.body).toBe(
      [
        `Hi ${firstName},`,
        '',
        "Your place is saved for Rabbi Eli Scheller's live Tisha B'Av program.",
        '',
        schedule,
        '',
        "We'll email the private access details before the program begins.",
        '',
        '[View Event Details]',
        '',
        'One Time Mishnayos',
        'info@onetimeonetime.com',
      ].join('\n'),
    );

    expect(TISHA_BAV_EMAIL_CATALOG.one_hour_reminder).toMatchObject({
      subject: 'We begin in one hour',
      preview: null,
      cta: { label: 'Open the Live Event Page', path: '/tisha-bav/live' },
    });
    expect(TISHA_BAV_EMAIL_CATALOG.one_hour_reminder.body).toBe(
      [
        `Hi ${firstName},`,
        '',
        "Rabbi Eli Scheller's live Tisha B'Av program begins in one hour.",
        '',
        'Open the event page below. The Join button will become available when the event opens.',
        '',
        '[Open the Live Event Page]',
        '',
        'One Time Mishnayos',
      ].join('\n'),
    );

    expect(TISHA_BAV_EMAIL_CATALOG.ten_minute_reminder).toMatchObject({
      subject: 'Starting soon: join Rabbi Eli Scheller live',
      preview: null,
      cta: { label: 'Join the Live Program', path: '/tisha-bav/live' },
    });
    expect(TISHA_BAV_EMAIL_CATALOG.ten_minute_reminder.body).toBe(
      [
        `Hi ${firstName},`,
        '',
        "We're starting shortly.",
        '',
        "Use the private One Time event page to join Rabbi Eli Scheller's live Tisha B'Av program.",
        '',
        '[Join the Live Program]',
        '',
        'Please do not forward the access page.',
        '',
        'One Time Mishnayos',
      ].join('\n'),
    );

    for (const email of Object.values(TISHA_BAV_EMAIL_CATALOG)) {
      expect(email.sender).toEqual(TISHA_BAV_EMAIL_SENDER);
      expect(JSON.stringify(email)).not.toMatch(/zoom\.us|zoommtg|pwd=/i);
      expect(JSON.stringify(email)).not.toMatch(/Israel|Eretz Yisrael|keep this email/i);
    }
  });

  it('derives displayed times and reminder waits from the canonical event start', () => {
    expect(TISHA_BAV_EVENT_START).toBe('2026-07-23T19:00:00.000Z');
    expect(TISHA_BAV_EVENT_DISPLAY).toEqual({
      date: 'Thursday, July 23, 2026',
      eastern: '3:00 PM Eastern',
      israel: '10:00 PM Israel',
    });
    expect(TISHA_BAV_WORKFLOW_SCHEDULE).toEqual({
      eventStart: TISHA_BAV_EVENT_START,
      confirmation: { trigger: 'registration', offsetMinutes: 0 },
      oneHourReminder: {
        kind: 'event_relative',
        offsetMinutes: -60,
        sendAt: '2026-07-23T18:00:00.000Z',
      },
      tenMinuteReminder: {
        kind: 'event_relative',
        offsetMinutes: -10,
        sendAt: '2026-07-23T18:50:00.000Z',
      },
    });

    const config = JSON.parse(readFileSync('config/events/tisha-bav-2026.json', 'utf8')) as Record<
      string,
      unknown
    >;
    expect(new Date(String(config.event_start)).toISOString()).toBe(TISHA_BAV_EVENT_START);
    expect(new Date(String(config.event_start_israel)).toISOString()).toBe(TISHA_BAV_EVENT_START);
    expect(config.communications).toMatchObject({
      catalog_version: TISHA_BAV_COMMUNICATION_CATALOG_VERSION,
      one_hour_reminder_offset_minutes: -60,
      ten_minute_reminder_offset_minutes: -10,
    });

    const handoff = readFileSync('ops/codex-runs/TISHA-BAV-FUNNEL/GHL-WORKFLOW-HANDOFF.md', 'utf8');
    expect(handoff).toContain(TISHA_BAV_EVENT_DISPLAY.date);
    expect(handoff).toContain(TISHA_BAV_EVENT_DISPLAY.eastern);
    expect(handoff).toContain(TISHA_BAV_EVENT_DISPLAY.israel);
    expect(handoff).toContain(TISHA_BAV_WORKFLOW_SCHEDULE.oneHourReminder.sendAt);
    expect(handoff).toContain(TISHA_BAV_WORKFLOW_SCHEDULE.tenMinuteReminder.sendAt);
    for (const email of Object.values(TISHA_BAV_EMAIL_CATALOG)) {
      expect(handoff).toContain(email.subject);
      expect(handoff).toContain(email.cta.label);
    }
  });
});
