export const LEGAL_POLICY_VERSION = 'w13-10-public-legal-v1-2026-07-17';
export const COMMUNICATION_CONSENT_POLICY_VERSION = 'w13-10-communication-consent-v1-2026-07-17';
export const LEGAL_EFFECTIVE_DATE = '2026-07-17';
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
      heading: 'Current Service State',
      body: [
        'The site can collect interest requests and the application includes owner/admin, parent, and student account capabilities.',
        'Submitting the public form does not by itself create paid access, charge a card, import a real audience list, or enable broad provider messaging.',
      ],
    },
    {
      heading: 'Accounts And Class Access',
      body: [
        'Class access, portal accounts, and learner permissions depend on separate operational approval and account setup.',
        'Parents, students, schools, owners, administrators, and support roles must use only the access scope assigned to them.',
      ],
    },
    {
      heading: 'Billing',
      body: [
        'Production paid checkout, a final family subscription price, cancellation terms, and learner-seat limits are not accepted in the current repository evidence.',
        'Billing language must be updated only after the product decision gate accepts exact values.',
      ],
    },
    {
      heading: 'Acceptable Use',
      body: [
        'Users must not attempt to bypass access controls, misuse class content, submit private student information into public forms, or interfere with application operations.',
      ],
    },
  ],
};

export const communicationConsentNotice: LegalNotice = {
  title: 'Communication And Reminder Consent | One Time Mishnayos',
  heading: 'Communication And Reminder Consent',
  version: COMMUNICATION_CONSENT_POLICY_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  reviewStatus: LEGAL_REVIEW_STATUS,
  contactLabel: LEGAL_CONTACT_PUBLIC_LABEL,
  sections: [
    {
      heading: 'Required Service Communication',
      body: [
        'One Time Mishnayos may use the email address submitted on the public form to respond to the request, send service follow-up, and protect the signup flow.',
        'This required service communication is separate from optional class reminders or marketing-style reminders.',
      ],
    },
    {
      heading: 'Optional Reminder Choices',
      body: [
        'Email reminders and WhatsApp reminders are separate optional choices. They must not be prechecked or inferred from a default channel.',
        'Optional reminder consent records must include policy version, purpose, source, channel, timestamp, and suppression or withdrawal state.',
      ],
    },
    {
      heading: 'Opt-Out',
      body: [
        'STOP, unsubscribe, opt-out, complaint, hard-bounce, and suppression states must block optional outbound reminders before any provider call.',
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
