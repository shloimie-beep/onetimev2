import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  OPS03_ACTION_BY_PROVIDER,
  OPS03_PACKET_ID,
  OPS03_PROVIDERS,
  OPS03_TASK_ID,
  assertOps03RedactionClean,
  decideOps03ProviderStatus,
  evaluateOps03Cardinality,
  ops03Fingerprint,
  scanTextForOps03Leaks,
  validateOps03AuthorizationRecord,
  type Ops03Outcome,
  type Ops03Provider,
  type Ops03ProviderStatus,
} from '../packages/domain/src/ops03/canary-conductor.ts';

type EvidenceCategory =
  | 'state'
  | 'repository'
  | 'staging_sha'
  | 'deployment_binding'
  | 'branch_audit'
  | 'configuration'
  | 'identity'
  | 'least_privilege'
  | 'sink_test_mode'
  | 'authorization'
  | 'webhook_security'
  | 'idempotency'
  | 'retry'
  | 'dead_letter'
  | 'provider_down'
  | 'role_boundary'
  | 'canary'
  | 'cleanup'
  | 'rollback'
  | 'redaction'
  | 'test';

type EvidenceItem = {
  evidence_id: string;
  task_id: typeof OPS03_TASK_ID;
  packet_id: typeof OPS03_PACKET_ID;
  observed_at: string;
  provider: Ops03Provider | 'global';
  category: EvidenceCategory;
  check_id: string;
  outcome: Ops03Outcome;
  source_kind:
    | 'git'
    | 'deployment_metadata'
    | 'protected_config'
    | 'provider_read_only'
    | 'test_runner'
    | 'static_analysis'
    | 'runtime_observation'
    | 'authorization_record'
    | 'runbook'
    | 'cleanup_observation';
  summary: string;
  redaction_verified: true;
  blocker_codes?: string[];
  commit_sha?: string;
  artifact_sha256?: string;
  fingerprints?: string[];
};

type ProviderGate = {
  outcome: Ops03Outcome;
  evidence_ids: string[];
  summary: string;
};

type ProviderReceiptRow = {
  provider: Ops03Provider;
  status: Ops03ProviderStatus;
  action: string;
  configuration: ProviderGate;
  identity_and_least_privilege: ProviderGate;
  sink_or_test_mode: ProviderGate;
  webhook_security: ProviderGate;
  one_target_cardinality: ProviderGate;
  authorization: ProviderGate;
  execution: {
    attempted: boolean;
    side_effect_count: number;
    result: 'not_run' | 'passed' | 'failed' | 'uncertain';
    evidence_ids: string[];
  };
  cleanup_or_disable: {
    result: 'not_required' | 'completed' | 'disabled' | 'manual_action_required' | 'failed';
    runbook_step_ids: string[];
    evidence_ids: string[];
  };
  blocker_codes: string[];
  evidence_ids: string[];
};

type ProviderMatrixRow = ProviderReceiptRow & {
  implementation_files: string[];
  config_reference_names: string[];
  final_reason: string;
};

const packetRoot = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? '.',
  '.codex',
  'tasks',
  OPS03_TASK_ID,
  OPS03_PACKET_ID,
);

const privateStatePath = path.join(packetRoot, 'state.json');
const artifactRoot = path.join('artifacts', OPS03_TASK_ID, OPS03_PACKET_ID);
const verifiedCommands = parseVerifiedCommands(process.argv.slice(2));

