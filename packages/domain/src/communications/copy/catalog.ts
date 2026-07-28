export const COPY_CATALOG_SEMANTIC_VERSION = '1.0.0';

export type CopyProvider = 'resend' | 'ghl';
export type SenderKey = 'rabbi_campaign' | 'office' | 'security_resend';
export type CopyAudience = 'adult' | 'parent_account_owner' | 'former_adult';

export type SenderIdentity = Readonly<{
  key: SenderKey;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  permittedPurposes: readonly string[];
}>;

export type CanonicalCopyMessage = Readonly<{
  id: string;
  workflowId: string;
  provider: CopyProvider;
  sender: SenderKey;
  audience: CopyAudience;
  subject: string;
  body: string;
  ctaLabel?: string;
  requiresApproval: boolean;
  requiresCurrentConsent: boolean;
  launchTiming: 'event' | 'approval_launch' | 'weekly_household_local';
  tokenBearing: boolean;
  requiredVariables: readonly string[];
}>;

export const SENDER_IDENTITIES: Readonly<Record<SenderKey, SenderIdentity>> = {
  rabbi_campaign: {
    key: 'rabbi_campaign',
    fromName: 'Rabbi Eli Scheller | One Time Mishnayos',
    fromAddress: 'rabbi@onetimeonetime.com',
    replyTo: 'info@onetimeonetime.com',
    permittedPurposes: [
      'Migration',
      'reactivation',
      'lead nurture',
      'Parent newsletter',
      'teaching/program messages',
    ],
  },
  office: {
    key: 'office',
    fromName: 'One Time Mishnayos',
    fromAddress: 'info@onetimeonetime.com',
    replyTo: 'info@onetimeonetime.com',
    permittedPurposes: [
      'Billing',
      'access',
      'schedule changes',
      'support',
      'school acknowledgment',
      'neutral operations',
    ],
  },
  security_resend: {
    key: 'security_resend',
    fromName: 'One Time Account Security',
    fromAddress: 'info@onetimeonetime.com',
    replyTo: 'info@onetimeonetime.com',
    permittedPurposes: ['Setup', 'reset', 'security notice; Resend only'],
  },
};

export const RABBI_GREETING = 'Hi {{contact.first_name}},';
export const RABBI_SIGNOFF = 'Hatzlacha,\nRabbi Eli Scheller\nOne Time Mishnayos';

/**
 * This is the source-of-truth copy data for the copy-owning modules. GHL
 * registration is deliberately outside this task; consumers receive these
 * identifiers through P31's interface checkpoint rather than a global barrel.
 */
