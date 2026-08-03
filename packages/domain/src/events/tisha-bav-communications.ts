export const TISHA_BAV_COMMUNICATION_CATALOG_VERSION = 'tisha-bav-2026-email-copy-v1';
export const TISHA_BAV_EVENT_START = '2026-07-23T19:00:00.000Z';
export const TISHA_BAV_LANDING_PATH = '/tisha-bav';
export const TISHA_BAV_JOIN_PATH = '/tisha-bav/live';

const EASTERN_TIME_ZONE = 'America/New_York';
const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';
const FIRST_NAME_MERGE_TOKEN = '{{default contact.first_name "there"}}';

const eventStart = new Date(TISHA_BAV_EVENT_START);

function formatDate(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(eventStart);
}

function formatTime(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(eventStart);
}

function formatWeekday(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(eventStart);
}

function eventRelativeInstant(offsetMinutes: number) {
  return new Date(eventStart.getTime() + offsetMinutes * 60_000).toISOString();
}

export const TISHA_BAV_EVENT_DISPLAY = {
  date: formatDate(EASTERN_TIME_ZONE),
  eastern: `${formatTime(EASTERN_TIME_ZONE)} Eastern`,
  israel: `${formatTime(ISRAEL_TIME_ZONE)} Israel`,
} as const;

export const TISHA_BAV_EMAIL_SENDER = {
  visibleName: 'Rabbi Eli Scheller | One Time Mishnayos',
  from: 'info@onetimeonetime.com',
  replyTo: 'info@onetimeonetime.com',
} as const;

const scheduleBlock = [
  TISHA_BAV_EVENT_DISPLAY.date,
  TISHA_BAV_EVENT_DISPLAY.eastern,
  TISHA_BAV_EVENT_DISPLAY.israel,
].join('\n');

export const TISHA_BAV_EMAIL_CATALOG = {
  warm_invitation: {
    templateId: 'tisha_bav_2026_warm_invitation_v1',
    delivery: {
      kind: 'manual_prepare_only',
      offsetMinutes: null,
      sendAt: null,
    },
    sender: TISHA_BAV_EMAIL_SENDER,
    subject: "Join me live this Tisha B'Av",
    preview: `A live program from Eretz Yisrael on ${formatWeekday(EASTERN_TIME_ZONE)} at ${TISHA_BAV_EVENT_DISPLAY.eastern}.`,
    body: [
      `Hi ${FIRST_NAME_MERGE_TOKEN},`,
      '',
      "This Tisha B'Av, I will be hosting a live online program from Eretz Yisrael.",
      '',
      scheduleBlock,
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
    cta: {
      label: 'Reserve My Place',
      path: TISHA_BAV_LANDING_PATH,
    },
  },
  registration_confirmation: {
    templateId: 'tisha_bav_2026_registration_confirmation_v1',
    delivery: {
      kind: 'registration_triggered',
      offsetMinutes: 0,
      sendAt: null,
    },
    sender: TISHA_BAV_EMAIL_SENDER,
    subject: "You're registered for Rabbi Eli Scheller's live Tisha B'Av program",
    preview: null,
    body: [
      `Hi ${FIRST_NAME_MERGE_TOKEN},`,
      '',
      "Your place is saved for Rabbi Eli Scheller's live Tisha B'Av program from Eretz Yisrael.",
      '',
      scheduleBlock,
      '',
      "We'll email the private access details before the program begins.",
      '',
      '[View Event Details]',
      '',
      'One Time Mishnayos',
      'info@onetimeonetime.com',
    ].join('\n'),
    cta: {
      label: 'View Event Details',
      path: TISHA_BAV_LANDING_PATH,
    },
  },
  one_hour_reminder: {
    templateId: 'tisha_bav_2026_one_hour_reminder_v1',
    delivery: {
      kind: 'event_relative',
      offsetMinutes: -60,
      sendAt: eventRelativeInstant(-60),
    },
    sender: TISHA_BAV_EMAIL_SENDER,
    subject: 'We begin in one hour',
    preview: null,
    body: [
      `Hi ${FIRST_NAME_MERGE_TOKEN},`,
      '',
      "Rabbi Eli Scheller's live Tisha B'Av program begins in one hour.",
      '',
      'Open the event page below. The Join button will become available when the event opens.',
      '',
      '[Open the Live Event Page]',
      '',
      'One Time Mishnayos',
    ].join('\n'),
    cta: {
      label: 'Open the Live Event Page',
      path: TISHA_BAV_JOIN_PATH,
    },
  },
  ten_minute_reminder: {
    templateId: 'tisha_bav_2026_ten_minute_reminder_v1',
    delivery: {
      kind: 'event_relative',
      offsetMinutes: -10,
      sendAt: eventRelativeInstant(-10),
    },
    sender: TISHA_BAV_EMAIL_SENDER,
    subject: 'Starting soon: join Rabbi Eli Scheller live',
    preview: null,
    body: [
      `Hi ${FIRST_NAME_MERGE_TOKEN},`,
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
    cta: {
      label: 'Join the Live Program',
      path: TISHA_BAV_JOIN_PATH,
    },
  },
} as const;

export const TISHA_BAV_WORKFLOW_SCHEDULE = {
  eventStart: TISHA_BAV_EVENT_START,
  confirmation: {
    trigger: 'registration',
    offsetMinutes: 0,
  },
  oneHourReminder: TISHA_BAV_EMAIL_CATALOG.one_hour_reminder.delivery,
  tenMinuteReminder: TISHA_BAV_EMAIL_CATALOG.ten_minute_reminder.delivery,
} as const;
