import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type CrmApplyReport = {
  schema_version?: string;
  status?: string;
  batch_key?: string;
  target_environment?: string;
  dry_run_report_sha256?: string;
  counts?: {
    total_rows?: number;
    unique_identity_count?: number;
    crm_importable?: number;
    inserted_contacts?: number;
    skipped_existing_contacts?: number;
    email_campaign_eligible?: number;
    whatsapp_campaign_eligible?: number;
    suppressed?: number;
    sends_queued?: number;
  };
  safety?: {
    raw_values_included?: boolean;
    raw_values_printed?: boolean;
    external_sends_performed?: boolean;
    provider_mutation_count?: number;
  };
};

type CrmReconcileReport = {
  apply_status?: string;
  replay_status?: string;
  replay_database_writes_performed?: boolean;
  dry_run_report_sha256?: string;
  counts?: {
    contacts_total?: number;
    import_batches?: number;
    import_rows?: number;
    outbox_events_total?: number;
    latest_migration?: string;
  };
  channel_counts?: {
    email_campaign_eligible?: number;
    whatsapp_campaign_eligible?: number;
    suppressed_rows?: number;
    raw_values_excluded_rows?: number;
  };
  safety?: {
    raw_values_included?: boolean;
    raw_values_printed?: boolean;
    external_sends_performed?: boolean;
    provider_mutation_count?: number;
    sends_queued?: number;
  };
};

type ProductionSignupProof = {
  first_status?: number;
  second_status?: number;
  duplicate_submission_on_replay?: boolean;
  counts?: {
    contact_rows?: number;
    signup_rows?: number;
    outbox_rows?: number;
    whatsapp_outbox_rows?: number;
    raw_value_rows?: number;
  };
  safety?: {
    raw_email_included?: boolean;
    raw_phone_included?: boolean;
    provider_mutation_count?: number;
    broad_campaign_sends?: number;
  };
};

export type CampaignSeedApprovalPacket = {
  schema_version: 'onetime.rabbi_day_one_crm.campaign_seed_approval_packet.v1';
  generated_at: string;
  status: 'ready_for_operator_approval' | 'blocked';
  blocked_reasons: string[];
  source_evidence: {
    crm_apply_path: string;
    crm_apply_sha256: string;
    crm_reconcile_path: string;
    crm_reconcile_sha256: string;
    production_signup_proof_path: string;
    production_signup_proof_sha256: string;
    runtime_version: 'rabbi-day-one-crm-ed77a04';
    runtime_sha: 'ed77a04dd24391d5b79be7f839d7f5752a57e0f9';
    latest_production_migration: '2204_w12_100_real_source_crm_apply';
  };
  audience: {
    segment: 'one_time_real_crm_email_campaign_eligible';
    channel: 'email';
    eligible_count: number;
    seed_requested_count: 1;
    broad_requested_count: 0;
    whatsapp_eligible_count: number;
    suppressed_count: number;
    raw_recipient_list_included: false;
  };
  proposed_seed_copy: {
    template_revision: 'rabbi-day-one-email-seed-v1';
    subject: string;
    preheader: string;
    text: string;
    cta_url: 'https://join.onetimeonetime.com/signup';
    message_body_included_for_operator_approval: true;
  };
  approval: {
    seed_send_authorized: false;
    broad_campaign_authorized: false;
    required_operator_approval_statement: string;
    required_operator_confirmation: 'ONE-TIME-CAMPAIGN-SEED-OK';
    exact_action_after_approval: string;
  };
  safety: {
    production_side_effects: false;
    database_writes_performed: false;
    external_send_performed: false;
    provider_mutation_count: 0;
    private_destination_included: false;
    raw_values_included: false;
    broad_campaign_sends: 0;
  };
  snapshot_hash: string;
};

type BuildOptions = {
  now?: Date;
  crmApplyPath: string;
  crmReconcilePath: string;
  productionSignupProofPath: string;
};

const DEFAULT_APPLY_PATH = 'ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply.json';
const DEFAULT_RECONCILE_PATH = 'ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-reconcile.json';
const DEFAULT_SIGNUP_PATH = 'ops/codex-runs/RABBI-DAY-ONE-CRM/production-signup-proof.json';