export const CANONICAL_COPY_CATALOG: readonly CanonicalCopyMessage[] = [
  {
    id: 'resend.account_setup.v1',
    workflowId: 'security_account_setup',
    provider: 'resend',
    sender: 'security_resend',
    audience: 'adult',
    subject: 'Set up your One Time account',
    body: 'Hi {{adult.first_name}},\n\nUse the button below to set your One Time password.\n\nThis link can be used once and expires on {{token.expires_at_local}}. If it expires, request a new link from the sign-in page.\n\nIf you did not request this account, you can ignore this email.',
    ctaLabel: 'Set up my account',
    requiresApproval: false,
    requiresCurrentConsent: false,
    launchTiming: 'event',
    tokenBearing: true,
    requiredVariables: ['adult.first_name', 'token.expires_at_local', 'token.opaque_value'],
  },
  {
    id: 'resend.password_reset.v1',
    workflowId: 'security_password_reset',
    provider: 'resend',
    sender: 'security_resend',
    audience: 'adult',
    subject: 'Reset your One Time password',
    body: 'Hi {{adult.first_name}},\n\nUse the button below to reset your One Time password.\n\nThis link can be used once and expires on {{token.expires_at_local}}. If it expires, request a new link from the sign-in page.\n\nIf you did not request a password reset, you can ignore this email.',
    ctaLabel: 'Reset my password',
    requiresApproval: false,
    requiresCurrentConsent: false,
    launchTiming: 'event',
    tokenBearing: true,
    requiredVariables: ['adult.first_name', 'token.expires_at_local', 'token.opaque_value'],
  },
  {
    id: 'ghl.parent_portal_activated.v1',
    workflowId: 'OT-08',
    provider: 'ghl',
    sender: 'office',
    audience: 'parent_account_owner',
    subject: 'Add your Student accounts',
    body: 'Hi {{contact.first_name}},\n\nYour Parent account is active.\n\nAdd up to three Student accounts. Each Student gets a separate username and password for the live class and recording library. If you also want to learn, you may use one of those three Student seats with separate Student credentials.\n\nAll active Students are automatically added to the daily 7:00 p.m. Jerusalem-time class.',
    ctaLabel: 'Open Parent Dashboard',
    requiresApproval: false,
    requiresCurrentConsent: false,
    launchTiming: 'event',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.parent_class_reminder.v1',
    workflowId: 'OT-09',
    provider: 'ghl',
    sender: 'office',
    audience: 'parent_account_owner',
    subject: 'One Time class begins in 30 minutes',
    body: 'Hi {{contact.first_name}},\n\nRabbi Eli’s One Time Mishnayos class begins in 30 minutes at {{occurrence.parent_local_time}}.\n\nStudents joining today: {{household.active_student_names}}.\n\nEach Student should sign in to the Student Portal on their own device and select Join Class.',
    ctaLabel: 'Open One Time',
    requiresApproval: false,
    requiresCurrentConsent: false,
    launchTiming: 'event',
    tokenBearing: false,
    requiredVariables: [
      'contact.first_name',
      'occurrence.parent_local_time',
      'household.active_student_names',
    ],
  },
  {
    id: 'ghl.parent_recording_available.v1',
    workflowId: 'OT-10',
    provider: 'ghl',
    sender: 'office',
    audience: 'parent_account_owner',
    subject: 'A new One Time recording is ready',
    body: 'Hi {{contact.first_name}},\n\nA new One Time recording is ready. Your eligible Students can open it from their Student Library.',
    ctaLabel: 'Open One Time',
    requiresApproval: false,
    requiresCurrentConsent: false,
    launchTiming: 'event',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.parent_newsletter.v1',
    workflowId: 'OT-14',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'This week in One Time Mishnayos',
    body: `${RABBI_GREETING}\n\n{{newsletter.rabbi_note}}\n\nClass recap: {{newsletter.class_recap}}\nUpcoming schedule: {{newsletter.upcoming_schedule}}\nNew recording or review: {{newsletter.recording_or_review}}\nApproved question highlight: {{newsletter.approved_question_highlight}}\n\n${RABBI_SIGNOFF}`,
    ctaLabel: 'Open One Time',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'weekly_household_local',
    tokenBearing: false,
    requiredVariables: [
      'contact.first_name',
      'newsletter.rabbi_note',
      'newsletter.class_recap',
      'newsletter.upcoming_schedule',
      'newsletter.recording_or_review',
      'newsletter.approved_question_highlight',
    ],
  },
  {
    id: 'ghl.former_member_reactivation.step_1.v1',
    workflowId: 'OT-15',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'former_adult',
    subject: 'See what is new in One Time Mishnayos',
    body: `${RABBI_GREETING}\n\n{{campaign.body}}\n\n${RABBI_SIGNOFF}`,
    ctaLabel: 'Open One Time',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name', 'campaign.body'],
  },
  {
    id: 'ghl.legacy_member_migration.step_1.v1',
    workflowId: 'OT-02A',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'Your new One Time account is ready',
    body: `${RABBI_GREETING}\n\n{{campaign.body}}\n\n${RABBI_SIGNOFF}`,
    ctaLabel: 'Create my new account',
    requiresApproval: true,
    requiresCurrentConsent: false,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name', 'campaign.body'],
  },
];

export function findCanonicalCopy(id: string): CanonicalCopyMessage | undefined {
  return CANONICAL_COPY_CATALOG.find((message) => message.id === id);
}

export function requiresRabbiVoice(message: CanonicalCopyMessage): boolean {
  return message.sender === 'rabbi_campaign';
}