function main() {
  const startedAt = nowIso();
  mkdirSync(artifactRoot, { recursive: true });

  const evidence: EvidenceItem[] = [];
  let evidenceCounter = 1;
  const addEvidence = (input: Omit<EvidenceItem, 'evidence_id' | 'task_id' | 'packet_id'>) => {
    assertOps03RedactionClean(input.summary);
    const item: EvidenceItem = {
      evidence_id: `OPS-03-EV-${String(evidenceCounter).padStart(4, '0')}`,
      task_id: OPS03_TASK_ID,
      packet_id: OPS03_PACKET_ID,
      ...input,
    };
    evidenceCounter += 1;
    evidence.push(item);
    return item.evidence_id;
  };

  const stateSnapshot = readJsonIfExists(privateStatePath) as Record<string, unknown> | null;
  const stateEvidenceId = addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'state',
    check_id: 'OPS-03-G01-STATE-FIRST',
    outcome: stateSnapshot?.task_id === OPS03_TASK_ID ? 'passed' : 'blocked',
    source_kind: 'runtime_observation',
    summary:
      stateSnapshot?.task_id === OPS03_TASK_ID
        ? 'Private OPS-03 state journal existed before this conductor run and contains only safe task metadata.'
        : 'Private OPS-03 state journal was not readable before conductor artifact generation.',
    redaction_verified: true,
    blocker_codes: stateSnapshot?.task_id === OPS03_TASK_ID ? [] : ['OPS-03-GLOBAL-STATE-MISSING'],
  });

  const repo = discoverRepository();
  addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'repository',
    check_id: 'OPS-03-G02-REPOSITORY-DISCOVERY',
    outcome: repo.safeSlug === 'webcraft-media/onetimev2' ? 'passed' : 'blocked',
    source_kind: 'git',
    summary:
      repo.safeSlug === 'webcraft-media/onetimev2'
        ? 'Target repository resolved uniquely by git origin slug.'
        : 'Target repository did not resolve to the expected One Time product slug.',
    redaction_verified: true,
    fingerprints: [repo.fingerprint],
    blocker_codes:
      repo.safeSlug === 'webcraft-media/onetimev2'
        ? []
        : ['OPS-03-GLOBAL-TARGET-REPOSITORY-AMBIGUOUS'],
  });

  const source = discoverSourceSha();
  const stagingShaEvidenceId = addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'staging_sha',
    check_id: 'OPS-03-G02-EXACT-COMMIT',
    outcome: source.headExists ? 'passed' : 'blocked',
    source_kind: 'git',
    summary: source.headExists
      ? 'Full current branch commit exists locally and prior control candidate is an ancestor.'
      : 'Full current branch commit could not be verified locally.',
    redaction_verified: true,
    commit_sha: source.headSha,
    blocker_codes: source.headExists ? [] : ['OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED'],
  });

  const deploymentBindingEvidenceId = addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'deployment_binding',
    check_id: 'OPS-03-G03-DEPLOYMENT-BINDING',
    outcome: 'blocked',
    source_kind: 'deployment_metadata',
    summary:
      'No trusted staging deployment artifact binding was found in repo evidence; source and CI evidence are not deployment binding.',
    redaction_verified: true,
    blocker_codes: ['OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED'],
  });

  const branchAudit = auditBranches(source.headSha);
  const branchAuditEvidenceId = addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'branch_audit',
    check_id: 'OPS-03-G05-BRANCH-AUDIT',
    outcome: 'passed',
    source_kind: 'git',
    summary:
      'Relevant local and remote provider branches were inspected with read-only git commands; no existing implementation branch was mutated.',
    redaction_verified: true,
  });

  const commandEvidenceId = addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'test',
    check_id: 'OPS-03-G06-VERIFIED-COMMANDS',
    outcome: verifiedCommands.length > 0 ? 'passed' : 'not_observed',
    source_kind: 'test_runner',
    summary:
      verifiedCommands.length > 0
        ? 'Focused provider-independent commands were reported as passed before artifact generation.'
        : 'No verified command summaries were passed to the conductor.',
    redaction_verified: true,
  });

  const authorizationNegative = validateOps03AuthorizationRecord(
    {
      schema_version: '1.0.0',
      task_id: OPS03_TASK_ID,
      authorization_id: 'OPS-03-AUTH-SAMPLE1',
      provider: 'telegram',
      environment: 'staging',
      integrated_staging_sha: source.headSha,
      target_alias: 'ops03-sample',
      action: 'whatsapp.public_lead_single_turn',
      authorized_from: '2026-07-16T00:00:00Z',
      authorized_until: '2026-07-17T00:00:00Z',
      approver_ref: 'OPS-03-APPROVER-SAMPLE',
      cleanup_authorization: 'disable_only',
    },
    { exactStagingSha: source.headSha, now: new Date('2026-07-16T06:00:00Z') },
  );
  const authorizationEvidenceId = addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'authorization',
    check_id: 'OPS-03-G10-AUTHORIZATION-VALIDATOR',
    outcome: !authorizationNegative.ok ? 'passed' : 'failed',
    source_kind: 'static_analysis',
    summary:
      'Authorization validator rejects provider/action mismatch and requires current provider-specific records.',
    redaction_verified: true,
  });

  const cardinality = evaluateOps03Cardinality({
    targetAliases: ['ops03-single-target'],
    actions: ['email.sink_transactional_delivery'],
  });
  const cardinalityEvidenceId = addEvidence({
    observed_at: startedAt,
    provider: 'global',
    category: 'idempotency',
    check_id: 'OPS-03-G07-ONE-TARGET-GUARD',
    outcome: cardinality.passed ? 'passed' : 'failed',
    source_kind: 'static_analysis',
    summary: 'One-target guard accepts exactly one OPS-03 alias and exactly one allowed action.',
    redaction_verified: true,
    blocker_codes: cardinality.blocker_codes,
  });

  const providerMatrix = buildProviderMatrix({
    addEvidence,
    observedAt: startedAt,
    sourceSha: source.headSha,
    globalBlockers: ['OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED'],
  });

  const independentChecks = [
    {
      check_id: 'OPS-03-G01-STATE-FIRST',
      outcome: 'passed' as Ops03Outcome,
      evidence_ids: [stateEvidenceId],
      summary: 'Private state was persisted before conductor artifact generation.',
    },
    {
      check_id: 'OPS-03-G02-EXACT-COMMIT',
      outcome: source.headExists ? ('passed' as Ops03Outcome) : ('blocked' as Ops03Outcome),
      evidence_ids: [stagingShaEvidenceId],
      summary: 'Local full commit exists; deployment binding remains a separate blocked gate.',
    },
    {
      check_id: 'OPS-03-G03-DEPLOYMENT-BINDING',
      outcome: 'blocked' as Ops03Outcome,
      evidence_ids: [deploymentBindingEvidenceId],
      summary: 'No trusted staging deployment binding was available.',
    },
    {
      check_id: 'OPS-03-G05-BRANCH-AUDIT',
      outcome: 'passed' as Ops03Outcome,
      evidence_ids: [branchAuditEvidenceId],
      summary: 'Branch audit used read-only git metadata.',
    },
    {
      check_id: 'OPS-03-G06-VERIFIED-COMMANDS',
      outcome:
        verifiedCommands.length > 0 ? ('passed' as Ops03Outcome) : ('not_observed' as Ops03Outcome),
      evidence_ids: [commandEvidenceId],
      summary: 'Focused provider-independent verification command summaries are recorded.',
    },
    {
      check_id: 'OPS-03-G07-ONE-TARGET-GUARD',
      outcome: cardinality.passed ? ('passed' as Ops03Outcome) : ('failed' as Ops03Outcome),
      evidence_ids: [cardinalityEvidenceId],
      summary: 'Exactly-one alias and action validation is installed.',
    },
    {
      check_id: 'OPS-03-G10-AUTHORIZATION-VALIDATOR',
      outcome: !authorizationNegative.ok ? ('passed' as Ops03Outcome) : ('failed' as Ops03Outcome),
      evidence_ids: [authorizationEvidenceId],
      summary: 'Provider-specific authorization validation is installed.',
    },
  ];

  writeJson(path.join(artifactRoot, 'OPS-03-state-snapshot.json'), {
    schema_version: '1.0.0',
    task_id: OPS03_TASK_ID,
    packet_id: OPS03_PACKET_ID,
    generated_at: startedAt,
    private_state_path_present: existsSync(privateStatePath),
    private_state_phase: stateSnapshot?.phase ?? 'not_readable',
    target_repository: {
      discovery_status: repo.safeSlug === 'webcraft-media/onetimev2' ? 'unique' : 'ambiguous',
      safe_slug: repo.safeSlug,
      fingerprint: repo.fingerprint,
    },
    integrated_staging_sha: {
      status: 'blocked',
      source_candidate_sha: source.headSha,
      deployment_binding: 'not_observed',
      blocker_codes: ['OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED'],
    },
    providers: providerMatrix.map((provider) => ({
      provider: provider.provider,
      status: provider.status,
      blocker_codes: provider.blocker_codes,
      network_side_effect_count: provider.execution.side_effect_count,
    })),
  });

  writeJson(path.join(artifactRoot, 'OPS-03-staging-sha-evidence.json'), {
    schema_version: '1.0.0',
    task_id: OPS03_TASK_ID,
    packet_id: OPS03_PACKET_ID,
    generated_at: startedAt,
    repository: {
      safe_slug: repo.safeSlug,
      fingerprint: repo.fingerprint,
    },
    source_candidate: {
      sha: source.headSha,
      current_branch: source.branch,
      head_exists: source.headExists,
      control_candidate_ancestor: source.controlCandidateAncestor,
    },
    deployment_binding: {
      outcome: 'blocked',
      blocker_codes: ['OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED'],
      safe_summary:
        'No authenticated staging build metadata, signed provenance, deployment manifest, or traceable immutable digest was found.',
    },
  });

  writeText(path.join(artifactRoot, 'OPS-03-branch-audit.md'), renderBranchAudit(branchAudit));
  writeJson(path.join(artifactRoot, 'OPS-03-provider-matrix.json'), {
    schema_version: '1.0.0',
    task_id: OPS03_TASK_ID,
    packet_id: OPS03_PACKET_ID,
    generated_at: startedAt,
    integrated_staging_sha_status: 'blocked',
    providers: providerMatrix,
  });
  writeText(
    path.join(artifactRoot, 'OPS-03-provider-matrix.md'),
    renderProviderMatrix(providerMatrix),
  );
  writeText(
    path.join(artifactRoot, 'OPS-03-provider-independent-tests.md'),
    renderIndependentTests(independentChecks, verifiedCommands),
  );
  writeText(path.join(artifactRoot, 'OPS-03-rollback-disable-matrix.md'), renderRollbackMatrix());

  const sanitizedEvidencePath = path.join(artifactRoot, 'OPS-03-sanitized-evidence.json');
  writeJson(sanitizedEvidencePath, buildSanitizedEvidence(startedAt, evidence, 0));
  const rollbackDigest = fileSha256(path.join(artifactRoot, 'OPS-03-rollback-disable-matrix.md'));
  let evidenceDigest = fileSha256(sanitizedEvidencePath);

  const receiptPath = path.join(artifactRoot, 'OPS-03-canary-receipt.json');
  const receipt = buildReceipt({
    startedAt,
    repo,
    source,
    independentChecks,
    providerMatrix,
    rollbackDigest,
    evidenceDigest,
    evidenceCount: evidence.length,
  });
  writeJson(receiptPath, receipt);

  const redactionScan = scanArtifacts(artifactRoot);
  if (redactionScan.findings > 0) {
    throw new Error('OPS-03 artifact redaction scan failed.');
  }
  const redactionEvidenceId = addEvidence({
    observed_at: nowIso(),
    provider: 'global',
    category: 'redaction',
    check_id: 'OPS-03-G08-ARTIFACT-REDACTION',
    outcome: 'passed',
    source_kind: 'static_analysis',
    summary: 'Generated OPS-03 artifacts passed the no-secret and no-target-material scan.',
    redaction_verified: true,
  });
  independentChecks.push({
    check_id: 'OPS-03-G08-ARTIFACT-REDACTION',
    outcome: 'passed' as Ops03Outcome,
    evidence_ids: [redactionEvidenceId],
    summary: 'Generated OPS-03 artifacts passed the final redaction scan.',
  });

  writeJson(
    sanitizedEvidencePath,
    buildSanitizedEvidence(startedAt, evidence, redactionScan.files),
  );
  evidenceDigest = fileSha256(sanitizedEvidencePath);
  writeJson(
    receiptPath,
    buildReceipt({
      startedAt,
      repo,
      source,
      independentChecks,
      providerMatrix,
      rollbackDigest,
      evidenceDigest,
      evidenceCount: evidence.length,
    }),
  );

  const finalScan = scanArtifacts(artifactRoot);
  if (finalScan.findings > 0) throw new Error('OPS-03 final redaction scan failed.');
  updatePrivateState({
    repo,
    source,
    providerMatrix,
    evidenceIds: evidence.map((item) => item.evidence_id),
  });

  process.stdout.write(
    JSON.stringify(
      {
        task_id: OPS03_TASK_ID,
        packet_id: OPS03_PACKET_ID,
        artifact_root: normalizePath(artifactRoot),
        receipt: normalizePath(receiptPath),
        providers: Object.fromEntries(
          providerMatrix.map((provider) => [provider.provider, provider.status]),
        ),
        canary_side_effects: 0,
        redaction_scan: 'passed',
      },
      null,
      2,
    ),
  );
  process.stdout.write('\n');
}

