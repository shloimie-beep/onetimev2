export type LegalSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  summary: string;
  sections: readonly LegalSection[];
};

export type PrivacyDataCategory = {
  label: string;
  examples: readonly string[];
  purpose: string;
  handling: string;
};

export const legalPolicyMetadata = {
  policySetVersion: 'one-time-public-legal-v1-2026-07-17',
  effectiveDate: '2026-07-17',
  lastUpdated: '2026-07-17',
  contact: {
    organization: 'One Time Mishnayos',
    role: 'Admin',
    publicPath: '/signup',
    instruction:
      'Use the public signup path or the contact method supplied by the One Time team for privacy, consent, account, billing, or support questions.',
  },
  consentPolicyVersion: 'one-time-class-reminders-v1-2026-07-14',
  billingCapability:
    'Billing code is limited to fixture and Stripe test-mode evidence; the public signup flow does not collect payment card details.',
} as const;

export const privacyDataCategories = [
  {
    label: 'Signup records',
    examples: [
      'Parent or contact name',
      'family or school name',
      'audience type',
      'location',
      'time zone',
      'email',
      'optional phone number',
      'signup source and idempotency data',
    ],
    purpose:
      'Respond to interest, review family or school fit, prevent duplicate submissions, and route follow-up.',
    handling:
      'The public form is for parent, guardian, or school contact details. It should not include student names, ages, medical details, private learning notes, or other student-sensitive information.',
  },
  {
    label: 'Account records',
    examples: [
      'Owner/admin, parent, and student account identifiers',
      'email',
      'display name',
      'role',
      'activation and reset status',
      'MFA and trusted-device state',
    ],
    purpose: 'Create and protect authenticated access when an account is separately enabled.',
    handling:
      'Public signup alone does not create class access or a parent/student portal account; account setup is handled separately.',
  },
  {
    label: 'Household and guardian records',
    examples: [
      'Household identifiers',
      'guardian relationships',
      'guardian consent state',
      'administrative updates',
    ],
    purpose: 'Connect parents or guardians with eligible learners and portal access.',
    handling: 'Household records are scoped to One Time and are not a public directory.',
  },
  {
    label: 'Learner records',
    examples: [
      'Learner identifiers',
      'student access state',
      'guardian-linked access operations',
      'learner content entitlements',
    ],
    purpose: 'Enable student-safe portal and classroom experiences when accounts are issued.',
    handling:
      'Learner records are used inside protected student and parent surfaces and should not be submitted through the public signup form.',
  },
  {
    label: 'Class and classroom records',
    examples: [
      'Class series and occurrences',
      'class access requests',
      'fulfillment intents',
      'classroom launch grants',
      'attendance attempts and events',
      'student questions and moderation actions',
      'reminder preferences and intents',
    ],
    purpose: 'Operate class access, reminders, attendance, questions, and classroom support.',
    handling:
      'Provider-backed classroom actions remain bounded by configuration and approval; private class links are not published in public policy pages.',
  },
  {
    label: 'Progress and learning records',
    examples: [
      'Attendance marks',
      'reward events',
      'content access and outcome records',
      'portal read state',
    ],
    purpose: 'Show progress and support review, rewards, and learning continuity.',
    handling:
      'Progress records are scoped to the relevant household, learner, and authorized One Time staff surfaces.',
  },
  {
    label: 'Communications records',
    examples: [
      'Email and WhatsApp delivery intents',
      'communication threads',
      'redacted communication history events',
      'reply drafts',
      'suppression status',
      'consent events',
    ],
    purpose:
      'Send service messages, optional reminders, support replies, and audit-safe communication history.',
    handling:
      'Unknown consent is not treated as opt-in, and suppression or unsubscribe signals take priority over outreach.',
  },
  {
    label: 'Support records',
    examples: [
      'Support submissions',
      'attachments',
      'delivery attempts',
      'status projections',
      'support audit events',
    ],
    purpose: 'Provide subscriber support and track support status.',
    handling:
      'Support content may contain sensitive details and belongs in protected support flows, not in the public signup form.',
  },
  {
    label: 'Provider event records',
    examples: [
      'Zoom, Vimeo, WhatsApp, Telegram, email, and Buffer readiness or event records',
      'provider reference digests',
      'webhook receipts',
      'provider-off attempt records',
    ],
    purpose:
      'Operate and audit integrations only when the relevant provider path is configured and approved.',
    handling:
      'Provider references are stored as redacted summaries, hashes, digests, ciphertext, or status records where the current system requires that pattern.',
  },
  {
    label: 'Payment and test-payment records',
    examples: [
      'Billing provider account references',
      'test-mode checkout sessions',
      'subscription projections',
      'invoice summaries',
      'verified billing events',
      'entitlement projections',
      'billing audit records',
    ],
    purpose:
      'Support billing readiness, test-mode checkout, reconciliation, and entitlement review.',
    handling:
      'Current capability evidence is fixture and Stripe test-mode only. This notice does not claim live paid checkout is available.',
  },
  {
    label: 'Security records',
    examples: [
      'Session token hashes',
      'CSRF token hashes',
      'IP and user-agent hashes',
      'rate-limit buckets',
      'MFA challenges',
      'auth audit events',
      'lifecycle delivery records',
    ],
    purpose: 'Protect accounts, prevent abuse, and verify account lifecycle actions.',
    handling:
      'Security records are used to protect the service and are not exposed on public pages.',
  },
  {
    label: 'Operational records',
    examples: [
      'Audit events',
      'worker heartbeats',
      'synthetic probe runs',
      'restore drills',
      'retention job status',
      'import inventories and change ledgers',
    ],
    purpose:
      'Run the service, verify readiness, diagnose failures, and maintain audit-safe operations.',
    handling:
      'Operational evidence should use counts, statuses, hashes, and redacted summaries instead of raw private rows.',
  },
] as const satisfies readonly PrivacyDataCategory[];

