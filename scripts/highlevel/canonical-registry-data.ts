export const registryMetadata = {
  schemaId: 'one-time-highlevel',
  schemaVersion: '1.0.0',
  status: 'active',
  locationId: 'pBSnOK2nkdxp6gf9Rg3o',
  date: '2026-07-20',
} as const;

export type AssetStatus =
  | 'active'
  | 'pending_creation'
  | 'deprecated_existing'
  | 'blocked_ui_or_business_value';
export type SourceOfTruth = 'HighLevel' | 'One Time' | 'Shared';

export type RegistryField = {
  canonicalName: string;
  normalizedName: string;
  ghlId: string;
  ghlKey: string;
  objectType: 'standard_contact_field' | 'contact_custom_field';
  dataType: string;
  category: string;
  purpose: string;
  sourceOfTruth: SourceOfTruth;
  allowedValues: string[];
  workflowsAllowedToWrite: string[];
  oneTimeAllowedToWrite: boolean;
  humansMayEdit: boolean;
  dependencies: string[];
  aliases: string[];
  deprecationState: AssetStatus;
  createdDate: string;
  lastVerifiedDate: string;
  lastTestedDate: string;
};

export type RegistryTag = {
  canonicalName: string;
  normalizedName: string;
  ghlId: string;
  ghlKey: string;
  objectType: 'tag';
  dataType: 'tag';
  category: string;
  purpose: string;
  sourceOfTruth: SourceOfTruth;
  allowedValues: string[];
  workflowsAllowedToWrite: string[];
  oneTimeAllowedToWrite: boolean;
  humansMayEdit: boolean;
  dependencies: string[];
  aliases: string[];
  deprecationState: AssetStatus;
  createdDate: string;
  lastVerifiedDate: string;
  lastTestedDate: string;
};

export type RegistryCustomValue = {
  canonicalName: string;
  normalizedName: string;
  ghlId: string;
  ghlKey: string;
  folder: string;
  objectType: 'custom_value';
  dataType: 'TEXT' | 'URL' | 'STATUS';
  category: string;
  purpose: string;
  value: string;
  sourceOfTruth: SourceOfTruth;
  allowedValues: string[];
  workflowsAllowedToWrite: string[];
  oneTimeAllowedToWrite: boolean;
  humansMayEdit: boolean;
  dependencies: string[];
  aliases: string[];
  deprecationState: AssetStatus;
  createdDate: string;
  lastVerifiedDate: string;
  lastTestedDate: string;
};

export type RegistryWorkflow = {
  key: string;
  canonicalName: string;
  normalizedName: string;
  ghlId: string;
  ghlKey: string;
  objectType: 'business_workflow' | 'bot_action_workflow' | 'deprecated_workflow';
  dataType: 'workflow';
  category: string;
  folder: string;
  purpose: string;
  sourceOfTruth: SourceOfTruth;
  allowedValues: string[];
  workflowsAllowedToWrite: string[];
  oneTimeAllowedToWrite: boolean;
  humansMayEdit: boolean;
  dependencies: string[];
  aliases: string[];
  deprecationState: AssetStatus;
  createdDate: string;
  lastVerifiedDate: string;
  lastTestedDate: string;
  promptPath: string;
  checklistPath: string;
};

const date = registryMetadata.date;