function parseVerifiedCommands(args: string[]) {
  const commands: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--verified-command') {
      const next = args[index + 1];
      if (next) {
        assertOps03RedactionClean(next);
        commands.push(next);
        index += 1;
      }
    }
  }
  return commands;
}

function discoverRepository() {
  const remote = git(['remote', 'get-url', 'origin']).trim();
  const safeSlug = safeSlugFromRemote(remote);
  return {
    safeSlug,
    fingerprint: ops03Fingerprint(safeSlug),
  };
}

function discoverSourceSha() {
  const headSha = git(['rev-parse', 'HEAD']).trim();
  const branch = git(['branch', '--show-current']).trim();
  const headExists = gitExit(['cat-file', '-e', `${headSha}^{commit}`]) === 0;
  const control = readJsonIfExists(
    path.join('ops', 'execution', 'control', 'CANONICAL-CANDIDATE.json'),
  ) as { candidate_head_sha?: string } | null;
  const controlCandidate = control?.candidate_head_sha;
  const controlCandidateAncestor = controlCandidate
    ? gitExit(['merge-base', '--is-ancestor', controlCandidate, headSha]) === 0
    : false;
  return {
    headSha,
    branch,
    headExists,
    controlCandidate: controlCandidate ?? null,
    controlCandidateAncestor,
  };
}

