export const EXECUTABLE_WORKFLOW_JOB_IDS = [
  'GHL-UI-14',
  'GHL-UI-15',
  'GHL-UI-16',
  'GHL-UI-17',
  'GHL-UI-18',
] as const;

export type ExecutableWorkflowJobId = (typeof EXECUTABLE_WORKFLOW_JOB_IDS)[number];

type RegisteredAsset = {
  canonical_name: string;
  ghl_id: string;
  key: string;
};

type MessageCopy = {
  message_class: string;
  subject: string;
  preheader: string;
  body: string;
  cta: {
    label: string;
    protected_reference_path: '/signup' | '/app/parent';
    custom_value: RegisteredAsset;
  };
  footer: string;
};

export type ExecutableWorkflowSpec = {
  job_id: ExecutableWorkflowJobId;
  order: number;
  title: string;
  workflow: {
    canonical_key: 'OT-01' | 'OT-07' | 'OT-08' | 'OT-09' | 'OT-10';
    canonical_name: string;
    ghl_id: string;
    full_folder_ancestry: string;
    folder_ids: Record<string, string>;
    observed_state: 'DRAFT_SHELL';
    desired_transition: ['DRAFT_SHELL', 'SAVED_REOPENED', 'ACTIVE_TESTED'];
  };
  application_contract: {
    version: '1.0.0';
    event_name:
      | 'adult.signup.submitted'
      | 'parent.portal.invitation_requested'
      | 'parent.portal.activated'
      | 'class.reminder.requested'
      | 'recording.available';
    adult_only: true;
    trigger_tag: RegisteredAsset;
    exact_filters: string[];
    projected_fields: RegisteredAsset[];
    producer_authority: string;
  };
  enrollment_policy: {
    reentry: string;
    dedupe: string;
    cleanup: string;
  };
  ordered_steps: Array<{
    order: number;
    kind: 'trigger' | 'branch' | 'wait' | 'email' | 'cleanup';
    name: string;
    exact_configuration: string;
  }>;
  message: MessageCopy;
  sender: {
    sender_key: 'brand';
    display_name: RegisteredAsset;
    from: RegisteredAsset;
    reply_to: RegisteredAsset;
  };
  suppression_precedence: string[];
  configuration_run: {
    messages_sent: 0;
    contacts_created: 0;
    contacts_enrolled: 0;
    broad_sends: 0;
  };
  controlled_test: {
    separate_explicit_authorization_required: true;
    operator_owned_adult_contacts_max: 1;
    synthetic_events_max: 1;
    messages_max: 1;
    broad_sends: 0;
    required_proof: string[];
  };
  save_reopen_readback: string[];
  rollback_disable: string[];
  terminal_states: string[];
  safe_evidence_fields: string[];
  forbidden_evidence_fields: string[];
};

const brandSender: ExecutableWorkflowSpec['sender'] = {
  sender_key: 'brand',
  display_name: {
    canonical_name: 'One Time Brand Sender Name',
    ghl_id: 'XyASPYbVa4ZBHuJe2yJI',
    key: 'one_time_brand_sender_name',
  },
  from: {
    canonical_name: 'One Time Brand From',
    ghl_id: 'o9aOerC0VSMKzDv4hrkX',
    key: 'one_time_brand_from',
  },
  reply_to: {
    canonical_name: 'One Time Default Reply-To',
    ghl_id: 'u0msWwGUDL4Upjfe58Bm',
    key: 'one_time_default_reply_to',
  },
};

const emailConsent = {
  canonical_name: 'One Time Email Consent',
  ghl_id: 'olSxPkya7mkkB61vSXHx',
  key: 'contact.one_time_email_consent',
};
const suppressionState = {
  canonical_name: 'One Time Suppression State',
  ghl_id: 'rdWsApvquRfHwkzvp5mS',
  key: 'contact.one_time_suppression_state',
};
const crmContactId = {
  canonical_name: 'One Time CRM Contact ID',
  ghl_id: 'TRZGYm5rfFdjpYHM0HLL',
  key: 'contact.one_time_crm_contact_id',
};
const portalStatus = {
  canonical_name: 'One Time Portal Status',
  ghl_id: 'hxancKIMgrEWUeVSSUYF',
  key: 'contact.one_time_portal_status',
};
const nextClassAt = {
  canonical_name: 'One Time Next Class At',
  ghl_id: 'yH9qCXXoeIMKIltiiBZM',
  key: 'contact.one_time_next_class_at',
};
const classTimeZone = {
  canonical_name: 'One Time Class Time Zone',
  ghl_id: 'rUGmHIqjE5XVZxOmy79V',
  key: 'contact.one_time_class_time_zone',
};
const signupUrl = {
  canonical_name: 'One Time Signup URL',
  ghl_id: 'Don4uQa4aJOc3wYYErgd',
  key: 'one_time_signup_url',
};
const parentPortalUrl = {
  canonical_name: 'One Time Parent Portal URL',
  ghl_id: 'ixqb7lPdQZmyCmMilVno',
  key: 'one_time_parent_portal_url',
};

