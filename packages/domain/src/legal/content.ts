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
  policySetVersion: 'one-time-public-legal-v2-2026-08-09',
  effectiveDate: '2026-08-09',
  lastUpdated: '2026-08-09',
  contact: {
    organization: 'One Time Mishnayos',
    role: 'Admin',
    publicPath: '/signup',
    instruction:
      'Use the public signup path or the contact method supplied by the One Time team for privacy, consent, account, billing, or support questions.',
  },
  consentPolicyVersion: 'one-time-unified-terms-consent-v2-2026-08-09',
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
  title: 'Communications Included In The Terms',
  version: legalPolicyMetadata.consentPolicyVersion,
  effectiveDate: legalPolicyMetadata.effectiveDate,
  summary:
    'This section records the adult email communications covered by the single required Terms acceptance.',
  sections: [
    {
      heading: 'One Required Acceptance',
      paragraphs: [
        'The Family signup form presents one required checkbox for the Terms of Use. That Terms document incorporates the Privacy Notice, Parent/Guardian and Student Data Notice, Cancellation and Refund Policy, and this communications section.',
        'The acceptance is not split into separate visible general-marketing or Parent-newsletter checkboxes.',
      ],
    },
    {
      heading: 'Adult Email Communications',
      paragraphs: [
        'By accepting the Terms, the adult account owner agrees that One Time Mishnayos may use the submitted email address for required account, security, class, access, billing, and support messages, as well as One Time program updates, general marketing, and the Parent newsletter.',
        'WhatsApp is not an active launch channel and is not authorized by the Family signup Terms acceptance.',
      ],
    },
    {
      heading: 'Stopping Optional Messages',
      paragraphs: [
        'The adult may unsubscribe from optional marketing or newsletter messages at any time. DND, unsubscribe, complaint, hard-bounce, suppression, and equivalent do-not-contact signals remain controlling and must be checked before optional outreach.',
        'Stopping optional messages does not prevent account, security, billing, support, or other service communications that are necessary to operate the requested service.',
      ],
    },
    {
      heading: 'Acceptance Record',
      paragraphs: [
        `The current unified Terms and communications policy version is ${legalPolicyMetadata.consentPolicyVersion}. The system records the accepted policy version, source, and time, then projects the covered adult communication scopes without overriding a later suppression or withdrawal.`,
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
        'To send adult email communications authorized by the integrated Terms, while honoring unsubscribe and suppression controls.',
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
        'Adult email permission is projected from the integrated Terms acceptance. STOP, unsubscribe, complaint, hard-bounce, suppression, and do-not-contact signals remain controlling before optional outreach.',
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
  version: 'terms-of-use-v2-2026-08-09',
  effectiveDate: legalPolicyMetadata.effectiveDate,
  summary:
    'This is the single integrated agreement for Family signup, including privacy, Student-data, communication, cancellation, refund, and service terms.',
  sections: [
    {
      heading: 'One Integrated Agreement',
      paragraphs: [
        'The Family signup form uses one required Terms acceptance. These Terms incorporate the Privacy Notice, Parent/Guardian and Student Data Notice, Communications Included In The Terms, and Cancellation and Refund Policy displayed below on this page.',
        'Submitting the form confirms that the adult account owner has reviewed and accepts this integrated agreement.',
      ],
    },
    {
      heading: 'Using One Time Mishnayos',
      paragraphs: [
        'One Time Mishnayos provides Mishnayos classes, Parent and Student portals, live-class access, recordings, review tools, communications, billing and account services, and support as those capabilities are enabled.',
        'The adult account owner is responsible for accurate information, protecting credentials, and using each Parent or Student account only for the authorized person and household.',
      ],
    },
    {
      heading: 'Parent, Guardian, And Student Authority',
      paragraphs: [
        'For a dependent Student, the adult account owner confirms that they are authorized to create and manage the Student account and to provide the permissions required for the service.',
        'Student-specific recording, recognition, or other child-safety choices that require a later versioned action remain separate at the point where that feature is used; the public signup form does not silently manufacture those Student-specific records.',
      ],
    },
    {
      heading: 'Communications',
      paragraphs: [
        'By accepting these Terms, the adult account owner agrees to receive required account, security, class, access, billing, and support email, as well as One Time program updates, general marketing, and the Parent newsletter at the submitted address.',
        'Optional marketing and newsletter messages remain subject to unsubscribe, DND, complaint, hard-bounce, suppression, and other do-not-contact controls. WhatsApp is not authorized by this acceptance.',
      ],
    },
    {
      heading: 'Privacy And Data',
      paragraphs: [
        'The incorporated Privacy Notice and Parent/Guardian and Student Data Notice explain the information the service processes and the boundaries between adult and Student data.',
        'The public signup form is adult-facing and should not be used to submit Student-sensitive information.',
      ],
    },
    {
      heading: 'Payment, Cancellation, And Refunds',
      paragraphs: [
        'The public Family signup form does not collect payment-card details or make an automatic charge. Billing code remains limited to fixture and Stripe test-mode evidence until the approved hosted provider flow is launched.',
        'Cancellation stops future renewal and preserves access through the verified paid period. Refunds are manual exceptions, and cancellation does not itself delete learning records.',
      ],
    },
    {
      heading: 'Content, Classes, And Providers',
      paragraphs: [
        'Class, content, Zoom, Vimeo, email, support, and billing capabilities depend on protected configuration, provider availability, access state, and the applicable safety controls.',
        'Private class, recording, account, and provider links may not be shared or used outside the authorized account.',
      ],
    },
    {
      heading: 'Acceptable Use',
      bullets: [
        'Do not attempt to access another household, Student, provider, account, or Admin surface.',
        'Do not upload or submit credentials, payment-card details, private provider links, or Student-sensitive information through public forms.',
        'Do not interfere with service security, rate limits, audit records, or provider integrations.',
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

export const cancellationRefundPolicy: LegalDocument = {
  id: 'cancellation-refund-policy',
  title: 'Cancellation and Refund Policy',
  version: 'cancellation-refund-v2.1-2026-08-05',
  effectiveDate: '2026-08-05',
  summary:
    'The current One Time Mishnayos policy for ending renewal, paid-period access, refund exceptions, and learning records.',
  sections: [
    {
      heading: 'Canceling Future Renewal',
      paragraphs: [
        'When a paid subscription is active, cancellation stops the next renewal. Access continues through the verified end of the current paid period.',
        'A cancellation request does not create a new charge and does not shorten an already paid access period.',
      ],
    },
    {
      heading: 'Refund Requests',
      paragraphs: [
        'Cancellation does not automatically create a prorated refund. Refunds are manual exceptions that require review and approval by an authorized One Time administrator.',
        'Any approved refund is confirmed from the payment provider before account access is updated. A request or browser confirmation alone is not proof that a refund occurred.',
      ],
    },
    {
      heading: 'Accounts And Learning Records',
      paragraphs: [
        'Cancellation or a refund does not by itself delete a Parent account, Student profile, attendance, progress, questions, or content history.',
        'Account closure and data-rights requests are separate processes governed by the Privacy Notice and the protected Parent data-rights workspace.',
      ],
    },
    {
      heading: 'Billing Safety',
      paragraphs: [
        'The public signup form does not collect payment card details. When paid billing is enabled for an account, card and financial actions use the approved provider-hosted billing flow.',
        'One Time grants or removes learning access only after verified signed billing events and account-scoped reconciliation.',
      ],
    },
    {
      heading: 'Questions And Requests',
      paragraphs: [
        'Signed-in Parents should use the protected billing or support workspace for account-specific cancellation and refund questions. Do not send payment card details through public forms or ordinary email.',
      ],
    },
  ],
};