export const communicationConsentNotice: LegalDocument = {
  id: 'communication-and-reminder-consent',
  title: 'Communication and Reminder Consent',
  version: legalPolicyMetadata.consentPolicyVersion,
  effectiveDate: legalPolicyMetadata.effectiveDate,
  summary:
    'This notice explains required service communications and optional class reminders for the public signup flow.',
  sections: [
    {
      heading: 'Required Service Communications',
      paragraphs: [
        'When you submit the public signup form, you ask One Time Mishnayos to respond to that request. The system may send service communications needed to confirm receipt, review the signup, manage account or security flows, deliver class access when separately approved, provide support, or prevent abuse.',
        'Required service communications are different from optional daily class reminders. They may still be necessary even if you do not choose optional reminders.',
      ],
    },
    {
      heading: 'Optional Email And WhatsApp Reminders',
      paragraphs: [
        'Optional daily class reminders are channel-specific. Email reminder permission and WhatsApp reminder permission are separate choices.',
        'No optional reminder consent is inferred from a preselected channel. The public form must show an affirmative choice for each optional reminder channel.',
      ],
      bullets: [
        'Email reminders require an email address and an affirmative email reminder choice.',
        'WhatsApp reminders require a WhatsApp-capable phone number and an affirmative WhatsApp reminder choice.',
        'Choosing no optional reminders does not block required service communications about the signup or account.',
      ],
    },
    {
      heading: 'Stopping Optional Messages',
      paragraphs: [
        'For WhatsApp, reply STOP or use any equivalent suppression instruction supported by the channel. For email, use the unsubscribe or suppression instructions in the message when available, or contact the One Time team.',
        'Suppression, STOP, unsubscribe, or do-not-contact signals should take priority over campaign or reminder eligibility.',
      ],
    },
    {
      heading: 'Consent Record',
      paragraphs: [
        `The current reminder consent policy version is ${legalPolicyMetadata.consentPolicyVersion}. The system can record the policy version and the time optional reminder consent was captured.`,
      ],
    },
  ],
};

export const parentGuardianStudentDataNotice: LegalDocument = {
  id: 'parent-guardian-student-data-notice',
  title: 'Parent/Guardian and Student Data Notice',
  version: 'parent-student-data-notice-v1-2026-07-17',
  effectiveDate: legalPolicyMetadata.effectiveDate,
  summary:
    'This notice explains how parent, guardian, household, and learner data should be handled at a high level.',
  sections: [
    {
      heading: 'Public Signup Is Adult-Facing',
      paragraphs: [
        'The public signup form is intended for a parent, guardian, or school contact. It does not ask for student names, ages, private learning details, medical information, or other student-sensitive data.',
        'If a family later receives portal or classroom access, learner information belongs in the protected parent or student flows rather than in the public signup form.',
      ],
    },
    {
      heading: 'Parent And Student Accounts',
      paragraphs: [
        'The system may support separate owner/admin, parent, and student accounts. These identities are separate and should not be described as a single shared account.',
        'Student-facing surfaces should show student-safe information and should not expose adult private notes or unrelated household records.',
      ],
    },
    {
      heading: 'Household Scope',
      paragraphs: [
        'Parent and guardian access is scoped to the relevant household or learner relationship. Browser-supplied values cannot choose the underlying account or product scope.',
      ],
    },
  ],
};