const existingFieldIds: Record<string, { id: string; key: string }> = {
  'One Time CRM Contact ID': { id: 'TRZGYm5rfFdjpYHM0HLL', key: 'contact.one_time_crm_contact_id' },
  'One Time Parent ID': { id: 'xHPAvxHOpvZ6GbrRZBvn', key: 'contact.one_time_parent_id' },
  'One Time Household ID': { id: 'PIuJBPvZGI3FTp4ZRpay', key: 'contact.one_time_household_id' },
  'One Time Customer Status': {
    id: 'eyXioXxAMuaZpxSaRcEN',
    key: 'contact.one_time_customer_status',
  },
  'One Time Current Period End': {
    id: '9dSeNRbmHqRRtQhjJgbx',
    key: 'contact.one_time_current_period_end',
  },
  'One Time Subscription ID': {
    id: 'OYbKjnswrDnv9q06tyNG',
    key: 'contact.one_time_subscription_id',
  },
  'One Time Grace Until': { id: 'JLxk8AOC5lapj3rU6aIi', key: 'contact.one_time_grace_until' },
  'One Time Complimentary Until': {
    id: 'dJZx75HDus1L7oz87MQt',
    key: 'contact.one_time_complimentary_until',
  },
  'One Time Portal Status': { id: 'hxancKIMgrEWUeVSSUYF', key: 'contact.one_time_portal_status' },
  'One Time Access Status': { id: 'FvcsWZAo4OunHogLHyui', key: 'contact.one_time_access_status' },
  'One Time Email Consent': { id: 'olSxPkya7mkkB61vSXHx', key: 'contact.one_time_email_consent' },
  'One Time WhatsApp Consent': {
    id: 'XhBuFbkwtbpD9gyVNDdG',
    key: 'contact.one_time_whatsapp_consent',
  },
  'One Time Suppression State': {
    id: 'rdWsApvquRfHwkzvp5mS',
    key: 'contact.one_time_suppression_state',
  },
  'One Time Suppression Reason': {
    id: '16pDBLnVVV1RyMKgY7wh',
    key: 'contact.one_time_suppression_reason',
  },
  'One Time Signup Source': { id: 'kRNVyi6Fm5N5dobXU9ZL', key: 'contact.one_time_signup_source' },
  'One Time Source Classification': {
    id: 'XoW0UWbGFkwUplKydjZI',
    key: 'contact.one_time_source_classification',
  },
  'One Time Import Batch': { id: 'ixTF2XqjPTUn40LLcYTU', key: 'contact.one_time_import_batch' },
  'One Time Last Sync': { id: 'GQ94IylDxfFf1nbv4Lkw', key: 'contact.one_time_last_sync' },
  'One Time Next Class At': { id: 'yH9qCXXoeIMKIltiiBZM', key: 'contact.one_time_next_class_at' },
  'One Time Class Time Zone': {
    id: 'rUGmHIqjE5XVZxOmy79V',
    key: 'contact.one_time_class_time_zone',
  },
  'One Time Support Status': { id: '73LVTry3sBVEUBeMUIAY', key: 'contact.one_time_support_status' },
};

const existingTagIds: Record<string, string> = {
  'OT | Lead': 'W3sICvTUAAGOQ6Lduu7a',
  'OT | Prelaunch': 'lPRxePKusizYZ5qjlKv2',
  'OT | Checkout Started': 'BadNHkr6A08m8RhGZCK1',
  'OT | Active': 'SXtHZVNE0aWL7nqfSuaI',
  'OT | Grace': 'TN597GG04kP6DsVBiF9d',
  'OT | Canceled': 'aKupBqdvXV91W2eI4H7f',
  'OT | Former': 'E6TzEbLkL4SRrQnVLbpL',
  'OT | Complimentary': 'Bb2F5nNvc7asUyc4kgRh',
  'OT | Portal Invited': 'RvjIOKjtueWAdezLN4Ar',
  'OT | Portal Active': 'lPSHRPcLiURAMyVCrEJO',
  'OT | Email Opt-In': 'beGT917lbxgGc99QQ7jO',
  'OT | WhatsApp Opt-In': 'qN2B1ZWs2saXmTudBgzo',
  'OT | Consent Unknown': '7j9yCOCNunGFfhmm0TaX',
  'OT | Marketing Suppressed': 'uYfDohCdnW4nYiqFbVi6',
  'OT | Signup Website': 'Ladbs8RIkwqNYLd3Zg2s',
  'OT | Signup WhatsApp': 'j9vlQDQ5XFUrj5SVtdve',
  'OT | Source | Rabbi Followers': 'F3kxEGC93isu7v4RaE5V',
  'OT | Source | Subscribed Audience': 'qqqWZ0BDxagiBHiQhg06',
  'OT | Source | Cleaned Audience': 'JDTcyLwjRDImxzwna1M5',
  'OT | Source | Legacy Subscriber': 'AJsgTeWZcIaSP7S7JRLJ',
  'OT | Source | Existing One Time CRM': 'gZ210QaOkEZcUy8LDr6p',
  'OT | Payment Failed': 'TLM5NIIYZLTELU5u7Lx1',
  'OT | Refunded': 'z1Fw6MV2gTXkMhREsD4c',
  'OT | Chargeback': '4Qk836BtHCz2BMSo2ZOe',
  'OT | Class Reminder Pending': 'lxbShmvQw86lJlrHB2B5',
  'OT | Recording Available': 'vfTzZAYNcHEZrJzNzDOi',
  'OT | Duplicate Merged': 'Wc1KT4pP2GE7XN9UE3pU',
  'OT | Identity Conflict': 'q2toHtyOUCEuttsHRBZQ',
  'OT | Support Requested': 'HGoilQNAKGJ1L6OVi8K7',
};

