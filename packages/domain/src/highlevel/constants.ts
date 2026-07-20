export const HIGHLEVEL_API_VERSION = '2021-07-28';
export const HIGHLEVEL_DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';
export const HIGHLEVEL_APP_URL = 'https://app.gohighlevel.com';

export const HIGHLEVEL_CUSTOM_FIELDS = [
  'One Time Parent ID',
  'One Time Household ID',
  'One Time Customer Status',
  'One Time Portal Status',
  'One Time Access Status',
  'One Time Grace Until',
  'One Time Complimentary Until',
  'One Time Last Sync',
  'One Time Signup Source',
] as const;

export const HIGHLEVEL_TAGS = [
  'OT | Lead',
  'OT | Prelaunch',
  'OT | Checkout Started',
  'OT | Active',
  'OT | Grace',
  'OT | Canceled',
  'OT | Former',
  'OT | Complimentary',
  'OT | Portal Invited',
  'OT | Portal Active',
  'OT | Email Opt-In',
  'OT | WhatsApp Opt-In',
  'OT | Marketing Suppressed',
  'OT | Signup Website',
  'OT | Signup WhatsApp',
] as const;

export const PRELAUNCH_COMPLIMENTARY_CUTOFF_ISO = '2026-09-13T23:59:00+03:00';
export const PAID_LAUNCH_DATE = '2026-09-14';
export const FAILED_RENEWAL_GRACE_DAYS = 7;