const PROPOSED_SEED_COPY = {
  template_revision: 'rabbi-day-one-email-seed-v1',
  subject: 'Join One Time Mishnayos with Rabbi Eli Scheller',
  preheader: 'Live daily Mishnayos at 7:00 p.m. Israel time - free until Rosh Hashanah.',
  text: [
    'Hello,',
    '',
    'One Time Mishnayos with Rabbi Eli Scheller is open for signup.',
    '',
    'Give your son a love for learning Torah with a live daily Mishnayos class at 7:00 p.m. Israel time, live from Eretz Yisrael.',
    '',
    'Join now - free until Rosh Hashanah.',
    '',
    'Sign up: https://join.onetimeonetime.com/signup',
    '',
    '- One Time Mishnayos',
  ].join('\n'),
  cta_url: 'https://join.onetimeonetime.com/signup',
  message_body_included_for_operator_approval: true,
} as const;

export async function buildCampaignSeedApprovalPacket(
  options: BuildOptions,
): Promise<CampaignSeedApprovalPacket> {
  const [applyInput, reconcileInput, signupInput] = await Promise.all([
    readJsonWithSha<CrmApplyReport>(options.crmApplyPath),
    readJsonWithSha<CrmReconcileReport>(options.crmReconcilePath),
    readJsonWithSha<ProductionSignupProof>(options.productionSignupProofPath),
  ]);
  const blockedReasons = campaignSeedBlockedReasons({
    apply: applyInput.json,
    reconcile: reconcileInput.json,
    signup: signupInput.json,
  });
  const eligibleCount = numberOrZero(applyInput.json.counts?.email_campaign_eligible);
  const whatsappEligibleCount = numberOrZero(applyInput.json.counts?.whatsapp_campaign_eligible);
  const suppressedCount = numberOrZero(applyInput.json.counts?.suppressed);
  const snapshotPayload = {
    source: {
      crm_apply_sha256: applyInput.sha256,
      crm_reconcile_sha256: reconcileInput.sha256,
      production_signup_proof_sha256: signupInput.sha256,
      dry_run_report_sha256: applyInput.json.dry_run_report_sha256 ?? null,
      batch_key: applyInput.json.batch_key ?? null,
    },
    audience: {
      segment: 'one_time_real_crm_email_campaign_eligible',
      channel: 'email',
      eligible_count: eligibleCount,
      seed_requested_count: 1,
      broad_requested_count: 0,
      whatsapp_eligible_count: whatsappEligibleCount,
      suppressed_count: suppressedCount,
    },
    proposed_seed_copy: PROPOSED_SEED_COPY,
    safety: {
      production_side_effects: false,
      external_send_performed: false,
      provider_mutation_count: 0,
      broad_campaign_sends: 0,
    },
  };
  const snapshotHash = sha256(canonicalJson(snapshotPayload));
  return {
    schema_version: 'onetime.rabbi_day_one_crm.campaign_seed_approval_packet.v1',
    generated_at: (options.now ?? new Date()).toISOString(),
    status: blockedReasons.length ? 'blocked' : 'ready_for_operator_approval',
    blocked_reasons: blockedReasons,
    source_evidence: {
      crm_apply_path: normalizePathForEvidence(options.crmApplyPath),
      crm_apply_sha256: applyInput.sha256,
      crm_reconcile_path: normalizePathForEvidence(options.crmReconcilePath),
      crm_reconcile_sha256: reconcileInput.sha256,
      production_signup_proof_path: normalizePathForEvidence(options.productionSignupProofPath),
      production_signup_proof_sha256: signupInput.sha256,
      runtime_version: 'rabbi-day-one-crm-ed77a04',
      runtime_sha: 'ed77a04dd24391d5b79be7f839d7f5752a57e0f9',
      latest_production_migration: '2204_w12_100_real_source_crm_apply',
    },
    audience: {
      segment: 'one_time_real_crm_email_campaign_eligible',
      channel: 'email',
      eligible_count: eligibleCount,
      seed_requested_count: 1,
      broad_requested_count: 0,
      whatsapp_eligible_count: whatsappEligibleCount,
      suppressed_count: suppressedCount,
      raw_recipient_list_included: false,
    },
    proposed_seed_copy: PROPOSED_SEED_COPY,
    approval: {
      seed_send_authorized: false,
      broad_campaign_authorized: false,
      required_operator_approval_statement: [
        'APPROVE_ONE_TIME_CAMPAIGN_SEED',
        snapshotHash,
        String(eligibleCount),
        'email',
        'seed-only',
      ].join(':'),
      required_operator_confirmation: 'ONE-TIME-CAMPAIGN-SEED-OK',
      exact_action_after_approval:
        'Send exactly one seed email to the protected operator-approved destination; do not send to the 1,357-person real audience until separate broad-campaign approval is recorded.',
    },
    safety: {
      production_side_effects: false,
      database_writes_performed: false,
      external_send_performed: false,
      provider_mutation_count: 0,
      private_destination_included: false,
      raw_values_included: false,
      broad_campaign_sends: 0,
    },
    snapshot_hash: snapshotHash,
  };
}