export const privacyNotice: LegalDocument = {
  id: 'privacy-notice',
  title: 'Privacy Notice',
  version: 'privacy-notice-v1-2026-07-17',
  effectiveDate: legalPolicyMetadata.effectiveDate,
  summary:
    'This notice describes the categories of information visible in the current One Time Mishnayos system and how they are used at a high level.',
  sections: [
    {
      heading: 'Scope',
      paragraphs: [
        'This notice covers the One Time Mishnayos public signup page and related One Time account, portal, classroom, communication, support, billing-readiness, provider-event, security, and operational records.',
        'This notice is intentionally high level. It does not publish internal architecture, private provider links, database URLs, secrets, private destinations, or raw source rows.',
      ],
    },
    {
      heading: 'How We Use Information',
      bullets: [
        'To respond to public signup and school inquiry submissions.',
        'To review eligibility, configure access, and support parent, student, and admin account flows when separately enabled.',
        'To provide classes, classroom access, content, progress, support, and service communications.',
        'To send optional class reminders only when the relevant channel consent is captured.',
        'To protect accounts, prevent abuse, operate the service, maintain audit records, and verify readiness.',
      ],
    },
    {
      heading: 'Providers And Integrations',
      paragraphs: [
        'The system contains integration paths for providers such as email, WhatsApp, Zoom, Vimeo, Telegram, Buffer, and Stripe test-mode billing. A provider path appearing in the system does not mean the provider is live for every user or approved for production sends, uploads, payments, publications, or mutations.',
        'Provider actions require protected configuration and authorization. Public documents should not expose credentials, private links, destination addresses, tokens, or raw provider payloads.',
      ],
    },
    {
      heading: 'Suppression And Contact Choices',
      paragraphs: [
        'Optional reminder choices are channel-specific. STOP, unsubscribe, suppression, and do-not-contact signals should be respected before optional outreach.',
        legalPolicyMetadata.contact.instruction,
      ],
    },
    {
      heading: 'Retention And Deletion',
      paragraphs: [
        'The current public materials do not publish a fixed retention schedule. Retention, deletion, and jurisdiction-specific rights language require business and legal approval before stronger public claims are made.',
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  id: 'terms-of-use',
  title: 'Terms of Use',
  version: 'terms-of-use-v1-2026-07-17',
  effectiveDate: legalPolicyMetadata.effectiveDate,
  summary:
    'These terms describe the public signup flow and high-level use of One Time Mishnayos without claiming unapproved live capabilities.',
  sections: [
    {
      heading: 'Using One Time Mishnayos',
      paragraphs: [
        'One Time Mishnayos provides Mishnayos class information, account and portal surfaces, classroom and content features, communications, support, and operational tooling as they are enabled for the service.',
        'Public signup is an interest and intake flow. Submitting the form does not by itself create class access, a parent account, a student account, a Zoom link, a paid subscription, or a guarantee that every feature is available.',
      ],
    },
    {
      heading: 'Accounts And Access',
      paragraphs: [
        'The system may support owner/admin, parent, and student accounts. Access may be created, activated, disabled, suspended, or reset through separate account lifecycle flows.',
        'You are responsible for using accurate contact information, protecting account credentials, and using parent or student access only for the person or household authorized for that access.',
      ],
    },
    {
      heading: 'Parent, Guardian, And Student Use',
      paragraphs: [
        'Parents and guardians should not submit student-sensitive information through the public signup form. Student-facing features should be used in a student-safe way and only for the authorized learner.',
      ],
    },
    {
      heading: 'Communications',
      paragraphs: [
        'One Time Mishnayos may send required service communications connected to signup, account security, class access, support, and operations. Optional class reminders are governed by the Communication and Reminder Consent notice.',
      ],
    },
    {
      heading: 'Payment And Cancellation',
      paragraphs: [
        legalPolicyMetadata.billingCapability,
        'Because live paid checkout is not proven as a current public signup capability, these terms do not invent cancellation, refund, renewal, or subscription promises. If paid checkout or manual paid enrollment is enabled later, the applicable offer, payment, cancellation, and refund terms must be approved and presented with that billing flow.',
      ],
    },
    {
      heading: 'Content And Providers',
      paragraphs: [
        'Class, content, Zoom, Vimeo, WhatsApp, Telegram, Buffer, email, support, and billing integrations may depend on provider availability, protected configuration, and approval. Provider-off or test-mode evidence should not be treated as a promise of live provider delivery.',
      ],
    },
    {
      heading: 'Acceptable Use',
      bullets: [
        'Do not attempt to access another household, learner, provider, account, or admin surface.',
        'Do not upload, submit, or request publication of private links, credentials, raw private message bodies, or student-sensitive information through public forms.',
        'Do not interfere with service security, rate limits, audit logs, or provider integrations.',
      ],
    },
    {
      heading: 'Changes And Questions',
      paragraphs: [
        `Policy set version: ${legalPolicyMetadata.policySetVersion}.`,
        legalPolicyMetadata.contact.instruction,
      ],
    },
  ],
};
