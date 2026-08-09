export const LEGAL_POLICY_VERSION = 'one-time-public-legal-v2-2026-08-09';
export const COMMUNICATION_CONSENT_POLICY_VERSION = 'one-time-unified-terms-consent-v2-2026-08-09';
export const LEGAL_EFFECTIVE_DATE = '2026-08-09';
export const LEGAL_REVIEW_STATUS = 'counsel_review_required';
export const LEGAL_CONTACT_PUBLIC_LABEL = 'One Time Mishnayos support';

export type LegalSection = {
  readonly heading: string;
  readonly body: readonly string[];
};

export type LegalNotice = {
  readonly title: string;
  readonly heading: string;
  readonly version: string;
  readonly effectiveDate: string;
  readonly reviewStatus: typeof LEGAL_REVIEW_STATUS;
  readonly contactLabel: typeof LEGAL_CONTACT_PUBLIC_LABEL;
  readonly sections: readonly LegalSection[];
};

export const privacyNotice: LegalNotice = {
  title: 'Privacy Notice | One Time Mishnayos',
  heading: 'Privacy Notice',
  version: LEGAL_POLICY_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  reviewStatus: LEGAL_REVIEW_STATUS,
  contactLabel: LEGAL_CONTACT_PUBLIC_LABEL,
  sections: [
    {
      heading: 'Scope',
      body: [
        'This notice describes the One Time Mishnayos public site, signup flow, authenticated account areas, class operations, communications, support, and provider-event records that the current application can process.',
        'It is prepared for launch review and is not a final legal approval record.',
      ],
    },
    {
      heading: 'Information Categories',
      body: [
        'The system can process public signup details, account and security records, contact and CRM records, household, guardian, and learner records, class, enrollment, attendance, and progress records, content questions and approved-helper context, communications and support records, provider-event summaries, billing and test-billing records, audit records, rate-limit records, and operational logs.',
        'The public signup form is not intended to collect student-sensitive information.',
      ],
    },
    {
      heading: 'Use',
      body: [
        'Records are used to respond to signup requests, operate the class and portals, secure accounts, support families and schools, maintain auditability, prevent abuse, and prepare provider-off launch workflows.',
        'Live broad messaging, live payment collection, real audience import, and production provider activation require separate approval gates.',
      ],
    },
    {
      heading: 'Providers',
      body: [
        'Provider integrations may exist in code or test mode for email, WhatsApp, Telegram, Zoom, Vimeo, Buffer, billing, helper, and support workflows, but provider-off is the safe default unless an exact approval and protected configuration are present.',
        'This public notice does not publish secrets, private destinations, or internal security architecture.',
      ],
    },
    {
      heading: 'Retention And Rights',
      body: [
        'Retention, deletion, export, and guardian/minor policy decisions remain pending operator and counsel approval.',
        'Suppression, unsubscribe, STOP, and opt-out requests must prevent optional outbound reminders where applicable.',
      ],
    },
  ],
};

export const termsNotice: LegalNotice = {
  title: 'Terms of Use | One Time Mishnayos',
  heading: 'Terms of Use',
  version: LEGAL_POLICY_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  reviewStatus: LEGAL_REVIEW_STATUS,
  contactLabel: LEGAL_CONTACT_PUBLIC_LABEL,
  sections: [
    {
      heading: 'One Integrated Agreement',
      body: [
        'Family signup presents exactly one required Terms checkbox. The Terms incorporate privacy, Parent/Student data, communications, cancellation, and refund provisions in one document.',
        'The single acceptance projects the covered adult email scopes for required service messages, One Time program updates, general marketing, and the Parent newsletter.',
      ],
    },
    {
      heading: 'Suppression And Withdrawal',
      body: [
        'Unsubscribe, DND, complaint, hard-bounce, suppression, and equivalent do-not-contact states remain controlling for optional messages.',
        'WhatsApp and Student-specific recording or recognition consent are not silently granted by the Family signup acceptance.',
      ],
    },
    {
      heading: 'Accounts, Billing, And Acceptable Use',
      body: [
        'The adult account owner must use accurate information, protect credentials, and keep Parent and Student access within the authorized household.',
        'The public form collects no card and makes no automatic charge. Cancellation stops future renewal while preserving verified paid-period access; refunds remain manual exceptions.',
      ],
    },
  ],
};

export const communicationConsentNotice: LegalNotice = {
  title: 'Communications Included In The Terms | One Time Mishnayos',
  heading: 'Communications Included In The Terms',
  version: COMMUNICATION_CONSENT_POLICY_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  reviewStatus: LEGAL_REVIEW_STATUS,
  contactLabel: LEGAL_CONTACT_PUBLIC_LABEL,
  sections: [
    {
      heading: 'Unified Adult Email Acceptance',
      body: [
        'The Family signup Terms acceptance covers required account and service email plus One Time program updates, general marketing, and the Parent newsletter.',
        'There are no separate visible general-marketing or Parent-newsletter checkboxes on the Family signup form.',
      ],
    },
    {
      heading: 'Opt-Out And Suppression',
      body: [
        'Unsubscribe, DND, complaint, hard-bounce, suppression, and equivalent do-not-contact states must block optional outreach before any provider call.',
        'WhatsApp is not authorized by the Family signup Terms acceptance.',
      ],
    },
  ],
};

export const parentStudentDataNotice: LegalNotice = {
  title: 'Parent, Guardian, And Student Data | One Time Mishnayos',
  heading: 'Parent, Guardian, And Student Data',
  version: LEGAL_POLICY_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  reviewStatus: LEGAL_REVIEW_STATUS,
  contactLabel: LEGAL_CONTACT_PUBLIC_LABEL,
  sections: [
    {
      heading: 'Public Signup',
      body: [
        'The public signup surface asks for adult contact and family or school information only. It should not request learner names, private notes, medical details, or sensitive student records.',
      ],
    },
    {
      heading: 'Protected Portals',
      body: [
        'Authenticated parent and student surfaces must keep household, sibling, class, progress, and support records inside their assigned scope.',
        'Student surfaces must avoid exposing adult-private notes, cross-household records, or public ranking and shaming patterns.',
      ],
    },
    {
      heading: 'Open Decisions',
      body: [
        'Guardian approval, minor privacy, data-retention, deletion, and export rules remain pending operator and counsel decisions before production launch.',
      ],
    },
  ],
};

export const legalNotices = {
  privacy: privacyNotice,
  terms: termsNotice,
  communicationConsent: communicationConsentNotice,
  parentStudentData: parentStudentDataNotice,
} as const;