export function formatCampaignSeedApprovalPacket(packet: CampaignSeedApprovalPacket) {
  return [
    '# One Time Campaign Seed Approval Packet',
    '',
    `Status: ${packet.status}`,
    `Generated: ${packet.generated_at}`,
    `Snapshot hash: ${packet.snapshot_hash}`,
    '',
    '## Audience',
    '',
    `- Segment: ${packet.audience.segment}`,
    `- Channel: ${packet.audience.channel}`,
    `- Email-campaign eligible: ${packet.audience.eligible_count}`,
    `- Seed requested count: ${packet.audience.seed_requested_count}`,
    `- Broad requested count: ${packet.audience.broad_requested_count}`,
    `- WhatsApp eligible: ${packet.audience.whatsapp_eligible_count}`,
    `- Suppressed: ${packet.audience.suppressed_count}`,
    `- Raw recipient list included: ${packet.audience.raw_recipient_list_included}`,
    '',
    '## Proposed Seed Copy',
    '',
    `Template revision: ${packet.proposed_seed_copy.template_revision}`,
    `Subject: ${packet.proposed_seed_copy.subject}`,
    `Preheader: ${packet.proposed_seed_copy.preheader}`,
    '',
    '```text',
    packet.proposed_seed_copy.text,
    '```',
    '',
    '## Required Approval',
    '',
    `Seed send authorized now: ${packet.approval.seed_send_authorized}`,
    `Broad campaign authorized now: ${packet.approval.broad_campaign_authorized}`,
    '',
    'Operator approval statement required before seed send:',
    '',
    '```text',
    packet.approval.required_operator_approval_statement,
    '```',
    '',
    `Operator confirmation required: ${packet.approval.required_operator_confirmation}`,
    '',
    'Exact action after approval:',
    '',
    packet.approval.exact_action_after_approval,
    '',
    '## Safety',
    '',
    `- Production side effects: ${packet.safety.production_side_effects}`,
    `- Database writes performed: ${packet.safety.database_writes_performed}`,
    `- External send performed: ${packet.safety.external_send_performed}`,
    `- Provider mutation count: ${packet.safety.provider_mutation_count}`,
    `- Private destination included: ${packet.safety.private_destination_included}`,
    `- Raw values included: ${packet.safety.raw_values_included}`,
    `- Broad campaign sends: ${packet.safety.broad_campaign_sends}`,
    '',
    '## Source Evidence',
    '',
    `- CRM apply: ${packet.source_evidence.crm_apply_path}`,
    `- CRM reconcile: ${packet.source_evidence.crm_reconcile_path}`,
    `- Production signup proof: ${packet.source_evidence.production_signup_proof_path}`,
    `- Runtime: ${packet.source_evidence.runtime_version} / ${packet.source_evidence.runtime_sha}`,
    `- Latest production migration: ${packet.source_evidence.latest_production_migration}`,
    '',
  ].join('\n');
}