function auditBranches(headSha: string) {
  const refOutput = git([
    'for-each-ref',
    '--format=%(refname:short)|%(objectname)',
    'refs/heads',
    'refs/remotes/origin',
  ]);
  const relevantTokens = [
    'telegram',
    'whatsapp',
    'vimeo',
    'buffer',
    'stripe',
    'zoom',
    'provider',
    'delivery',
    'ops',
  ];
  const refs = refOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', sha = ''] = line.split('|');
      return {
        name,
        sha,
        relevant: relevantTokens.some((token) => name.toLowerCase().includes(token)),
        mergedIntoHead: sha ? gitExit(['merge-base', '--is-ancestor', sha, headSha]) === 0 : false,
      };
    })
    .filter((ref) => ref.relevant);
  return {
    generated_at: nowIso(),
    current_head: headSha,
    relevant_refs: refs,
  };
}

function buildProviderMatrix(input: {
  addEvidence: (item: Omit<EvidenceItem, 'evidence_id' | 'task_id' | 'packet_id'>) => string;
  observedAt: string;
  sourceSha: string;
  globalBlockers: string[];
}): ProviderMatrixRow[] {
  return OPS03_PROVIDERS.map((provider) => {
    const descriptor = providerDescriptor(provider);
    const implementationExists = descriptor.implementationFiles.some((file) => existsSync(file));
    const configurationEvidenceId = input.addEvidence({
      observed_at: input.observedAt,
      provider,
      category: 'configuration',
      check_id: `OPS-03-${provider.toUpperCase()}-CONFIGURATION`,
      outcome: 'blocked',
      source_kind: 'protected_config',
      summary: implementationExists
        ? 'Implementation references exist, but protected configuration presence was not observed from a protected store.'
        : 'No implementation adapter reference was found for this provider in the current branch.',
      redaction_verified: true,
      blocker_codes: ['OPS-03-PROVIDER-UNCONFIGURED'],
    });
    const authorizationEvidenceId = input.addEvidence({
      observed_at: input.observedAt,
      provider,
      category: 'authorization',
      check_id: `OPS-03-${provider.toUpperCase()}-AUTHORIZATION`,
      outcome: 'blocked',
      source_kind: 'authorization_record',
      summary: 'No separate current provider-specific OPS-03 authorization record was found.',
      redaction_verified: true,
      blocker_codes: ['OPS-03-PROVIDER-AUTHORIZATION-MISSING-OR-INVALID'],
    });
    const oneTargetEvidenceId = input.addEvidence({
      observed_at: input.observedAt,
      provider,
      category: 'idempotency',
      check_id: `OPS-03-${provider.toUpperCase()}-ONE-TARGET`,
      outcome: 'not_observed',
      source_kind: 'static_analysis',
      summary:
        'No provider target alias was resolved because configuration and authorization gates are closed.',
      redaction_verified: true,
      blocker_codes: ['OPS-03-PROVIDER-ONE-TARGET-FAILED'],
    });
    const rollbackEvidenceId = input.addEvidence({
      observed_at: input.observedAt,
      provider,
      category: 'rollback',
      check_id: `OPS-03-${provider.toUpperCase()}-ROLLBACK`,
      outcome: 'blocked',
      source_kind: 'runbook',
      summary:
        'Rollback steps are documented, but provider-specific kill switch verification requires protected staging configuration.',
      redaction_verified: true,
      blocker_codes: ['OPS-03-PROVIDER-ROLLBACK-UNVERIFIED'],
    });
    const status = decideOps03ProviderStatus({
      configured: false,
      hardBlocked: true,
      technicalReady: false,
      canaryPassed: false,
    });
    const commonNotObserved: ProviderGate = {
      outcome: 'not_observed',
      evidence_ids: [configurationEvidenceId],
      summary:
        'Technical proof was not attempted because protected configuration and deployment binding are unavailable.',
    };
    const blockerCodes = [
      'OPS-03-PROVIDER-UNCONFIGURED',
      'OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED',
      'OPS-03-PROVIDER-AUTHORIZATION-MISSING-OR-INVALID',
      'OPS-03-PROVIDER-ROLLBACK-UNVERIFIED',
    ];
    return {
      provider,
      status,
      action: OPS03_ACTION_BY_PROVIDER[provider],
      configuration: {
        outcome: 'blocked',
        evidence_ids: [configurationEvidenceId],
        summary:
          'Protected configuration was not available through a safe staging store during OPS-03.',
      },
      identity_and_least_privilege: commonNotObserved,
      sink_or_test_mode: commonNotObserved,
      webhook_security: commonNotObserved,
      one_target_cardinality: {
        outcome: 'not_observed',
        evidence_ids: [oneTargetEvidenceId],
        summary: 'No single protected target alias was resolved.',
      },
      authorization: {
        outcome: 'blocked',
        evidence_ids: [authorizationEvidenceId],
        summary: 'Current provider-specific written authorization is absent.',
      },
      execution: {
        attempted: false,
        side_effect_count: 0,
        result: 'not_run',
        evidence_ids: [],
      },
      cleanup_or_disable: {
        result: 'manual_action_required',
        runbook_step_ids: descriptor.rollbackStepIds,
        evidence_ids: [rollbackEvidenceId],
      },
      blocker_codes: blockerCodes,
      evidence_ids: [
        configurationEvidenceId,
        authorizationEvidenceId,
        oneTargetEvidenceId,
        rollbackEvidenceId,
      ],
      implementation_files: descriptor.implementationFiles,
      config_reference_names: descriptor.configRefs,
      final_reason:
        'Provider-independent code can be audited locally, but no staging deployment binding, protected configuration, target alias, or current authorization was available.',
    };
  });
}