const commonFilters = [
  'One Time CRM Contact ID is present and belongs to an adult contact projection.',
  'One Time Email Consent equals the application contract value granted.',
  'One Time Suppression State equals active.',
  'Email is present and syntactically valid.',
  'HighLevel email DND is false.',
  'No unsubscribe, complaint, hard-bounce, or global suppression state is present.',
];

const commonSuppression = [
  'Global suppression, explicit opt-out, unsubscribe, complaint, and hard bounce always win.',
  'Email DND always wins over the trigger tag and every positive field.',
  'A missing or non-granted email permission fails closed with no email action.',
  'Do not infer permission from a tag, a portal status, household entitlement, or newsletter state.',
  'Do not add a WhatsApp action; these five jobs are email-only.',
];

const commonConfigurationRun: ExecutableWorkflowSpec['configuration_run'] = {
  messages_sent: 0,
  contacts_created: 0,
  contacts_enrolled: 0,
  broad_sends: 0,
};

const commonControlledTest: ExecutableWorkflowSpec['controlled_test'] = {
  separate_explicit_authorization_required: true,
  operator_owned_adult_contacts_max: 1,
  synthetic_events_max: 1,
  messages_max: 1,
  broad_sends: 0,
  required_proof: [
    'Record a sanitized canary run identifier, allowlisted delivery-key hash, and budget of exactly one.',
    'Prove the application event and provider operation receipt completed before the workflow test.',
    'Prove one enrollment and at most one operator-owned email delivery.',
    'Replay the same application idempotency key and prove no second provider intent, enrollment, or email.',
    'Prove an ineligible or suppressed replay sends nothing.',
  ],
};

const commonSaveReadback = [
  'Save the email action layer.',
  'Save the outer workflow layer.',
  'Navigate away, reload, and reopen the exact workflow ID.',
  'Read back the trigger tag, every filter, action order, sender pickers, subject, body, CTA, and cleanup.',
  'Keep the workflow Draft when any readback differs or the matching deployed contract is absent.',
  'Publish only after exact readback and the separately authorized one-contact test prerequisites are present.',
];

const commonRollback = [
  'Turn the exact workflow publish switch off and save.',
  'Reopen the same workflow ID and verify Draft.',
  'Do not delete, clone, rename, or move the workflow.',
  'Do not remove unrelated contact tags or fields.',
];

const commonTerminalStates = [
  'SAVED_REOPENED',
  'ACTIVE_CONFIGURED',
  'ACTIVE_TESTED',
  'DRAFT_WAITING_EXTERNAL(<exact contract or canary dependency>)',
  'DRAFT_NEEDS_OPERATOR_DECISION(<exact choice>)',
  'FAILED_CLOSED(<exact mismatch>)',
];

const commonEvidenceFields = [
  'job_id',
  'workflow_key',
  'workflow_id',
  'full_folder_ancestry',
  'observed_trigger_and_filter_summary',
  'sender_picker_keys',
  'action_save_readback',
  'outer_save_readback',
  'publish_state',
  'sanitized_canary_run_hash',
  'sanitized_application_event_hash',
  'sanitized_workflow_execution_reference',
  'messages_sent_count',
  'broad_sends_count',
  'student_contacts_created_count',
  'replay_result',
  'terminal_state',
  'remaining_dependency',
];

const commonForbiddenEvidence = [
  'contact names, email addresses, phone numbers, or private destinations',
  'message provider payloads or rendered recipient message bodies',
  'security tokens, credentials, secrets, nonces, signatures, or raw headers',
  'Student identity, credentials, learning records, or contact records',
  'raw Zoom, Vimeo, meeting-provider, or storage-provider URLs',
];

const newsletterFooter =
  'You are receiving this email because you asked for One Time email updates. Use the unsubscribe link in this email to stop optional email updates.';