function campaignSeedBlockedReasons(input: {
  apply: CrmApplyReport;
  reconcile: CrmReconcileReport;
  signup: ProductionSignupProof;
}) {
  const reasons: string[] = [];
  if (input.apply.status !== 'applied') reasons.push('CRM_APPLY_NOT_APPLIED');
  if (input.reconcile.apply_status !== 'applied') reasons.push('CRM_RECONCILE_NOT_APPLIED');
  if (input.reconcile.replay_status !== 'replayed') reasons.push('CRM_REPLAY_NOT_RECORDED');
  if (input.reconcile.replay_database_writes_performed !== false) {
    reasons.push('CRM_REPLAY_WRITES_NOT_FALSE');
  }
  if (input.apply.counts?.sends_queued !== 0) reasons.push('CRM_APPLY_SENDS_QUEUED');
  if (input.reconcile.counts?.outbox_events_total !== 0)
    reasons.push('CRM_RECONCILE_OUTBOX_NOT_ZERO');
  if (input.apply.safety?.external_sends_performed !== false) {
    reasons.push('CRM_APPLY_EXTERNAL_SENDS_NOT_FALSE');
  }
  if (input.reconcile.safety?.external_sends_performed !== false) {
    reasons.push('CRM_RECONCILE_EXTERNAL_SENDS_NOT_FALSE');
  }
  if (input.apply.safety?.provider_mutation_count !== 0) {
    reasons.push('CRM_APPLY_PROVIDER_MUTATION_NOT_ZERO');
  }
  if (input.reconcile.safety?.provider_mutation_count !== 0) {
    reasons.push('CRM_RECONCILE_PROVIDER_MUTATION_NOT_ZERO');
  }
  if (input.apply.safety?.raw_values_included !== false)
    reasons.push('CRM_APPLY_RAW_VALUES_INCLUDED');
  if (input.reconcile.safety?.raw_values_included !== false) {
    reasons.push('CRM_RECONCILE_RAW_VALUES_INCLUDED');
  }
  if (
    input.apply.counts?.email_campaign_eligible !==
    input.reconcile.channel_counts?.email_campaign_eligible
  ) {
    reasons.push('EMAIL_ELIGIBLE_COUNT_MISMATCH');
  }
  if (
    input.apply.counts?.whatsapp_campaign_eligible !==
    input.reconcile.channel_counts?.whatsapp_campaign_eligible
  ) {
    reasons.push('WHATSAPP_ELIGIBLE_COUNT_MISMATCH');
  }
  if (input.signup.first_status !== 200 || input.signup.second_status !== 200) {
    reasons.push('PRODUCTION_SIGNUP_CANARY_NOT_OK');
  }
  if (input.signup.duplicate_submission_on_replay !== true) {
    reasons.push('PRODUCTION_SIGNUP_REPLAY_NOT_DUPLICATE');
  }
  if (input.signup.counts?.raw_value_rows !== 0) reasons.push('SIGNUP_RAW_VALUE_ROWS_NOT_ZERO');
  if (input.signup.safety?.raw_email_included !== false) reasons.push('SIGNUP_RAW_EMAIL_INCLUDED');
  if (input.signup.safety?.raw_phone_included !== false) reasons.push('SIGNUP_RAW_PHONE_INCLUDED');
  if (input.signup.safety?.provider_mutation_count !== 0) {
    reasons.push('SIGNUP_PROVIDER_MUTATION_NOT_ZERO');
  }
  if (input.signup.safety?.broad_campaign_sends !== 0) {
    reasons.push('SIGNUP_BROAD_CAMPAIGN_SENDS_NOT_ZERO');
  }
  return reasons.sort();
}

async function readJsonWithSha<T>(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  return {
    json: JSON.parse(raw) as T,
    sha256: sha256(raw),
  };
}

function normalizePathForEvidence(filePath: string) {
  return filePath.split(path.sep).join('/');
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=', 2);
    if (!key) continue;
    const value = inlineValue ?? argv[index + 1] ?? '';
    if (inlineValue === undefined && argv[index + 1] !== undefined) index += 1;
    args.set(key, value);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = args.get('out');
  if (!out) throw new Error('--out is required');
  const markdownOut = args.get('md-out');
  const now = args.get('now');
  const packet = await buildCampaignSeedApprovalPacket({
    crmApplyPath: args.get('crm-apply') ?? DEFAULT_APPLY_PATH,
    crmReconcilePath: args.get('crm-reconcile') ?? DEFAULT_RECONCILE_PATH,
    productionSignupProofPath: args.get('production-signup-proof') ?? DEFAULT_SIGNUP_PATH,
    ...(now ? { now: new Date(now) } : {}),
  });
  await writeFile(out, `${JSON.stringify(packet, null, 2)}\n`);
  if (markdownOut) {
    await writeFile(markdownOut, formatCampaignSeedApprovalPacket(packet));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