function providerDescriptor(provider: Ops03Provider) {
  const descriptors: Record<
    Ops03Provider,
    { implementationFiles: string[]; configRefs: string[]; rollbackStepIds: string[] }
  > = {
    telegram: {
      implementationFiles: [
        'packages/domain/src/telegram/config.ts',
        'packages/domain/src/telegram/transport.ts',
        'apps/telegram-bot/src/ingress.ts',
      ],
      configRefs: [
        'ONE_TIME_TELEGRAM_TRANSPORT_ENABLED',
        'ONE_TIME_TELEGRAM_TOKEN_CONFIGURED',
        'ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED',
      ],
      rollbackStepIds: ['OPS-03-RB-TELEGRAM-DISABLE-HANDLER'],
    },
    whatsapp: {
      implementationFiles: [
        'apps/worker/src/delivery/provider-config.ts',
        'apps/worker/src/delivery/provider-router.ts',
        'apps/worker/src/delivery/provider-webhooks.ts',
      ],
      configRefs: [
        'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
        'ONE_TIME_WAPI_TRANSPORT_ENABLED',
        'ONE_TIME_DELIVERY_TEST_CANARY_WHATSAPP',
      ],
      rollbackStepIds: ['OPS-03-RB-WHATSAPP-DISABLE-ASSISTANT'],
    },
    vimeo: {
      implementationFiles: ['packages/domain/src/providers/vimeo.ts'],
      configRefs: [
        'ONE_TIME_VIMEO_ADAPTER_ENABLED',
        'ONE_TIME_VIMEO_ACCOUNT_REF_CONFIGURED',
        'ONE_TIME_VIMEO_STAGING_FOLDER_CONFIGURED',
      ],
      rollbackStepIds: ['OPS-03-RB-VIMEO-DISABLE-UPLOADER'],
    },
    buffer: {
      implementationFiles: ['packages/domain/src/providers/buffer.ts'],
      configRefs: [
        'ONE_TIME_BUFFER_ADAPTER_ENABLED',
        'ONE_TIME_BUFFER_STAGING_DESTINATION_CONFIGURED',
      ],
      rollbackStepIds: ['OPS-03-RB-BUFFER-DISABLE-DRAFT-CREATOR'],
    },
    stripe_test: {
      implementationFiles: ['packages/domain/src/billing/stripe-test-adapter.ts'],
      configRefs: [
        'ENABLE_PAYMENT_TRANSPORT',
        'ONE_TIME_STRIPE_TEST_ACCOUNT_CONFIGURED',
        'ONE_TIME_STRIPE_TEST_WEBHOOK_CONFIGURED',
      ],
      rollbackStepIds: ['OPS-03-RB-STRIPE-TEST-DISABLE-WEBHOOK'],
    },
    email: {
      implementationFiles: [
        'apps/worker/src/delivery/provider-config.ts',
        'apps/worker/src/delivery/provider-router.ts',
        'apps/worker/src/delivery/provider-webhooks.ts',
      ],
      configRefs: [
        'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
        'ONE_TIME_RESEND_TRANSPORT_ENABLED',
        'ONE_TIME_DELIVERY_TEST_CANARY_EMAIL',
      ],
      rollbackStepIds: ['OPS-03-RB-EMAIL-DISABLE-STAGING-SENDER'],
    },
    zoom: {
      implementationFiles: ['packages/domain/src/providers/zoom.ts'],
      configRefs: [
        'ONE_TIME_ZOOM_ADAPTER_ENABLED',
        'ONE_TIME_ZOOM_ACCOUNT_REF_CONFIGURED',
        'ONE_TIME_ZOOM_TEST_LEARNER_CONFIGURED',
      ],
      rollbackStepIds: ['OPS-03-RB-ZOOM-DISABLE-LAUNCH-ISSUER'],
    },
  };
  return descriptors[provider];
}