export const executableWorkflowSpecs: ExecutableWorkflowSpec[] = [
  {
    job_id: 'GHL-UI-14',
    order: 14,
    title: 'activate OT-01',
    workflow: {
      canonical_key: 'OT-01',
      canonical_name: 'OT-01 New Lead Intake',
      ghl_id: '95a6f461-1a04-4260-b379-246fdcc45af7',
      full_folder_ancestry: 'One Time / 00 - Intake & Data',
      folder_ids: {
        root: 'da1f8359-f399-477e-89b1-61a47d1b3db0',
        leaf: '35b75aaa-7b52-44a6-ada6-646f621b69b6',
      },
      observed_state: 'DRAFT_SHELL',
      desired_transition: ['DRAFT_SHELL', 'SAVED_REOPENED', 'ACTIVE_TESTED'],
    },
    application_contract: {
      version: '1.0.0',
      event_name: 'adult.signup.submitted',
      adult_only: true,
      trigger_tag: {
        canonical_name: 'OT | Lead',
        ghl_id: 'W3sICvTUAAGOQ6Lduu7a',
        key: 'ot_lead',
      },
      exact_filters: commonFilters,
      projected_fields: [crmContactId, emailConsent, suppressionState],
      producer_authority:
        'The transactional adult signup producer emits only after the source transaction and the dispatcher projects OT | Lead once through its durable receipt.',
    },
    enrollment_policy: {
      reentry:
        'Allow re-entry only after the prior run completed and OT | Lead was removed for a later distinct signup event.',
      dedupe:
        'The application event idempotency key and durable provider operation receipt are authoritative; a replay must not add the trigger tag again.',
      cleanup: 'After the email action succeeds, remove only OT | Lead.',
    },
    ordered_steps: [
      {
        order: 1,
        kind: 'trigger',
        name: 'Adult signup projection',
        exact_configuration: 'Contact Tag Added: OT | Lead (W3sICvTUAAGOQ6Lduu7a).',
      },
      {
        order: 2,
        kind: 'branch',
        name: 'Adult email eligibility',
        exact_configuration: commonFilters.join(' '),
      },
      {
        order: 3,
        kind: 'email',
        name: 'Signup confirmation',
        exact_configuration: 'Send the exact email copy and CTA defined in this job.',
      },
      {
        order: 4,
        kind: 'cleanup',
        name: 'Clear trigger tag',
        exact_configuration: 'Remove only OT | Lead after the email action succeeds.',
      },
    ],
    message: {
      message_class: 'signup_confirmation',
      subject: 'Welcome to One Time Mishnayos',
      preheader: 'Your signup was received.',
      body: 'Hello,\n\nThank you for signing up for One Time Mishnayos. We received your information and will use it only for the One Time updates you requested.\n\nYou can review the One Time signup page below.\n\nWith bracha,\nOne Time Mishnayos',
      cta: {
        label: 'Review One Time signup',
        protected_reference_path: '/signup',
        custom_value: signupUrl,
      },
      footer: newsletterFooter,
    },
    sender: brandSender,
    suppression_precedence: commonSuppression,
    configuration_run: commonConfigurationRun,
    controlled_test: commonControlledTest,
    save_reopen_readback: commonSaveReadback,
    rollback_disable: commonRollback,
    terminal_states: commonTerminalStates,
    safe_evidence_fields: commonEvidenceFields,
    forbidden_evidence_fields: commonForbiddenEvidence,
  },
  {
    job_id: 'GHL-UI-15',
    order: 15,
    title: 'activate OT-07',
    workflow: {
      canonical_key: 'OT-07',
      canonical_name: 'OT-07 Parent Portal Invitation',
      ghl_id: 'fb48c3bf-7154-44c9-825e-88afb5bb7942',
      full_folder_ancestry: 'One Time / 30 - Portal Lifecycle',
      folder_ids: {
        root: 'da1f8359-f399-477e-89b1-61a47d1b3db0',
        leaf: '250ff9f0-4985-46c0-a587-f7e3a0251bab',
      },
      observed_state: 'DRAFT_SHELL',
      desired_transition: ['DRAFT_SHELL', 'SAVED_REOPENED', 'ACTIVE_TESTED'],
    },
    application_contract: {
      version: '1.0.0',
      event_name: 'parent.portal.invitation_requested',
      adult_only: true,
      trigger_tag: {
        canonical_name: 'OT | Portal Invited',
        ghl_id: 'RvjIOKjtueWAdezLN4Ar',
        key: 'ot_portal_invited',
      },
      exact_filters: [...commonFilters, 'One Time Portal Status equals invited.'],
      projected_fields: [crmContactId, emailConsent, suppressionState, portalStatus],
      producer_authority:
        'The Parent lifecycle producer emits only for an eligible adult household after the invitation transaction; One Time/Resend separately owns activation-token creation and delivery.',
    },
    enrollment_policy: {
      reentry:
        'Allow re-entry only after the prior run completed and OT | Portal Invited was removed for a later distinct invitation request.',
      dedupe:
        'The application event idempotency key and durable provider operation receipt are authoritative; replay must not create a second companion.',
      cleanup: 'After the companion email action succeeds, remove only OT | Portal Invited.',
    },
    ordered_steps: [
      {
        order: 1,
        kind: 'trigger',
        name: 'Eligible Parent invitation projection',
        exact_configuration: 'Contact Tag Added: OT | Portal Invited (RvjIOKjtueWAdezLN4Ar).',
      },
      {
        order: 2,
        kind: 'branch',
        name: 'Invited adult email eligibility',
        exact_configuration: [...commonFilters, 'One Time Portal Status equals invited.'].join(' '),
      },
      {
        order: 3,
        kind: 'email',
        name: 'Non-token invitation companion',
        exact_configuration:
          'Send only the exact non-token companion defined here; do not include or map activation, verification, login-challenge, or reset tokens.',
      },
      {
        order: 4,
        kind: 'cleanup',
        name: 'Clear trigger tag',
        exact_configuration: 'Remove only OT | Portal Invited after the email action succeeds.',
      },
    ],
    message: {
      message_class: 'portal_welcome',
      subject: 'Your One Time Parent Portal invitation',
      preheader: 'Look for a separate secure account email from One Time.',
      body: 'Hello,\n\nYour household is eligible for the One Time Parent Portal. One Time will send the secure activation link separately by email. For your security, this message does not contain an activation or password-reset link.\n\nAfter you complete activation, you can open the Parent Portal below.\n\nWith bracha,\nOne Time Mishnayos',
      cta: {
        label: 'Open Parent Portal',
        protected_reference_path: '/app/parent',
        custom_value: parentPortalUrl,
      },
      footer: newsletterFooter,
    },
    sender: brandSender,
    suppression_precedence: commonSuppression,
    configuration_run: commonConfigurationRun,
    controlled_test: commonControlledTest,
    save_reopen_readback: commonSaveReadback,
    rollback_disable: commonRollback,
    terminal_states: commonTerminalStates,
    safe_evidence_fields: commonEvidenceFields,
    forbidden_evidence_fields: [
      ...commonForbiddenEvidence,
      'activation, verification, login-challenge, or password-reset token values',
    ],
  },
  {
    job_id: 'GHL-UI-16',
    order: 16,
    title: 'activate OT-08',
    workflow: {
      canonical_key: 'OT-08',
      canonical_name: 'OT-08 Parent Portal Activated',
      ghl_id: 'eeca2efb-41be-40a7-bbc4-ee6fe8760dd9',
      full_folder_ancestry: 'One Time / 30 - Portal Lifecycle',
      folder_ids: {
        root: 'da1f8359-f399-477e-89b1-61a47d1b3db0',
        leaf: '250ff9f0-4985-46c0-a587-f7e3a0251bab',
      },
      observed_state: 'DRAFT_SHELL',
      desired_transition: ['DRAFT_SHELL', 'SAVED_REOPENED', 'ACTIVE_TESTED'],
    },
    application_contract: {
      version: '1.0.0',
      event_name: 'parent.portal.activated',
      adult_only: true,
      trigger_tag: {
        canonical_name: 'OT | Portal Active',
        ghl_id: 'lPSHRPcLiURAMyVCrEJO',
        key: 'ot_portal_active',
      },
      exact_filters: [...commonFilters, 'One Time Portal Status equals active.'],
      projected_fields: [crmContactId, emailConsent, suppressionState, portalStatus],
      producer_authority:
        'The Parent lifecycle producer emits after One Time records the adult Parent portal activation transaction.',
    },
    enrollment_policy: {
      reentry:
        'Allow re-entry only after the prior run completed and OT | Portal Active was removed for a later distinct activation event.',
      dedupe:
        'The application event idempotency key and durable provider operation receipt are authoritative; replay must not create a second welcome.',
      cleanup: 'After the portal-ready email succeeds, remove only OT | Portal Active.',
    },
    ordered_steps: [
      {
        order: 1,
        kind: 'trigger',
        name: 'Parent portal activation projection',
        exact_configuration: 'Contact Tag Added: OT | Portal Active (lPSHRPcLiURAMyVCrEJO).',
      },
      {
        order: 2,
        kind: 'branch',
        name: 'Active adult email eligibility',
        exact_configuration: [...commonFilters, 'One Time Portal Status equals active.'].join(' '),
      },
      {
        order: 3,
        kind: 'email',
        name: 'Portal activated notice',
        exact_configuration: 'Send the exact protected-portal email defined in this job.',
      },
      {
        order: 4,
        kind: 'cleanup',
        name: 'Clear trigger tag',
        exact_configuration: 'Remove only OT | Portal Active after the email action succeeds.',
      },
    ],
    message: {
      message_class: 'portal_activated',
      subject: 'Your One Time Parent Portal is ready',
      preheader: 'Your Parent Portal access is active.',
      body: 'Hello,\n\nYour One Time Parent Portal is now active. You can use it to manage your household and reach protected One Time class and learning resources.\n\nOpen the Parent Portal below.\n\nWith bracha,\nOne Time Mishnayos',
      cta: {
        label: 'Open Parent Portal',
        protected_reference_path: '/app/parent',
        custom_value: parentPortalUrl,
      },
      footer: newsletterFooter,
    },
    sender: brandSender,
    suppression_precedence: commonSuppression,
    configuration_run: commonConfigurationRun,
    controlled_test: commonControlledTest,
    save_reopen_readback: commonSaveReadback,
    rollback_disable: commonRollback,
    terminal_states: commonTerminalStates,
    safe_evidence_fields: commonEvidenceFields,
    forbidden_evidence_fields: commonForbiddenEvidence,
  },
  {
    job_id: 'GHL-UI-17',
    order: 17,
    title: 'activate OT-09',
    workflow: {
      canonical_key: 'OT-09',
      canonical_name: 'OT-09 Parent Class Reminder',
      ghl_id: 'bc8af9fc-22d5-4b4f-b71a-121eeff87f5b',
      full_folder_ancestry: 'One Time / 40 - Learning Operations / Classes',
      folder_ids: {
        root: 'da1f8359-f399-477e-89b1-61a47d1b3db0',
        parent: '37cce184-3c98-4229-a3ac-55e457f85d0c',
        leaf: '3fcc9185-8bb6-4158-9055-90d732db9bc5',
      },
      observed_state: 'DRAFT_SHELL',
      desired_transition: ['DRAFT_SHELL', 'SAVED_REOPENED', 'ACTIVE_TESTED'],
    },
    application_contract: {
      version: '1.0.0',
      event_name: 'class.reminder.requested',
      adult_only: true,
      trigger_tag: {
        canonical_name: 'OT | Class Reminder Pending',
        ghl_id: 'lxbShmvQw86lJlrHB2B5',
        key: 'ot_class_reminder_pending',
      },
      exact_filters: [
        ...commonFilters,
        'One Time Next Class At is present.',
        'One Time Class Time Zone is present.',
        'The application event receipt proves a confirmed occurrence and entitled adult household.',
      ],
      projected_fields: [crmContactId, emailConsent, suppressionState, nextClassAt, classTimeZone],
      producer_authority:
        'The class producer emits only for a confirmed occurrence and entitled adult household and supplies starts_at plus timezone.',
    },
    enrollment_policy: {
      reentry:
        'Allow re-entry only after the prior run completed and OT | Class Reminder Pending was removed for a later distinct occurrence key.',
      dedupe:
        'The application idempotency scope includes the occurrence and adult contact; replay must not create a second reminder.',
      cleanup: 'After send or late-arrival skip, remove only OT | Class Reminder Pending.',
    },
    ordered_steps: [
      {
        order: 1,
        kind: 'trigger',
        name: 'Confirmed class reminder projection',
        exact_configuration:
          'Contact Tag Added: OT | Class Reminder Pending (lxbShmvQw86lJlrHB2B5).',
      },
      {
        order: 2,
        kind: 'branch',
        name: 'Class and adult email eligibility',
        exact_configuration:
          'Require all common gates, a supplied class timestamp and timezone, and the confirmed-and-entitled application receipt.',
      },
      {
        order: 3,
        kind: 'branch',
        name: 'Late-arrival decision',
        exact_configuration:
          'If One Time Next Class At is at or before now, skip the email and continue to cleanup. If it is after now and within 30 minutes, send immediately. Otherwise continue to the event-relative wait.',
      },
      {
        order: 4,
        kind: 'wait',
        name: 'Thirty minutes before class',
        exact_configuration:
          'Use the HighLevel event-relative wait tied to One Time Next Class At, exactly 30 minutes before the field value. Do not use a fixed clock time.',
      },
      {
        order: 5,
        kind: 'branch',
        name: 'Final suppression recheck',
        exact_configuration:
          'Immediately before send, re-evaluate permission, suppression, DND, unsubscribe, complaint, hard-bounce, future starts_at, and the same occurrence scope.',
      },
      {
        order: 6,
        kind: 'email',
        name: 'Thirty-minute class reminder',
        exact_configuration: 'Send the exact protected Parent Portal reminder defined here.',
      },
      {
        order: 7,
        kind: 'cleanup',
        name: 'Clear trigger tag',
        exact_configuration:
          'Remove only OT | Class Reminder Pending after send or late-arrival skip.',
      },
    ],
    message: {
      message_class: 'class_reminder',
      subject: 'Your One Time class starts in 30 minutes',
      preheader: 'Open the Parent Portal for your protected class access.',
      body: 'Hello,\n\nYour confirmed One Time class begins at {{contact.one_time_next_class_at}} ({{contact.one_time_class_time_zone}}).\n\nOpen the Parent Portal when it is time to join. The protected class access is available there; this email does not contain a provider link.\n\nWith bracha,\nOne Time Mishnayos',
      cta: {
        label: 'Open Parent Portal',
        protected_reference_path: '/app/parent',
        custom_value: parentPortalUrl,
      },
      footer: newsletterFooter,
    },
    sender: brandSender,
    suppression_precedence: commonSuppression,
    configuration_run: commonConfigurationRun,
    controlled_test: {
      ...commonControlledTest,
      required_proof: [
        ...commonControlledTest.required_proof,
        'Use one fictional future confirmed occurrence and prove the 30-minute wait or immediate-within-window branch.',
      ],
    },
    save_reopen_readback: commonSaveReadback,
    rollback_disable: commonRollback,
    terminal_states: commonTerminalStates,
    safe_evidence_fields: [
      ...commonEvidenceFields,
      'sanitized_occurrence_reference',
      'wait_branch',
    ],
    forbidden_evidence_fields: commonForbiddenEvidence,
  },
  {
    job_id: 'GHL-UI-18',
    order: 18,
    title: 'activate OT-10',
    workflow: {
      canonical_key: 'OT-10',
      canonical_name: 'OT-10 New Recording Available',
      ghl_id: '1bca5210-a3b9-496b-b3cd-48c60c0e33ca',
      full_folder_ancestry: 'One Time / 40 - Learning Operations / Content',
      folder_ids: {
        root: 'da1f8359-f399-477e-89b1-61a47d1b3db0',
        parent: '37cce184-3c98-4229-a3ac-55e457f85d0c',
        leaf: '196a6d36-f31c-40e6-88b3-aa5abdb267e3',
      },
      observed_state: 'DRAFT_SHELL',
      desired_transition: ['DRAFT_SHELL', 'SAVED_REOPENED', 'ACTIVE_TESTED'],
    },
    application_contract: {
      version: '1.0.0',
      event_name: 'recording.available',
      adult_only: true,
      trigger_tag: {
        canonical_name: 'OT | Recording Available',
        ghl_id: 'vfTzZAYNcHEZrJzNzDOi',
        key: 'ot_recording_available',
      },
      exact_filters: [
        ...commonFilters,
        'The application event receipt proves approved content and an entitled adult household.',
        'The protected reference is exactly one_time_path:/app/parent.',
      ],
      projected_fields: [crmContactId, emailConsent, suppressionState],
      producer_authority:
        'The recording producer emits only for approved content and entitled adult households and supplies the first-party protected reference /app/parent.',
    },
    enrollment_policy: {
      reentry:
        'Allow re-entry only after the prior run completed and OT | Recording Available was removed for a later distinct content item key.',
      dedupe:
        'The application idempotency scope includes the approved content item and adult contact; replay must not create a second notice.',
      cleanup: 'After the recording notice succeeds, remove only OT | Recording Available.',
    },
    ordered_steps: [
      {
        order: 1,
        kind: 'trigger',
        name: 'Approved recording projection',
        exact_configuration: 'Contact Tag Added: OT | Recording Available (vfTzZAYNcHEZrJzNzDOi).',
      },
      {
        order: 2,
        kind: 'branch',
        name: 'Content and adult email eligibility',
        exact_configuration:
          'Require all common gates plus the approved-content, entitled-household application receipt and protected /app/parent reference.',
      },
      {
        order: 3,
        kind: 'email',
        name: 'Protected recording notice',
        exact_configuration:
          'Send the exact recording notice defined here using One Time Parent Portal URL; never use the unresolved recording URL custom value or a raw provider URL.',
      },
      {
        order: 4,
        kind: 'cleanup',
        name: 'Clear trigger tag',
        exact_configuration:
          'Remove only OT | Recording Available after the email action succeeds.',
      },
    ],
    message: {
      message_class: 'recording_available',
      subject: 'A new One Time recording is ready',
      preheader: 'Watch it in your protected Parent Portal.',
      body: 'Hello,\n\nA new One Time recording is available for your household. Open the protected Parent Portal to watch it.\n\nThis email does not contain a Vimeo, storage-provider, or direct media link.\n\nWith bracha,\nOne Time Mishnayos',
      cta: {
        label: 'View recording in Parent Portal',
        protected_reference_path: '/app/parent',
        custom_value: parentPortalUrl,
      },
      footer: newsletterFooter,
    },
    sender: brandSender,
    suppression_precedence: commonSuppression,
    configuration_run: commonConfigurationRun,
    controlled_test: {
      ...commonControlledTest,
      required_proof: [
        ...commonControlledTest.required_proof,
        'Use one synthetic approved-content publication and prove the CTA resolves only to the first-party Parent Portal.',
      ],
    },
    save_reopen_readback: commonSaveReadback,
    rollback_disable: commonRollback,
    terminal_states: commonTerminalStates,
    safe_evidence_fields: [...commonEvidenceFields, 'sanitized_content_item_reference'],
    forbidden_evidence_fields: commonForbiddenEvidence,
  },
];

