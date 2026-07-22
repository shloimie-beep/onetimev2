export const workflowControlStates = [
  'MISSING',
  'DRAFT_SHELL',
  'SAVED_REOPENED',
  'ACTIVE_CONFIGURED',
  'ACTIVE_TESTED',
  'DRIFTED',
  'BLOCKED',
] as const;

export type WorkflowControlState = (typeof workflowControlStates)[number];

export const workflowFolderTree = [
  { order: 0, name: '00 - Intake & Data', children: [] },
  { order: 10, name: '10 - Enrollment & Nurture', children: [] },
  { order: 20, name: '20 - Billing & Access', children: [] },
  { order: 30, name: '30 - Portal Lifecycle', children: [] },
  { order: 40, name: '40 - Learning Operations', children: ['Classes', 'Content'] },
  { order: 45, name: '45 - Events', children: ["2026 / Tisha B'Av 2026"] },
  { order: 50, name: '50 - Support', children: [] },
  { order: 60, name: '60 - Bot Actions', children: [] },
  { order: 90, name: '90 - Internal Operations', children: [] },
  { order: 99, name: '99 - Deprecated', children: [] },
] as const;

export type WorkflowControlBinding = {
  folder: string;
  displayOrder: number;
  ghlId: string;
  desiredStatus: WorkflowControlState;
  observedStatus: WorkflowControlState;
  exactOrderedTriggers: string[];
  exactOrderedActions: string[];
  observedTriggers: string[];
  observedActions: string[];
  lastReadback: {
    at: string;
    method: string;
    reference: string;
  };
  canary: {
    result: 'passed' | 'not_run' | 'not_applicable';
    reference: string;
    detail: string;
  };
  blocker: string;
  evidence: string[];
};

const finalOrganizationEvidence =
  'integrations/highlevel/agent-mode/results/GHL-FINAL-ORGANIZATION-20260722.result.json';
const phaseTwoEvidence =
  'integrations/highlevel/agent-mode/results/GHL-PHASE-2-20260722.result.json';
const finalReadback = {
  at: '2026-07-22T09:09:54.117Z',
  method: 'navigate-away/reopen plus sanitized UI/API readback',
  reference: finalOrganizationEvidence,
};

function savedDraft(input: {
  folder: string;
  displayOrder: number;
  ghlId: string;
  triggers: string[];
  actions: string[];
  blocker: string;
}): WorkflowControlBinding {
  return {
    folder: input.folder,
    displayOrder: input.displayOrder,
    ghlId: input.ghlId,
    desiredStatus: 'SAVED_REOPENED',
    observedStatus: 'SAVED_REOPENED',
    exactOrderedTriggers: input.triggers,
    exactOrderedActions: input.actions,
    observedTriggers: [],
    observedActions: [],
    lastReadback: finalReadback,
    canary: {
      result: 'not_run',
      reference: finalOrganizationEvidence,
      detail: 'Draft preserved; no contact enrolled and no send authorized.',
    },
    blocker: input.blocker,
    evidence: [finalOrganizationEvidence],
  };
}

function draftShell(input: {
  folder: string;
  displayOrder: number;
  ghlId: string;
  triggers: string[];
  actions: string[];
  blocker: string;
}): WorkflowControlBinding {
  return {
    folder: input.folder,
    displayOrder: input.displayOrder,
    ghlId: input.ghlId,
    desiredStatus: 'DRAFT_SHELL',
    observedStatus: 'DRAFT_SHELL',
    exactOrderedTriggers: input.triggers,
    exactOrderedActions: input.actions,
    observedTriggers: [],
    observedActions: [],
    lastReadback: {
      at: '2026-07-22T09:37:00.000Z',
      method: 'navigate-away/reopen plus sanitized UI/API readback',
      reference: phaseTwoEvidence,
    },
    canary: {
      result: 'not_run',
      reference: phaseTwoEvidence,
      detail:
        'No executable trigger or critical action exists; controlled execution is not possible.',
    },
    blocker: input.blocker,
    evidence: [finalOrganizationEvidence, phaseTwoEvidence],
  };
}