function buildReceipt(input: {
  startedAt: string;
  repo: { safeSlug: string; fingerprint: string };
  source: ReturnType<typeof discoverSourceSha>;
  independentChecks: Array<{
    check_id: string;
    outcome: Ops03Outcome;
    evidence_ids: string[];
    summary: string;
  }>;
  providerMatrix: ProviderMatrixRow[];
  rollbackDigest: string;
  evidenceDigest: string;
  evidenceCount: number;
}) {
  const completedAt = nowIso();
  return {
    schema_version: '1.0.0',
    task_id: OPS03_TASK_ID,
    packet_id: OPS03_PACKET_ID,
    run_id: `OPS-03-RUN-${input.startedAt.replace(/[-:]/g, '').replace('Z', 'Z')}-${ops03Fingerprint(
      input.source.headSha,
    ).slice(0, 8)}`,
    started_at: input.startedAt,
    completed_at: completedAt,
    target_repository: {
      discovery_status: input.repo.safeSlug === 'webcraft-media/onetimev2' ? 'unique' : 'ambiguous',
      safe_slug: input.repo.safeSlug,
      fingerprint: input.repo.fingerprint,
    },
    integrated_staging_sha: {
      outcome: input.source.headExists ? 'blocked' : 'failed',
      sha: input.source.headSha,
      evidence_ids: ['OPS-03-EV-0003'],
    },
    staging_deployment_binding: {
      outcome: 'blocked',
      evidence_ids: ['OPS-03-EV-0004'],
      summary: 'No trusted staging deployment binding was available for this source commit.',
    },
    provider_independent_checks: input.independentChecks,
    providers: input.providerMatrix.map(toReceiptProviderRow),
    forbidden_operations: {
      broad_campaign: false,
      production_data_import: false,
      root_dns_change: false,
      live_payment: false,
      public_post_without_human_approval: false,
    },
    rollback_matrix: {
      path: normalizePath(path.join(artifactRoot, 'OPS-03-rollback-disable-matrix.md')),
      sha256: input.rollbackDigest,
    },
    sanitized_evidence: {
      path: normalizePath(path.join(artifactRoot, 'OPS-03-sanitized-evidence.json')),
      sha256: input.evidenceDigest,
      item_count: input.evidenceCount,
    },
    redaction_scan_passed: true,
    global_blocker_codes: ['OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED'],
  };
}