export const customerStatusValues = [
  'Lead',
  'Prelaunch',
  'Migration Invited',
  'Checkout Started',
  'Active',
  'Grace',
  'Canceled',
  'Former',
  'Complimentary',
  'Refunded',
  'Chargeback',
];
export const earlyAccessStatusValues = [
  'Not Invited',
  'Invited',
  'Activated',
  'Declined',
  'Expired',
];
export const migrationStatusValues = [
  'Not Started',
  'Sequence Active',
  'Sequence Complete',
  'Activated',
  'Opted Out',
];
export const portalStatusValues = ['Not Invited', 'Invited', 'Active', 'Suspended', 'Disabled'];
export const accessStatusValues = ['Inactive', 'Active', 'Grace', 'Complimentary', 'Suspended'];
export const emailConsentValues = [
  'opted_in',
  'service_only_current_subscriber',
  'unknown',
  'opted_out',
  'suppressed',
];
export const whatsappConsentValues = ['opted_in', 'unknown', 'opted_out', 'suppressed'];
export const reminderPreferenceValues = ['Email', 'WhatsApp', 'Both', 'None'];
export const suppressionStateValues = [
  'active',
  'email_suppressed',
  'whatsapp_suppressed',
  'all_marketing_suppressed',
];
export const newsletterStatusValues = [
  'Not Eligible',
  'Eligible',
  'Subscribed',
  'Unsubscribed',
  'Suppressed',
];
export const sourceChannelValues = [
  'Website',
  'Website Chat',
  'WhatsApp',
  'GHL Import',
  'One Time CRM',
  'Voice',
];
export const audienceTypeValues = ['Family', 'School'];
export const botRequestTypeValues = [
  'General Question',
  'Signup',
  'Next Class Info',
  'Member Login',
  'Password Help',
  'Opt-Out',
  'Billing Question',
  'Unresolved',
];
export const preferredDeliveryValues = ['Email', 'WhatsApp'];
export const signupStatusValues = ['Collecting', 'Submitted', 'Confirmed', 'Link Sent', 'Failed'];

export const standardContactFields: RegistryField[] = [
  'First Name',
  'Last Name',
  'Full Name',
  'Email',
  'Phone',
  'City',
  'Country',
  'Time Zone',
].map((name) =>
  baseField(
    name,
    'standard_contact_field',
    'standard_identity',
    'Use HighLevel standard contact property.',
    'HighLevel',
    [],
  ),
);