export const workflowControlByKey: Record<string, WorkflowControlBinding> = {
  'OT-01': draftShell({
    folder: '00 - Intake & Data',
    displayOrder: 1,
    ghlId: '95a6f461-1a04-4260-b379-246fdcc45af7',
    triggers: [
      'Receive the canonical adult public-signup event from One Time or OT-B01.',
      'Require a known source and recorded adult channel-consent state.',
    ],
    actions: [
      'Create or update only the adult contact using the canonical idempotency key.',
      'Apply OT | Lead.',
      'Apply only the canonical known-source tag.',
      'Preserve every unrelated existing tag.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: deployed adult signup event dispatcher is absent.',
  }),
  'OT-02A': savedDraft({
    folder: '10 - Enrollment & Nurture',
    displayOrder: 2,
    ghlId: '368d47ca-c6d2-4545-acb0-664f98bac8f2',
    triggers: [
      'Enter only an explicitly approved 2026 existing-subscriber migration audience.',
      'Require service/marketing eligibility and no suppression before each message.',
    ],
    actions: [
      'Mark the registered migration sequence/version active.',
      'Send migration email one with the registered rabbi_campaign sender.',
      'Wait the approved cadence, then recheck activation and suppression.',
      'Send migration email two only while still eligible.',
      'Wait the approved cadence, recheck, and send migration email three only while still eligible.',
      'Exit immediately on activation, opt-out, or suppression.',
    ],
    blocker: 'Approved migration audience, cadence, and controlled-test authorization are absent.',
  }),
  'OT-02B': savedDraft({
    folder: '10 - Enrollment & Nurture',
    displayOrder: 3,
    ghlId: 'a7038e32-79d2-4d2d-b103-5722ab0abcfc',
    triggers: [
      'Enter only the canonical new-lead nurture audience.',
      'Require explicit consent and no suppression before each message.',
    ],
    actions: [
      'Send the approved first nurture message with the registered rabbi_campaign sender.',
      'Wait the approved cadence and recheck checkout, customer, consent, and suppression state.',
      'Send each next approved nurture step only while eligible.',
      'Exit on checkout start, Active status, opt-out, or suppression.',
    ],
    blocker:
      'Approved nurture audience, cadence, content, and controlled-test authorization are absent.',
  }),
  'OT-03': savedDraft({
    folder: '20 - Billing & Access',
    displayOrder: 4,
    ghlId: 'b5c3e702-a7e6-415d-9ffc-fa2b0027a27f',
    triggers: [
      'Receive the canonical checkout-started event.',
      'Wait the registered abandonment window.',
      'Continue only when checkout has not completed and the adult remains eligible.',
    ],
    actions: [
      'Record canonical checkout-started state.',
      'Exit when completion or Active status is observed.',
      'Read price only from published canonical custom values.',
      'Send the single approved abandonment message only with valid consent and no suppression.',
    ],
    blocker:
      'Checkout event, abandonment window, and payment-provider acceptance are not configured.',
  }),
  'OT-04': savedDraft({
    folder: '20 - Billing & Access',
    displayOrder: 5,
    ghlId: 'dd1e90ea-f9bd-4c3b-97de-2230f119f38b',
    triggers: ['Receive the canonical One Time payment/access projection becoming Active.'],
    actions: [
      'Record canonical customer and access status as Active.',
      'Clear obsolete grace state and apply only the registered active tag.',
      'Invoke the protected One Time billing/access adapter idempotently.',
      'Send the approved confirmation only when separately authorized.',
    ],
    blocker: 'Payment-active projection and protected adapter acceptance are not configured.',
  }),
  'OT-05': savedDraft({
    folder: '20 - Billing & Access',
    displayOrder: 6,
    ghlId: '8c7a0a37-6747-492f-99f6-1a1fb90518de',
    triggers: ['Receive the canonical payment-failure projection that places access in Grace.'],
    actions: [
      'Record customer/access Grace state and the canonical grace-until value.',
      'Apply only the registered grace/payment-failed tags.',
      'Send pressure-free support copy only when separately authorized.',
      'Never charge, retry, or mutate Stripe from GHL.',
    ],
    blocker:
      'Payment-failure projection, approved grace timing, and provider acceptance are absent.',
  }),
  'OT-06': savedDraft({
    folder: '20 - Billing & Access',
    displayOrder: 7,
    ghlId: '7421cd97-a61b-4434-b7f3-163b8cc7237c',
    triggers: [
      'Receive the canonical Canceled subscription projection when support context is required.',
    ],
    actions: [
      'Record canceled customer state and current-period end when present.',
      'Apply only the registered cancellation tags.',
      'Invoke the protected One Time adapter idempotently.',
      'Send cancellation help only when separately authorized.',
      'Never revoke One Time access from a GHL tag alone.',
    ],
    blocker: 'Cancellation projection and protected adapter acceptance are not configured.',
  }),
  'OT-13': savedDraft({
    folder: '20 - Billing & Access',
    displayOrder: 8,
    ghlId: '9459a4a1-c5fa-4912-920e-e30c86f1fbe9',
    triggers: ['Receive a verified refund or chargeback support projection.'],
    actions: [
      'Record the canonical refund or chargeback state.',
      'Apply only registered support/status tags.',
      'Invoke the protected One Time adapter idempotently when configured.',
      'Never mutate Stripe or send a customer message from this workflow without separate approval.',
    ],
    blocker: 'Refund/chargeback projection and protected adapter acceptance are not configured.',
  }),
  'OT-07': draftShell({
    folder: '30 - Portal Lifecycle',
    displayOrder: 9,
    ghlId: 'fb48c3bf-7154-44c9-825e-88afb5bb7942',
    triggers: ['Receive One Time access confirmation for an eligible adult parent contact.'],
    actions: [
      'Send or record only the non-token parent portal companion.',
      'Never store or send credentials, activation tokens, reset tokens, or Student data.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: access-confirmation companion event is absent.',
  }),
  'OT-08': draftShell({
    folder: '30 - Portal Lifecycle',
    displayOrder: 10,
    ghlId: 'eeca2efb-41be-40a7-bbc4-ee6fe8760dd9',
    triggers: [
      'Receive the One Time parent-portal projection becoming Active for the eligible adult.',
    ],
    actions: [
      'Record the adult parent-portal activation.',
      'Exclude Student identities, credentials, learning progress, and entitlement data.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: parent-activation projection is absent.',
  }),
  'OT-09': draftShell({
    folder: '40 - Learning Operations / Classes',
    displayOrder: 11,
    ghlId: 'bc8af9fc-22d5-4b4f-b71a-121eeff87f5b',
    triggers: [
      'Receive a confirmed-class reminder event for an entitled adult household after consent passes.',
    ],
    actions: [
      'Send only current confirmed class information supplied by One Time.',
      'Use only the canonical protected One Time class URL.',
      'Never store or send a permanent raw Zoom URL.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: confirmed-class reminder event projection is absent.',
  }),
  'OT-10': draftShell({
    folder: '40 - Learning Operations / Content',
    displayOrder: 12,
    ghlId: '1bca5210-a3b9-496b-b3cd-48c60c0e33ca',
    triggers: ['Receive recording.available after Admin approval for an entitled household.'],
    actions: [
      'Send the approved recording-available notice only to the eligible adult.',
      'Use only the protected One Time recording URL.',
      'Never expose a raw Vimeo provider URL.',
    ],
    blocker:
      'DRAFT_BLOCKED_APP_CONTRACT: recording.available producer and GHL dispatcher are absent.',
  }),
  'OT-E01': {
    folder: "45 - Events / 2026 / Tisha B'Av 2026",
    displayOrder: 13,
    ghlId: 'a34ea513-4612-4f53-8bd8-49e89e6610f9',
    desiredStatus: 'ACTIVE_TESTED',
    observedStatus: 'ACTIVE_TESTED',
    exactOrderedTriggers: [
      "Receive the canonical Tisha B'Av 2026 registration event and event/source tags.",
      'Reject a duplicate active registration run for the same idempotency scope.',
      'Enter each approved reminder milestone only when it is still in the future.',
    ],
    exactOrderedActions: [
      'Apply the canonical event and source tags without adding newsletter consent.',
      'Send one immediate confirmation using only the protected One Time event URL.',
      'Schedule the approved one-hour and ten-minute reminders.',
      'Skip reminder actions already in the past for late registrants.',
      'Preserve one active run on replay and never expose a raw Zoom URL.',
    ],
    observedTriggers: [
      "Canonical Tisha B'Av registration and source tags were read back.",
      'Duplicate replay did not create a second active run.',
    ],
    observedActions: [
      'Immediate confirmation delivered once.',
      'One-hour and ten-minute reminders scheduled.',
      'Late past actions skipped; protected URLs retained; raw Zoom URL absent.',
    ],
    lastReadback: finalReadback,
    canary: {
      result: 'passed',
      reference: 'GHL-E01-operator-fab156df2719852d',
      detail: 'Bounded operator-owned controlled execution and replay/idempotency proof passed.',
    },
    blocker: '',
    evidence: [finalOrganizationEvidence, phaseTwoEvidence],
  },
  'OT-C01': savedDraft({
    folder: "45 - Events / 2026 / Tisha B'Av 2026",
    displayOrder: 14,
    ghlId: 'f28d8b8a-c26a-4a4f-a9f2-d2a8e94af1ae',
    triggers: [
      "Require an explicitly approved Tisha B'Av 2026 warm audience.",
      'Require explicit campaign authorization, channel consent, and no suppression.',
    ],
    actions: [
      'Select only the approved audience.',
      'Send the approved Rabbi-authored phase-one invitation with rabbi_campaign.',
      'Record the bounded execution result and stop on opt-out or suppression.',
    ],
    blocker:
      'Campaign audience and send authorization are absent; observed sends and enrollments are zero.',
  }),
  'OT-B01': draftShell({
    folder: '60 - Bot Actions',
    displayOrder: 15,
    ghlId: '1c1c0bcd-6185-492e-819f-3b7c749d4c23',
    triggers: [
      'Receive the typed OT-A1 complete-signup invocation with required adult data and consent.',
    ],
    actions: [
      'Validate all required adult fields.',
      'Invoke the protected HighLevel-to-One-Time adapter with an idempotency key.',
      'Never create a Student contact.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: typed complete-signup adapter is absent.',
  }),
  'OT-B02': draftShell({
    folder: '60 - Bot Actions',
    displayOrder: 16,
    ghlId: 'cc766d32-0a47-47b5-818c-de45fefa83a7',
    triggers: ['Receive the typed OT-A1 next-confirmed-class-info invocation.'],
    actions: [
      'Query safe current class state from One Time.',
      'Return or send only protected confirmed class information.',
      'Never expose a raw provider URL.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: typed next-class adapter is absent.',
  }),
  'OT-B03': draftShell({
    folder: '60 - Bot Actions',
    displayOrder: 17,
    ghlId: '8ff00774-82fd-42d7-992b-4e9aca0a5091',
    triggers: ['Receive the typed OT-A1 member-login invocation for an adult contact.'],
    actions: [
      'Return or send only https://join.onetimeonetime.com/login.',
      'Do not claim that the account is active.',
      'Never send credentials or tokens.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: typed member-login companion adapter is absent.',
  }),
  'OT-B04': draftShell({
    folder: '60 - Bot Actions',
    displayOrder: 18,
    ghlId: '9f96c105-a298-4b5d-a5e5-8c573624d242',
    triggers: ['Receive the typed OT-A1 password-help invocation without account enumeration.'],
    actions: [
      'Request the One Time password-help boundary.',
      'Return only the canonical non-token forgot-password URL when eligible.',
      'Leave reset-token creation and delivery to One Time and Resend.',
    ],
    blocker: 'DRAFT_BLOCKED_APP_CONTRACT: typed password-help companion adapter is absent.',
  }),
  'OT-B05': draftShell({
    folder: '60 - Bot Actions',
    displayOrder: 19,
    ghlId: 'badd7521-913c-43b8-9b7a-1c1ccedac63c',
    triggers: ['Receive the typed OT-A1 opt-out invocation for STOP or equivalent intent.'],
    actions: [
      'Set the relevant channel DND state.',
      'Update canonical consent and suppression fields.',
      'Remove related opt-in tags and apply OT | Marketing Suppressed when appropriate.',
      'Remove the adult from marketing/nurture workflows and stop bot auto-follow-up.',
      'Send no acknowledgement until the registry wording conflict is separately resolved.',
    ],
    blocker:
      'DRAFT_BLOCKED_APP_CONTRACT: typed opt-out adapter and suppression mapping are absent.',
  }),
  'OT-11': {
    folder: '99 - Deprecated',
    displayOrder: 20,
    ghlId: '',
    desiredStatus: 'BLOCKED',
    observedStatus: 'MISSING',
    exactOrderedTriggers: ['No active trigger is allowed.'],
    exactOrderedActions: ['Do not create or activate; OT-A1 and OT-B01 supersede this contract.'],
    observedTriggers: [],
    observedActions: [],
    lastReadback: finalReadback,
    canary: {
      result: 'not_applicable',
      reference: finalOrganizationEvidence,
      detail: 'Deprecated contract.',
    },
    blocker:
      'Superseded; dependency-check before any safe quarantine of an unknown historical asset.',
    evidence: [finalOrganizationEvidence],
  },
  'OT-12': {
    folder: '99 - Deprecated',
    displayOrder: 21,
    ghlId: '',
    desiredStatus: 'BLOCKED',
    observedStatus: 'MISSING',
    exactOrderedTriggers: ['No task-creating support trigger is allowed.'],
    exactOrderedActions: ['Do not create or activate a human-task workflow.'],
    observedTriggers: [],
    observedActions: [],
    lastReadback: finalReadback,
    canary: {
      result: 'not_applicable',
      reference: finalOrganizationEvidence,
      detail: 'Deprecated contract.',
    },
    blocker:
      'Deprecated; dependency-check before any safe quarantine of an unknown historical asset.',
    evidence: [finalOrganizationEvidence],
  },
  'OT-HUMAN-HANDOFF': {
    folder: '99 - Deprecated',
    displayOrder: 22,
    ghlId: '',
    desiredStatus: 'BLOCKED',
    observedStatus: 'MISSING',
    exactOrderedTriggers: ['No active trigger is allowed.'],
    exactOrderedActions: ['Do not create, activate, or silently delete a historical asset.'],
    observedTriggers: [],
    observedActions: [],
    lastReadback: finalReadback,
    canary: {
      result: 'not_applicable',
      reference: finalOrganizationEvidence,
      detail: 'Forbidden/deprecated contract.',
    },
    blocker:
      'Forbidden; dependency-check before any safe quarantine of an unknown historical asset.',
    evidence: [finalOrganizationEvidence],
  },
};

export const workflowControlPolicy = {
  canonicalDesiredState: 'GitHub repository registry on the reviewed PR head',
  browserMutationAuthority: 'exact reviewed Git-authored Agent Mode job only',
  closedLoop: [
    'reviewed_git_job',
    'permitted_browser_change',
    'save',
    'navigate_away_or_reload',
    'reopen_and_read_back',
    'bounded_safe_canary',
    'sanitized_result_committed',
    'drift_validator_compares_observation_to_registry',
  ],
  approvalGates: ['activation', 'broad_send', 'payment', 'destructive_action'],
  unknownWorkflowPolicy: {
    report: true,
    dependencyCheckRequired: true,
    quarantineFolder: '99 - Deprecated',
    quarantineOnlyWhenSafeAndAuthorized: true,
    silentlyDelete: false,
  },
} as const;