export const otE01RepairSubjob = {
  subjob_id: 'GHL-UI-04/OT-E01-EMAIL-A-REPAIR',
  parent_job_id: 'GHL-UI-04',
  workflow: {
    canonical_key: 'OT-E01',
    canonical_name: "OT-E01 Tisha B'Av 2026 Registration and Reminders",
    ghl_id: 'a34ea513-4612-4f53-8bd8-49e89e6610f9',
    full_folder_ancestry: "One Time / 45 - Events / 2026 / Tisha B'Av 2026",
    desired_state: 'ACTIVE_TESTED',
    observed_state: 'DRIFTED',
    workflow_published: true,
    action_name: 'Email A - Immediate Confirmation',
    action_observed_state: 'Disabled',
  },
  accepted_action_identity: {
    message_class: 'event_registration_confirmation',
    subject: "You're registered \u2014 let's strengthen ourselves together",
    preheader: "Join Rabbi Eli Scheller live from the Holy Land this Tisha B'Av.",
    body: "Hi {{default contact.first_name \"there\"}},\n\nThank you for signing up for Rabbi Eli Scheller's live Tisha B'Av class.\n\nTogether, we'll strengthen ourselves and help fill the world with knowledge of Hashem through digital Torah learning.\n\nJoin us for a special class, live from the Holy Land.\n\nThursday, July 23, 2026\n3:00 PM Eastern\n10:00 PM Israel\n\nWe'll email the private class access before the program begins.\n\nCan't wait to see you,\n\nRabbi Eli Scheller\nOne Time Mishnah Learning",
    cta_label: 'View the One Time Mishnah Class Page',
    cta_custom_value_key: 'one_time_tisha_bav_landing_url',
    cta_rule:
      'The resolved value must equal the already-registered canonical One Time Tisha landing page and must not be a meeting-provider URL.',
    sender_key: 'rabbi_campaign',
    sender_name_picker: {
      canonical_name: 'One Time Rabbi Campaign Sender Name',
      ghl_id: 'YTbMWivrsI10LnH26Xfv',
      key: 'one_time_rabbi_campaign_sender_name',
    },
    from_picker: {
      canonical_name: 'One Time Rabbi Campaign Phase 1 From',
      ghl_id: '1ciJqvUIDDCxs1cBumdL',
      key: 'one_time_rabbi_campaign_phase_1_from',
    },
    reply_to_picker: brandSender.reply_to,
  },
  permission_and_suppression: [
    'Require the scoped Tisha B Av registered-event permission for this registration.',
    'Do not require, create, or infer newsletter or general-marketing consent.',
    'Require a valid email and email DND false.',
    'Suppression, explicit opt-out, unsubscribe, complaint, and hard bounce always win.',
    'Reject duplicate registration enrollment in the same event idempotency scope.',
  ],
  configuration_authority: {
    contacts_created: 0,
    contacts_enrolled: 0,
    messages_sent: 0,
    reenable_only_when_all_identity_controls_render: true,
    fail_closed_rule:
      'If subject, preheader, sender, reply-to, body, CTA, or canonical link controls do not render, do not re-enable, save, or republish the action; return DRIFTED with ACTION_IDENTITY_UNVERIFIED.',
  },
  save_reopen_readback: [
    'Open only the existing workflow ID and existing Email A action.',
    'Verify every accepted identity control renders before changing the Disabled state.',
    'Re-enable and save Email A only when every value exactly matches this subjob.',
    'Save the existing outer workflow without changing reminder timing or other actions.',
    'Navigate away, reload, reopen the same workflow ID, and read back Email A enabled plus every identity field.',
    'Record SAVED_REOPENED but keep observed state DRIFTED until the separate bounded test passes.',
  ],
  controlled_test: {
    separate_explicit_authorization_required: true,
    operator_owned_synthetic_registrations_max: 1,
    messages_max: 1,
    broad_sends: 0,
    required_proof: [
      'The synthetic registration has exact event-only permission and no newsletter consent requirement.',
      'One enrollment and one immediate confirmation reach only the operator-owned destination.',
      'The CTA resolves to the canonical One Time landing page.',
      'Replay creates no second enrollment or confirmation.',
      'Suppression, DND, unsubscribe, complaint, and hard-bounce variants send nothing.',
    ],
  },
  rollback_disable: [
    'Disable only Email A and save the existing workflow when readback or bounded test fails.',
    'Do not alter Email C, Email D, reminder timing, history, or unrelated enrollments.',
    'Reopen the exact ID and record DRIFTED plus the precise mismatch.',
  ],
  safe_evidence_fields: [
    'subjob_id',
    'workflow_id',
    'action_name',
    'controls_rendered',
    'action_save_readback',
    'outer_save_readback',
    'sanitized_test_reference',
    'messages_sent_count',
    'replay_result',
    'observed_state',
    'remaining_dependency',
  ],
  safe_evidence_schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: [
      'subjob_id',
      'workflow_id',
      'action_name',
      'controls_rendered',
      'action_save_readback',
      'outer_save_readback',
      'messages_sent',
      'broad_sends',
      'observed_state',
      'remaining_dependency',
    ],
    properties: {
      subjob_id: { const: 'GHL-UI-04/OT-E01-EMAIL-A-REPAIR' },
      workflow_id: { const: 'a34ea513-4612-4f53-8bd8-49e89e6610f9' },
      action_name: { const: 'Email A - Immediate Confirmation' },
      controls_rendered: { type: 'boolean' },
      action_save_readback: { type: 'boolean' },
      outer_save_readback: { type: 'boolean' },
      messages_sent: { type: 'integer', minimum: 0, maximum: 1 },
      broad_sends: { const: 0 },
      observed_state: { enum: ['DRIFTED', 'ACTIVE_TESTED'] },
      remaining_dependency: { type: 'string' },
    },
  },
  forbidden_evidence_fields: commonForbiddenEvidence,
} as const;