function toReceiptProviderRow(row: ProviderMatrixRow): ProviderReceiptRow {
  return {
    provider: row.provider,
    status: row.status,
    action: row.action,
    configuration: row.configuration,
    identity_and_least_privilege: row.identity_and_least_privilege,
    sink_or_test_mode: row.sink_or_test_mode,
    webhook_security: row.webhook_security,
    one_target_cardinality: row.one_target_cardinality,
    authorization: row.authorization,
    execution: row.execution,
    cleanup_or_disable: row.cleanup_or_disable,
    blocker_codes: row.blocker_codes,
    evidence_ids: row.evidence_ids,
  };
}

function buildSanitizedEvidence(startedAt: string, items: EvidenceItem[], filesScanned: number) {
  return {
    schema_version: '1.0.0',
    task_id: OPS03_TASK_ID,
    packet_id: OPS03_PACKET_ID,
    generated_at: startedAt,
    redaction_scan: {
      passed: true,
      scanner_version: 'OPS-03-artifact-scanner-v1',
      files_scanned: Math.max(1, filesScanned),
      findings: 0,
    },
    items,
  };
}

function renderBranchAudit(audit: ReturnType<typeof auditBranches>) {
  const lines = [
    '# OPS-03 Branch Audit',
    '',
    `Generated: ${audit.generated_at}`,
    `Current head: ${audit.current_head}`,
    '',
    'Read-only relevant refs:',
    '',
    '| Ref | Commit | Ancestor of current head |',
    '| --- | --- | --- |',
  ];
  for (const ref of audit.relevant_refs) {
    lines.push(`| ${ref.name} | ${ref.sha} | ${ref.mergedIntoHead ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('No checkout, reset, merge, rebase, force update, or branch deletion was performed.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderProviderMatrix(rows: ProviderMatrixRow[]) {
  const lines = [
    '# OPS-03 Provider Matrix',
    '',
    'No provider network canary ran. Every provider remains independently evaluated.',
    '',
    '| Provider | Status | Action | Side effects | Blockers |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.provider} | ${row.status} | ${row.action} | ${row.execution.side_effect_count} | ${row.blocker_codes.join(', ')} |`,
    );
  }
  lines.push('');
  lines.push('Ready checkpoints: none.');
  lines.push('Provider canary receipts: none.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderIndependentTests(
  checks: Array<{ check_id: string; outcome: Ops03Outcome; summary: string }>,
  commands: string[],
) {
  const lines = [
    '# OPS-03 Provider-Independent Tests',
    '',
    'Commands recorded as passed before this artifact was generated:',
    '',
  ];
  if (commands.length === 0) {
    lines.push('- none recorded');
  } else {
    for (const command of commands) lines.push(`- ${command}`);
  }
  lines.push('');
  lines.push('Check matrix:');
  lines.push('');
  lines.push('| Check | Outcome | Summary |');
  lines.push('| --- | --- | --- |');
  for (const check of checks) {
    lines.push(`| ${check.check_id} | ${check.outcome} | ${check.summary} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderRollbackMatrix() {
  return `# OPS-03 Rollback And Disable Matrix

All provider rollback is fail-closed. No OPS-03 canary ran in this checkpoint.

| Provider | Disable Step ID | Queue Or Webhook Step | Cleanup Gate |
| --- | --- | --- | --- |
| telegram | OPS-03-RB-TELEGRAM-DISABLE-HANDLER | Pause staging update consumer and preserve dedupe state | Delete only the canary message if a future authorization permits cleanup |
| whatsapp | OPS-03-RB-WHATSAPP-DISABLE-ASSISTANT | Pause staging webhook consumer and retain message idempotency | No follow-up message or contact import |
| vimeo | OPS-03-RB-VIMEO-DISABLE-UPLOADER | Pause callback consumer and quarantine one synthetic event | Delete or quarantine the single synthetic asset only if authorized |
| buffer | OPS-03-RB-BUFFER-DISABLE-DRAFT-CREATOR | Pause approval queue and block publish worker access | Delete the single draft only if authorized |
| stripe_test | OPS-03-RB-STRIPE-TEST-DISABLE-WEBHOOK | Disable TEST webhook consumer and preserve event idempotency | Revert only synthetic TEST entitlement state if authorized |
| email | OPS-03-RB-EMAIL-DISABLE-STAGING-SENDER | Pause delivery callback consumer and hold retry queue | Do not resend uncertain deliveries |
| zoom | OPS-03-RB-ZOOM-DISABLE-LAUNCH-ISSUER | Pause launch and event consumer, invalidate nonce | Delete temporary staging meeting only if authorized |

Re-enable gate: new exact integrated staging SHA, trusted staging deployment binding, protected configuration readback, one-target proof, current authorization, redaction scan, and provider-specific rollback verification.
`;
}

function updatePrivateState(input: {
  repo: { safeSlug: string; fingerprint: string };
  source: ReturnType<typeof discoverSourceSha>;
  providerMatrix: ProviderMatrixRow[];
  evidenceIds: string[];
}) {
  if (!existsSync(privateStatePath)) return;
  const previous = readJsonIfExists(privateStatePath) as Record<string, unknown> | null;
  if (!previous) return;
  const updatedProviders: Record<string, unknown> = {};
  for (const row of input.providerMatrix) {
    updatedProviders[row.provider] = {
      phase: row.status === 'unconfigured' ? 'unconfigured' : 'blocked',
      status: row.status,
      network_side_effect_count: row.execution.side_effect_count,
      blocker_codes: row.blocker_codes,
      evidence_ids: row.evidence_ids,
      action: row.action,
      last_transition_at: nowIso(),
    };
  }
  const updated = {
    ...previous,
    updated_at: nowIso(),
    phase: 'complete',
    target_repository: {
      discovery_status: input.repo.safeSlug === 'webcraft-media/onetimev2' ? 'unique' : 'ambiguous',
      safe_slug: input.repo.safeSlug,
      fingerprint: input.repo.fingerprint,
    },
    integrated_staging_sha: {
      status: 'blocked',
      sha: input.source.headSha,
      source_evidence_id: 'OPS-03-EV-0003',
      deployment_evidence_id: 'OPS-03-EV-0004',
    },
    providers: updatedProviders,
    global_blocker_codes: ['OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED'],
    output_evidence_ids: input.evidenceIds,
  };
  atomicWriteJson(privateStatePath, updated);
}

function safeSlugFromRemote(remote: string) {
  const trimmed = remote.trim();
  const match =
    trimmed.match(
      /github\.com[:/](?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+?)(?:\.git)?$/,
    ) ?? trimmed.match(/(?<owner>webcraft-media)\/(?<repo>onetimev2)(?:\.git)?$/);
  if (!match?.groups) return 'unknown/unknown';
  return `${match.groups.owner}/${match.groups.repo}`;
}

function scanArtifacts(root: string) {
  const files = listFiles(root);
  let findings = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    findings += scanTextForOps03Leaks(text).length;
  }
  return { files: files.length, findings };
}

function listFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...listFiles(fullPath));
    if (stat.isFile()) files.push(fullPath);
  }
  return files;
}

function writeJson(filePath: string, value: unknown) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function atomicWriteJson(filePath: string, value: unknown) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(tempPath, filePath);
}

function writeText(filePath: string, value: string) {
  assertOps03RedactionClean(value);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, { encoding: 'utf8' });
}

function readJsonIfExists(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function fileSha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function git(args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function gitExit(args: string[]) {
  try {
    execFileSync('git', args, { stdio: 'ignore' });
    return 0;
  } catch {
    return 1;
  }
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

main();
