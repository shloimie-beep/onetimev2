export const COPY_CATALOG_SEMANTIC_VERSION = '1.2.0';

export type CopyProvider = 'resend' | 'ghl';
export type SenderKey =
  'rabbi_campaign' | 'rabbi_personal' | 'office' | 'brand' | 'security_resend';
export type CopyAudience = 'adult' | 'parent_account_owner' | 'former_adult';
export type CopyCtaDestination =
  'one_time_home_url' | 'one_time_signup_url' | 'one_time_member_login_url';

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
  preheader?: string;
  body: string;
  ctaLabel?: string;
  ctaDestination?: CopyCtaDestination;
  requiresApproval: boolean;
  requiresCurrentConsent: boolean;
  launchTiming: 'event' | 'approval_launch' | 'weekly_household_local';
  daysAfterApprovalLaunch?: number;
  tokenBearing: boolean;
  requiredVariables: readonly string[];
}>;

export const SENDER_IDENTITIES: Readonly<Record<SenderKey, SenderIdentity>> = {
  rabbi_campaign: {
    key: 'rabbi_campaign',
    fromName: 'Rabbi Eli Scheller',
    fromAddress: 'rabbielischeller@onetimeonetime.com',
    replyTo: 'rabbielischeller@onetimeonetime.com',
    permittedPurposes: [
      'Migration',
      'reactivation',
      'lead nurture',
      'Parent newsletter',
      'teaching/program messages',
    ],
  },
  rabbi_personal: {
    key: 'rabbi_personal',
    fromName: 'Rabbi Eli Scheller',
    fromAddress: 'rabbielischeller@onetimeonetime.com',
    replyTo: 'rabbielischeller@onetimeonetime.com',
    permittedPurposes: ['Torah answers', 'Rabbi-authored follow-up'],
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
  brand: {
    key: 'brand',
    fromName: 'One Time Mishnayos',
    fromAddress: 'info@onetimeonetime.com',
    replyTo: 'info@onetimeonetime.com',
    permittedPurposes: [
      'Portal lifecycle',
      'class reminders',
      'recording availability',
      'neutral program notices',
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
export const RABBI_CAMPAIGN_GREETING = 'Shalom {{contact.first_name}},';
export const RABBI_CAMPAIGN_SIGNOFF = 'With bracha,\nRabbi Eli Scheller\nOne Time Mishnayos';

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
    id: 'ghl.signup_confirmation.v1',
    workflowId: 'OT-01',
    provider: 'ghl',
    sender: 'office',
    audience: 'parent_account_owner',
    subject: 'Your One Time Family account is ready',
    preheader: 'Free access is available now, with room for up to three Student seats.',
    body: 'Hi {{contact.first_name}},\n\nYour durable One Time Family account has been created, and your family has immediate free access.\n\nFrom your secure Family account, you can add up to three Student seats for live Mishnah learning and the on-demand recording library. No Student account was created automatically, and no card was collected.\n\nThe new zman begins in Elul. We will explain any later paid-access choice clearly before it applies; there is no automatic charge.\n\nWarmly,\nOne Time Mishnayos',
    ctaLabel: 'Open My Family Account',
    ctaDestination: 'one_time_member_login_url',
    requiresApproval: false,
    requiresCurrentConsent: false,
    launchTiming: 'event',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.parent_portal_activated.v1',
    workflowId: 'OT-08',
    provider: 'ghl',
    sender: 'brand',
    audience: 'parent_account_owner',
    subject: 'Add your Student accounts',
    body: 'Hi {{contact.first_name}},\n\nYour Parent account is active.\n\nYou can learn immediately from your Parent account without using any of the three Student accounts. You can still add up to three Student accounts, each with a separate username and password for the live class and recording library.\n\nAll active Students are automatically added to the daily 7:00 p.m. Jerusalem-time class.',
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
    sender: 'brand',
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
    sender: 'brand',
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
    id: 'ghl.legacy_member_migration.step_1.v1',
    workflowId: 'OT-02A',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'A new zman for One Time Mishnayos',
    preheader: 'A personal update from Rabbi Eli about what is beginning in Elul.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nI'm grateful to share that One Time Mishnayos is beginning a new zman in Elul.\n\nThe program is built to help boys gain clarity, memory, consistency, and a love of Mishnah through steady learning from Eretz Yisrael.\n\nBecause your family learned with One Time before, I wanted you to know what is coming and give you a simple way to see the current program.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: "See What's New",
    ctaDestination: 'one_time_home_url',
    requiresApproval: true,
    requiresCurrentConsent: false,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.legacy_member_migration.step_2.v1',
    workflowId: 'OT-02A',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'A steady way to begin Mishnah again',
    preheader: 'Live learning, on-demand review, and a clear routine for the new zman.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nAs the new zman approaches, this is a good time to help your son begin again with a steady Mishnah routine.\n\nOne Time combines live learning with an on-demand recording library, so a Student can return to a class, review, and keep building progress. A parent manages the secure Family account while each Student uses separate access.\n\nI would be glad to have your family learning with us again.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'See How One Time Works',
    ctaDestination: 'one_time_home_url',
    requiresApproval: true,
    requiresCurrentConsent: false,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.legacy_member_migration.step_3.v1',
    workflowId: 'OT-02A',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'Activate your new One Time Family account',
    preheader: 'Restart with immediate free access and room for up to three Student seats.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nIf your family would like to restart with One Time, the next step is to activate your durable Family account through the secure One Time signup.\n\nYour family can begin with immediate free access and add up to three Student seats for live learning and the on-demand recording library. No card is required, and there is no automatic charge.\n\nAccount activation happens only through the secure One Time process; this email does not create Student accounts or change payment status.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'Activate My Family Account',
    ctaDestination: 'one_time_signup_url',
    requiresApproval: true,
    requiresCurrentConsent: false,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.former_member_reactivation.step_1.v1',
    workflowId: 'OT-15',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'former_adult',
    subject: 'Help your son remember what he learns',
    preheader: 'Build clarity, consistency, and lasting Mishnah knowledge.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nThe goal of One Time Mishnayos is not only to cover Mishnah, but to help a boy understand it clearly, remember it, and return to learning with confidence.\n\nA steady routine of live learning and review helps each class become part of something lasting. I would be happy to have your family experience that growth with us again.\n\nThe new zman begins in Elul, and you can see the current program through One Time.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'See the Learning Experience',
    ctaDestination: 'one_time_home_url',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.former_member_reactivation.step_2.v1',
    workflowId: 'OT-15',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'former_adult',
    subject: 'Live Mishnah learning, with recordings ready for review',
    preheader: 'Join live, return on demand, and keep building steady progress.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nOne Time gives each Student a separate place for live Mishnah learning and an on-demand recording library for review.\n\nA Student can join the class, return to a recording when more review is needed, and keep building from one lesson to the next. The parent manages the secure Family account and up to three Student seats.\n\nI would be glad to have your family learning with us again.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'Explore Live and On-Demand Learning',
    ctaDestination: 'one_time_home_url',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'approval_launch',
    daysAfterApprovalLaunch: 4,
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.former_member_reactivation.step_3.v1',
    workflowId: 'OT-15',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'former_adult',
    subject: 'Come back to One Time with free access now',
    preheader: 'Restart without a card or an automatic charge.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nYour family can come back to One Time Mishnayos with immediate free access as we prepare for the new zman in Elul.\n\nCreate your durable Family account, then add up to three Student seats for live learning and the on-demand recording library. No card is required, and there is no automatic charge.\n\nI hope you will join us again.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'Restart with Free Access',
    ctaDestination: 'one_time_signup_url',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'approval_launch',
    daysAfterApprovalLaunch: 9,
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.prelaunch_nurture.step_1.v1',
    workflowId: 'OT-02B',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'Build clarity, memory, and consistency in Mishnah',
    preheader: 'A steady learning experience designed to help Mishnah last.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nI'm grateful to introduce One Time Mishnayos, a program designed to help boys build clarity, memory, consistency, and a love of Mishnah through learning from Eretz Yisrael.\n\nThe goal is steady progress: understand each Mishnah, review it, and keep building from one class to the next.\n\nIf that sounds meaningful for your family, I invite you to see how One Time works.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'See How One Time Works',
    ctaDestination: 'one_time_home_url',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.prelaunch_nurture.step_2.v1',
    workflowId: 'OT-02B',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'Live learning when it is time to learn - recordings when it is time to review',
    preheader: 'One secure Family account for live class and on-demand review.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nOne Time brings live Mishnah learning and an on-demand recording library together in one secure family experience.\n\nA Student can join class live, return to a recording for review, and keep a steady routine. The parent manages the Family account while each Student uses separate access.\n\nThe new zman begins in Elul, and I would be glad for your family to learn with us.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'Explore Live and On-Demand Learning',
    ctaDestination: 'one_time_home_url',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
  {
    id: 'ghl.prelaunch_nurture.step_3.v1',
    workflowId: 'OT-02B',
    provider: 'ghl',
    sender: 'rabbi_campaign',
    audience: 'parent_account_owner',
    subject: 'Begin One Time with free access now',
    preheader: 'Start without a card and add up to three Student seats.',
    body: `${RABBI_CAMPAIGN_GREETING}\n\nYour family can begin One Time Mishnayos with immediate free access as we prepare for the new zman in Elul.\n\nCreate a durable Family account, then add up to three Student seats for live learning and the on-demand recording library. No card is required, and there is no automatic charge.\n\nI would be happy to welcome your family to One Time.\n\n${RABBI_CAMPAIGN_SIGNOFF}`,
    ctaLabel: 'Start with Free Access',
    ctaDestination: 'one_time_signup_url',
    requiresApproval: true,
    requiresCurrentConsent: true,
    launchTiming: 'approval_launch',
    tokenBearing: false,
    requiredVariables: ['contact.first_name'],
  },
];

export function findCanonicalCopy(id: string): CanonicalCopyMessage | undefined {
  return CANONICAL_COPY_CATALOG.find((message) => message.id === id);
}

export function requiresRabbiVoice(message: CanonicalCopyMessage): boolean {
  return message.sender === 'rabbi_campaign';
}