export function buildExecutableWorkflowReport() {
  const rows = executableWorkflowSpecs.map(
    (spec) =>
      `| ${spec.job_id} | ${spec.workflow.canonical_key} | ${spec.workflow.ghl_id} | ${spec.workflow.full_folder_ancestry} | ${spec.application_contract.event_name}@${spec.application_contract.version} | ${spec.message.message_class} |`,
  );
  return [
    '# HighLevel Executable Workflow Report',
    '',
    'This report is generated deterministically from `scripts/highlevel/agent-mode-executable-specs.ts`.',
    'It authorizes no live HighLevel, Railway, contact, enrollment, provider, or message mutation.',
    '',
    '| Queue job | Workflow | Exact GHL ID | Full folder ancestry | Application contract | Message class |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Reused Repair Subjob',
    '',
    `- ${otE01RepairSubjob.subjob_id} remains inside GHL-UI-04 and targets existing workflow ${otE01RepairSubjob.workflow.ghl_id}.`,
    '- Observed OT-E01 state remains DRIFTED until exact browser readback and a separately authorized bounded test prove ACTIVE_TESTED.',
    '- Configuration permits zero contacts, enrollments, or sends and fails closed when the disabled action identity controls do not render.',
    '',
    '## Preserved PR #115 State',
    '',
    '- OT-C01 canonical email campaign remains Draft/not sent with zero selected recipients and zero sends.',
    '- The same-name OT-C01 workflow wrapper remains protectively paused in Draft and explicitly DRIFTED.',
    '- No Student contacts or credentials enter HighLevel.',
    '',
  ].join('\n');
}