const fieldInputs: Array<{
  name: string;
  category: string;
  purpose: string;
  source: SourceOfTruth;
  allowed?: string[];
  workflows?: string[];
  oneTime?: boolean;
  humans?: boolean;
  aliases?: string[];
  status?: AssetStatus;
}> = [
  {
    name: 'One Time CRM Contact ID',
    category: 'identity_linking',
    purpose: 'Stable One Time CRM-side contact key.',
    source: 'One Time',
    workflows: ['OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Parent ID',
    category: 'identity_linking',
    purpose: 'Opaque One Time parent reference.',
    source: 'One Time',
    workflows: ['OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Household ID',
    category: 'identity_linking',
    purpose: 'Opaque One Time household reference.',
    source: 'One Time',
    workflows: ['OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Customer Status',
    category: 'lifecycle_billing',
    purpose: 'Lifecycle state for routing.',
    source: 'Shared',
    allowed: customerStatusValues,
    workflows: ['OT-01', 'OT-02A', 'OT-02B', 'OT-03', 'OT-04', 'OT-05', 'OT-06', 'OT-13'],
    oneTime: true,
  },
  {
    name: 'One Time Current Period End',
    category: 'lifecycle_billing',
    purpose: 'Billing current period end.',
    source: 'HighLevel',
    workflows: ['OT-04', 'OT-06'],
  },
  {
    name: 'One Time Subscription ID',
    category: 'lifecycle_billing',
    purpose: 'Billing subscription reference.',
    source: 'HighLevel',
    workflows: ['OT-03', 'OT-04', 'OT-05'],
  },
  {
    name: 'One Time Grace Until',
    category: 'lifecycle_billing',
    purpose: 'Grace-period end timestamp.',
    source: 'Shared',
    workflows: ['OT-05'],
    oneTime: true,
  },
  {
    name: 'One Time Complimentary Until',
    category: 'lifecycle_billing',
    purpose: 'Complimentary access end timestamp.',
    source: 'One Time',
    workflows: ['OT-04'],
    oneTime: true,
  },
  {
    name: 'One Time Early Access Status',
    category: 'lifecycle_billing',
    purpose: 'Early-access invitation state.',
    source: 'Shared',
    allowed: earlyAccessStatusValues,
    workflows: ['OT-02A', 'OT-02B'],
    oneTime: true,
  },
  {
    name: 'One Time Migration Status',
    category: 'lifecycle_billing',
    purpose: 'Existing-subscriber migration state.',
    source: 'Shared',
    allowed: migrationStatusValues,
    workflows: ['OT-02A'],
    oneTime: true,
  },
  {
    name: 'One Time Migration Sequence Version',
    category: 'lifecycle_billing',
    purpose: 'Migration sequence version marker.',
    source: 'HighLevel',
    workflows: ['OT-02A'],
  },
  {
    name: 'One Time Portal Status',
    category: 'portal_access',
    purpose: 'Parent portal state, not authorization.',
    source: 'One Time',
    allowed: portalStatusValues,
    workflows: ['OT-07', 'OT-08'],
    oneTime: true,
  },
  {
    name: 'One Time Access Status',
    category: 'portal_access',
    purpose: 'One Time access projection, not set by tag alone.',
    source: 'One Time',
    allowed: accessStatusValues,
    workflows: ['OT-04', 'OT-05', 'OT-06', 'OT-13'],
    oneTime: true,
  },
  {
    name: 'One Time Email Consent',
    category: 'consent_communication',
    purpose: 'Email consent state.',
    source: 'Shared',
    allowed: emailConsentValues,
    workflows: ['OT-01', 'OT-02A', 'OT-02B', 'OT-B01', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time WhatsApp Consent',
    category: 'consent_communication',
    purpose: 'WhatsApp consent state.',
    source: 'Shared',
    allowed: whatsappConsentValues,
    workflows: ['OT-01', 'OT-02A', 'OT-02B', 'OT-B01', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time Reminder Preference',
    category: 'consent_communication',
    purpose: 'Selected reminder channel.',
    source: 'Shared',
    allowed: reminderPreferenceValues,
    workflows: ['OT-B01', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time Consent Policy Version',
    category: 'consent_communication',
    purpose: 'Consent policy version captured.',
    source: 'One Time',
    workflows: ['OT-B01', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time Consent Captured At',
    category: 'consent_communication',
    purpose: 'Consent capture timestamp.',
    source: 'One Time',
    workflows: ['OT-B01', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time Suppression State',
    category: 'consent_communication',
    purpose: 'Suppression state; wins over marketing.',
    source: 'Shared',
    allowed: suppressionStateValues,
    workflows: ['OT-01', 'OT-02A', 'OT-02B', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time Suppression Reason',
    category: 'consent_communication',
    purpose: 'Suppression reason.',
    source: 'Shared',
    workflows: ['OT-01', 'OT-02A', 'OT-02B', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time Newsletter Status',
    category: 'consent_communication',
    purpose: 'Newsletter eligibility/subscription state.',
    source: 'Shared',
    allowed: newsletterStatusValues,
    workflows: ['OT-02B', 'OT-B05'],
    oneTime: true,
  },
  {
    name: 'One Time Signup Source',
    category: 'attribution_import',
    purpose: 'Lead source label.',
    source: 'Shared',
    workflows: ['OT-01', 'OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Source Channel',
    category: 'attribution_import',
    purpose: 'Canonical source channel.',
    source: 'Shared',
    allowed: sourceChannelValues,
    workflows: ['OT-01', 'OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Source Classification',
    category: 'attribution_import',
    purpose: 'Import or lead-source classification.',
    source: 'Shared',
    workflows: ['OT-01', 'OT-02A', 'OT-02B'],
    oneTime: true,
  },
  {
    name: 'One Time Import Batch',
    category: 'attribution_import',
    purpose: 'Protected import batch marker.',
    source: 'HighLevel',
    workflows: ['OT-01'],
  },
  {
    name: 'One Time Audience Type',
    category: 'attribution_import',
    purpose: 'Family or School.',
    source: 'Shared',
    allowed: audienceTypeValues,
    workflows: ['OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Family or School Name',
    category: 'attribution_import',
    purpose: 'Adult-supplied family or school label.',
    source: 'Shared',
    workflows: ['OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Last Sync',
    category: 'attribution_import',
    purpose: 'Last sync timestamp.',
    source: 'Shared',
    workflows: ['OT-01', 'OT-04', 'OT-05', 'OT-06', 'OT-07', 'OT-08', 'OT-13'],
    oneTime: true,
  },
  {
    name: 'One Time Bot Request Type',
    category: 'bot_operation',
    purpose: 'Last public bot request classification.',
    source: 'HighLevel',
    allowed: botRequestTypeValues,
    workflows: ['OT-B01', 'OT-B02', 'OT-B03', 'OT-B04', 'OT-B05'],
  },
  {
    name: 'One Time Preferred Delivery',
    category: 'bot_operation',
    purpose: 'Preferred bot delivery channel.',
    source: 'Shared',
    allowed: preferredDeliveryValues,
    workflows: ['OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Signup Status',
    category: 'bot_operation',
    purpose: 'Bot signup collection/submission state.',
    source: 'Shared',
    allowed: signupStatusValues,
    workflows: ['OT-B01'],
    oneTime: true,
  },
  {
    name: 'One Time Next Class At',
    category: 'classes_content',
    purpose: 'Next class timestamp supplied by One Time.',
    source: 'One Time',
    workflows: ['OT-09', 'OT-B02'],
    oneTime: true,
  },
  {
    name: 'One Time Class Time Zone',
    category: 'classes_content',
    purpose: 'Class time zone.',
    source: 'One Time',
    workflows: ['OT-09', 'OT-B02'],
    oneTime: true,
  },
  {
    name: 'One Time Support Status',
    category: 'deprecated_existing',
    purpose: 'Legacy support marker preserved for ID history; OT-A1 does not create tasks from it.',
    source: 'HighLevel',
    aliases: ['support_requested'],
    status: 'deprecated_existing',
  },
];

export const contactFields: RegistryField[] = fieldInputs.map((input) => {
  const existing = existingFieldIds[input.name];
  return {
    ...baseField(
      input.name,
      'contact_custom_field',
      input.category,
      input.purpose,
      input.source,
      input.allowed ?? [],
    ),
    ghlId: existing?.id ?? '',
    ghlKey: existing?.key ?? `contact.${normalizeAssetName(input.name)}`,
    workflowsAllowedToWrite: input.workflows ?? [],
    oneTimeAllowedToWrite: input.oneTime ?? false,
    humansMayEdit: input.humans ?? false,
    aliases: input.aliases ?? [],
    deprecationState: input.status ?? (existing ? 'active' : 'pending_creation'),
    lastVerifiedDate: existing ? date : '',
    lastTestedDate: existing ? date : '',
  };
});

function baseField(
  canonicalName: string,
  objectType: RegistryField['objectType'],
  category: string,
  purpose: string,
  sourceOfTruth: SourceOfTruth,
  allowedValues: string[],
): RegistryField {
  return {
    canonicalName,
    normalizedName: normalizeAssetName(canonicalName),
    ghlId: '',
    ghlKey: `contact.${normalizeAssetName(canonicalName)}`,
    objectType,
    dataType: objectType === 'standard_contact_field' ? 'STANDARD' : 'TEXT',
    category,
    purpose,
    sourceOfTruth,
    allowedValues,
    workflowsAllowedToWrite: [],
    oneTimeAllowedToWrite: false,
    humansMayEdit: objectType === 'standard_contact_field',
    dependencies: [],
    aliases: [],
    deprecationState: 'active',
    createdDate: date,
    lastVerifiedDate: date,
    lastTestedDate: date,
  };
}

const tagInputs = [
  ['OT | Lead', 'lifecycle', 'Public lead or imported lead.'],
  ['OT | Prelaunch', 'lifecycle', 'Prelaunch audience member.'],
  ['OT | Existing Subscriber', 'lifecycle', 'Known existing subscriber entering migration.'],
  ['OT | Migration 2026', 'lifecycle', '2026 migration audience.'],
  ['OT | Early Access Invited', 'lifecycle', 'Early-access invitation sent or staged.'],
  ['OT | Early Access Activated', 'lifecycle', 'Early-access activation complete.'],
  ['OT | Checkout Started', 'lifecycle', 'Checkout started before payment completes.'],
  ['OT | Active', 'lifecycle', 'Active paid or entitled contact.'],
  ['OT | Grace', 'lifecycle', 'Payment grace window.'],
  ['OT | Canceled', 'lifecycle', 'Canceled subscription state.'],
  ['OT | Former', 'lifecycle', 'Former customer.'],
  ['OT | Complimentary', 'lifecycle', 'Complimentary access holder.'],
  ['OT | Migration Email 1 Sent', 'migration_sequence', 'First migration email sent.'],
  ['OT | Migration Email 2 Sent', 'migration_sequence', 'Second migration email sent.'],
  ['OT | Migration Email 3 Sent', 'migration_sequence', 'Third migration email sent.'],
  ['OT | Migration Sequence Complete', 'migration_sequence', 'Migration sequence complete.'],
  ['OT | Portal Invited', 'portal', 'Parent portal invitation sent.'],
  ['OT | Portal Active', 'portal', 'Parent portal activation observed.'],
  ['OT | Email Opt-In', 'consent_communication', 'Explicit email opt-in marker.'],
  ['OT | WhatsApp Opt-In', 'consent_communication', 'Explicit WhatsApp opt-in marker.'],
  ['OT | Consent Unknown', 'consent_communication', 'Consent unknown; do not send marketing.'],
  ['OT | Marketing Suppressed', 'consent_communication', 'Marketing suppression marker.'],
  ['OT | Weekly Newsletter', 'consent_communication', 'Newsletter audience marker.'],
  ['OT | Signup Website', 'source', 'Signup source was website.'],
  ['OT | Signup WhatsApp', 'source', 'Signup source was WhatsApp.'],
  ['OT | Source | Rabbi Followers', 'source', 'Approved Rabbi followers import source.'],
  ['OT | Source | Subscribed Audience', 'source', 'Approved subscribed audience import source.'],
  ['OT | Source | Cleaned Audience', 'source', 'Approved cleaned audience import source.'],
  ['OT | Source | Legacy Subscriber', 'source', 'Approved legacy subscriber import source.'],
  ['OT | Source | Existing One Time CRM', 'source', 'Existing One Time CRM source.'],
  ['OT | Payment Failed', 'billing', 'Payment failure marker.'],
  ['OT | Refunded', 'billing', 'Refund marker.'],
  ['OT | Chargeback', 'billing', 'Chargeback marker.'],
  ['OT | Class Reminder Pending', 'classes_content', 'Parent class reminder pending.'],
  ['OT | Recording Available', 'classes_content', 'Recording available through protected portal.'],
  ['OT | Duplicate Merged', 'data_quality', 'Duplicate input rows merged.'],
  ['OT | Identity Conflict', 'data_quality', 'Identity conflict requiring protected review.'],
  ['OT | Support Requested', 'deprecated_existing', 'Legacy support tag preserved for ID history.'],
] as const;

export const tags: RegistryTag[] = tagInputs.map(([canonicalName, category, purpose]) => {
  const id = existingTagIds[canonicalName] ?? '';
  const deprecated = category === 'deprecated_existing';
  return {
    canonicalName,
    normalizedName: normalizeAssetName(canonicalName),
    ghlId: id,
    ghlKey: normalizeAssetName(canonicalName),
    objectType: 'tag',
    dataType: 'tag',
    category,
    purpose,
    sourceOfTruth: 'Shared',
    allowedValues: [],
    workflowsAllowedToWrite: [],
    oneTimeAllowedToWrite: false,
    humansMayEdit: false,
    dependencies: [],
    aliases: [],
    deprecationState: deprecated ? 'deprecated_existing' : id ? 'active' : 'pending_creation',
    createdDate: date,
    lastVerifiedDate: id ? date : '',
    lastTestedDate: id ? date : '',
  };
});

const customValueInputs = [
  ['One Time - Brand', 'One Time Brand Name', 'One Time Mishnayos', 'TEXT', 'Public brand name.'],
  ['One Time - Brand', 'One Time Rabbi Name', 'Rabbi Eli Scheller', 'TEXT', 'Public teacher name.'],
  [
    'One Time - Brand',
    'One Time Sender Name',
    'One Time Mishnayos',
    'TEXT',
    'Sender display name.',
  ],
  ['One Time - Brand', 'One Time Sender Email', 'info@onetimeonetime.com', 'TEXT', 'Sender email.'],
  [
    'One Time - Brand',
    'One Time Reply-To Email',
    'info@onetimeonetime.com',
    'TEXT',
    'Reply-to email.',
  ],
  [
    'One Time - Brand',
    'One Time Program Short Description',
    'A live hybrid Mishnayos experience from Eretz Yisrael designed to build consistency, accountability, understanding, and excitement in Torah learning.',
    'TEXT',
    'Approved program summary.',
  ],
  [
    'One Time - URLs',
    'One Time Home URL',
    'https://join.onetimeonetime.com/',
    'URL',
    'Public home URL.',
  ],
  [
    'One Time - URLs',
    'One Time Signup URL',
    'https://join.onetimeonetime.com/signup',
    'URL',
    'Signup URL.',
  ],
  [
    'One Time - URLs',
    'One Time Member Login URL',
    'https://join.onetimeonetime.com/login',
    'URL',
    'Login URL.',
  ],
  [
    'One Time - URLs',
    'One Time Password Help URL',
    'https://join.onetimeonetime.com/forgot-password',
    'URL',
    'Password-help URL.',
  ],
  [
    'One Time - URLs',
    'One Time Parent Portal URL',
    'https://join.onetimeonetime.com/app/parent',
    'URL',
    'Parent portal URL.',
  ],
  [
    'One Time - URLs',
    'One Time Student Portal URL',
    'https://join.onetimeonetime.com/app/student',
    'URL',
    'Student portal URL; not collected by OT-A1.',
  ],
  [
    'One Time - URLs',
    'One Time Early Access URL',
    '',
    'URL',
    'Pending accepted early-access route.',
  ],
  [
    'One Time - URLs',
    'One Time Checkout URL',
    '',
    'URL',
    'Pending verified checkout URL.',
  ],
  [
    'One Time - URLs',
    'One Time Recording Portal URL',
    '',
    'URL',
    'Pending protected portal route.',
  ],
  [
    'One Time - URLs',
    'One Time WhatsApp Entry URL',
    '',
    'URL',
    'Pending verified WhatsApp entry URL.',
  ],
  [
    'One Time - Offer',
    'One Time Complimentary Access Label',
    'A complimentary month of early access',
    'TEXT',
    'Complimentary access label.',
  ],
  ['One Time - Offer', 'One Time Promotion Status', 'inactive', 'STATUS', 'Promotion status.'],
  [
    'One Time - Offer',
    'One Time Promotion End Date Label',
    '',
    'TEXT',
    'Approved promotion end date label.',
  ],
  [
    'One Time - Offer',
    'One Time Pricing Display Status',
    'hidden',
    'STATUS',
    'Price display gate.',
  ],
  [
    'One Time - Offer',
    'One Time Published Price Label',
    '',
    'TEXT',
    'Approved price label when published.',
  ],
  [
    'One Time - Class',
    'One Time Default Time Zone',
    'Asia/Jerusalem',
    'TEXT',
    'Default class timezone.',
  ],
  [
    'One Time - Class',
    'One Time Class Time Israel',
    '7:00 p.m. Israel time',
    'TEXT',
    'Approved normal class time.',
  ],
  ['One Time - Class', 'One Time Schedule Notice', '', 'TEXT', 'Approved schedule notice.'],
  [
    'One Time - Support',
    'One Time Support Email',
    'info@onetimeonetime.com',
    'TEXT',
    'Support email.',
  ],
  [
    'One Time - Bot',
    'One Time Public Bot Name',
    'OT-A1 One Time Enrollment Assistant',
    'TEXT',
    'Canonical public bot name.',
  ],
  ['One Time - Bot', 'One Time Public Bot Version', '1.0.0', 'TEXT', 'Canonical bot version.'],
  [
    'One Time - Bot',
    'One Time Knowledge Base Version',
    '1.0.0',
    'TEXT',
    'Canonical knowledge-base version.',
  ],
] as const;

export const customValues: RegistryCustomValue[] = customValueInputs.map(
  ([folder, canonicalName, value, dataType, purpose]) => ({
    canonicalName,
    normalizedName: normalizeAssetName(canonicalName),
    ghlId: '',
    ghlKey: normalizeAssetName(canonicalName),
    folder,
    objectType: 'custom_value',
    dataType,
    category: normalizeAssetName(folder),
    purpose,
    value,
    sourceOfTruth: 'Shared',
    allowedValues:
      canonicalName === 'One Time Pricing Display Status'
        ? ['hidden', 'published']
        : canonicalName === 'One Time Promotion Status'
          ? ['active', 'inactive']
          : [],
    workflowsAllowedToWrite: [],
    oneTimeAllowedToWrite: false,
    humansMayEdit: true,
    dependencies:
      canonicalName === 'One Time Published Price Label' ? ['One Time Pricing Display Status'] : [],
    aliases: [],
    deprecationState: value ? 'pending_creation' : 'blocked_ui_or_business_value',
    createdDate: date,
    lastVerifiedDate: '',
    lastTestedDate: '',
  }),
);

const businessWorkflowInputs = [
  [
    'OT-01',
    'OT-01 New Lead Intake',
    '00 - Intake & Data',
    'Lead intake after public signup or bot action.',
  ],
  [
    'OT-02A',
    'OT-02A Existing Subscriber Migration 2026 v1',
    '10 - Nurture & Sales',
    'Three-email existing-subscriber migration sequence.',
  ],
  [
    'OT-02B',
    'OT-02B New Lead Nurture v1',
    '10 - Nurture & Sales',
    'New lead nurture separate from migration.',
  ],
  [
    'OT-03',
    'OT-03 Checkout Started / Abandoned',
    '20 - Billing & Access',
    'Checkout started and abandoned checkout handling.',
  ],
  ['OT-04', 'OT-04 Payment Active', '20 - Billing & Access', 'Active payment state handling.'],
  [
    'OT-05',
    'OT-05 Payment Failed / Grace',
    '20 - Billing & Access',
    'Payment failure and grace handling.',
  ],
  ['OT-06', 'OT-06 Subscription Canceled', '20 - Billing & Access', 'Cancellation handling.'],
  [
    'OT-07',
    'OT-07 Parent Portal Invitation',
    '30 - Portal Lifecycle',
    'Parent portal invitation after One Time access confirmation.',
  ],
  [
    'OT-08',
    'OT-08 Parent Portal Activated',
    '30 - Portal Lifecycle',
    'Parent portal activation projection.',
  ],
  [
    'OT-09',
    'OT-09 Parent Class Reminder',
    '40 - Classes & Content',
    'Parent class reminder gated by access and consent.',
  ],
  [
    'OT-10',
    'OT-10 New Recording Available',
    '40 - Classes & Content',
    'Protected recording availability notice.',
  ],
  [
    'OT-13',
    'OT-13 Refund / Chargeback',
    '20 - Billing & Access',
    'Refund and chargeback handling.',
  ],
] as const;

const botActionWorkflowInputs = [
  [
    'OT-B01',
    'OT-B01 Complete Signup',
    '00 - Intake & Data',
    'Typed bot action adapter for adult signup.',
  ],
  [
    'OT-B02',
    'OT-B02 Send Next Confirmed Class Info',
    '40 - Classes & Content',
    'Safe next confirmed class info adapter.',
  ],
  [
    'OT-B03',
    'OT-B03 Send Member Login',
    '30 - Portal Lifecycle',
    'Send canonical member login URL.',
  ],
  [
    'OT-B04',
    'OT-B04 Send Password Help',
    '30 - Portal Lifecycle',
    'Send canonical password-help URL.',
  ],
  [
    'OT-B05',
    'OT-B05 Apply Opt-Out',
    '00 - Intake & Data',
    'Apply opt-out, DND, suppression and stop bot follow-up.',
  ],
] as const;

const deprecatedWorkflowInputs = [
  [
    'OT-11',
    'OT-11 WhatsApp Lead Qualification',
    '00 - Intake & Data',
    'Superseded by OT-A1 and OT-B01.',
  ],
  [
    'OT-12',
    'OT-12 Support Intake / Technical Escalation',
    '50 - Support',
    'Deprecated when it creates tasks or support escalation workflows.',
  ],
  [
    'OT-HUMAN-HANDOFF',
    'OT - Human Handoff',
    '50 - Support',
    'Human handoff workflow is not active for OT-A1.',
  ],
] as const;

export const businessWorkflows = businessWorkflowInputs.map((input) =>
  workflowFromInput(input, 'business_workflow', 'pending_creation'),
);
export const botActionWorkflows = botActionWorkflowInputs.map((input) =>
  workflowFromInput(input, 'bot_action_workflow', 'pending_creation'),
);
export const deprecatedWorkflows = deprecatedWorkflowInputs.map((input) =>
  workflowFromInput(input, 'deprecated_workflow', 'deprecated_existing'),
);
export const workflows = [...businessWorkflows, ...botActionWorkflows, ...deprecatedWorkflows];

function workflowFromInput(
  input: readonly [string, string, string, string],
  objectType: RegistryWorkflow['objectType'],
  deprecationState: AssetStatus,
): RegistryWorkflow {
  const [key, canonicalName, folder, purpose] = input;
  const fileBase = `${key}-${fileSlug(canonicalName.replace(`${key} `, ''))}.md`;
  return {
    key,
    canonicalName,
    normalizedName: normalizeAssetName(canonicalName),
    ghlId: '',
    ghlKey: normalizeAssetName(canonicalName),
    objectType,
    dataType: 'workflow',
    category: objectType,
    folder,
    purpose,
    sourceOfTruth: 'Shared',
    allowedValues: [],
    workflowsAllowedToWrite: [],
    oneTimeAllowedToWrite: false,
    humansMayEdit: true,
    dependencies: [],
    aliases: [],
    deprecationState,
    createdDate: date,
    lastVerifiedDate: '',
    lastTestedDate: '',
    promptPath:
      objectType === 'deprecated_workflow'
        ? ''
        : `integrations/highlevel/ai-workflow-prompts/${fileBase}`,
    checklistPath:
      objectType === 'deprecated_workflow'
        ? ''
        : `integrations/highlevel/workflow-checklists/${fileBase}`,
  };
}

export const lowercaseTagDeprecations = [
  {
    legacy: 'one-time',
    replacement: 'No canonical replacement required; preserve only for historical reporting.',
  },
  { legacy: 'one-time-bot', replacement: 'One Time Source Channel' },
  {
    legacy: 'one-time-signup-request',
    replacement: 'One Time Signup Status = Collecting or Submitted',
  },
  { legacy: 'one-time-signup-submitted', replacement: 'One Time Signup Status = Submitted' },
  { legacy: 'one-time-signup-confirmed', replacement: 'One Time Signup Status = Confirmed' },
  {
    legacy: 'one-time-class-link-request',
    replacement: 'One Time Bot Request Type = Next Class Info',
  },
  { legacy: 'one-time-password-reset', replacement: 'One Time Bot Request Type = Password Help' },
  {
    legacy: 'one-time-human-handoff',
    replacement: 'No replacement; disable and remove from active workflows.',
  },
  {
    legacy: 'one-time-opt-out',
    replacement:
      'OT | Marketing Suppressed, channel DND, consent field update, suppression field update.',
  },
];

export const protectedImportPaths = {
  directory: 'C:/Users/User/.onetime-highlevel-private/imports',
  csv: 'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contacts.csv',
  manifest:
    'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-manifest.private.json',
  contactMap:
    'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-contact-map.private.json',
  errors:
    'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-errors.private.json',
  reconciliation:
    'C:/Users/User/.onetime-highlevel-private/imports/one-time-ghl-import-reconciliation.private.json',
} as const;

export function normalizeAssetName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function fileSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
