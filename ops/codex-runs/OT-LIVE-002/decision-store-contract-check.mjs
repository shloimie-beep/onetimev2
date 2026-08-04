import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sqlPath = resolve(
  'packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.sql',
);
const typeScriptPath = resolve(
  'packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.ts',
);
const requestPath = resolve('ops/codex-runs/OT-LIVE-002/MIGRATION-REQUEST.yaml');

const sql = readFileSync(sqlPath, 'utf8');
const typeScript = readFileSync(typeScriptPath, 'utf8');
const request = readFileSync(requestPath, 'utf8');
const combined = `${sql}\n${typeScript}\n${request}`;

const exactProviderIds = [
  'pBSnOK2nkdxp6gf9Rg3o',
  '6a71a64c28f7a5dbb3aec1be',
  '09051378-5917-4172-afda-f425619dd23d',
  'IcOGsLgSIOYGFlHF4kQ0',
];
const requirementIds = [
  'OTV2-GHL-135',
  'OTV2-GHL-137',
  'OTV2-GHL-138',
  'OTV2-EMAIL-145',
  'OTV2-PROVIDER-231',
];
const forbiddenFactTokens = [
  'free_form_note',
  'message_body',
  'transcript',
  'student_record',
  'credential',
  'cookie',
  'token',
  'secret',
  'raw_provider_contact_reference',
  'private_provider_field',
];

const required = [
  [
    'design-only SQL location',
    !sqlPath.includes('/migrations/') && !sqlPath.includes('\\migrations\\'),
  ],
  [
    'explicit requested-not-allocated guard',
    combined.includes('REQUESTED_NOT_ALLOCATED') &&
      request.includes('allocation_status: requested_not_allocated'),
  ],
  ['F02-only allocation guard', combined.includes('F02 is the only semantic allocator')],
  [
    'runtime and verification dimensions',
    ['runtime_tier', 'verification_environment_id'].every((token) => sql.includes(token)) &&
      ['runtimeTier', 'verificationEnvironmentId'].every((token) => typeScript.includes(token)),
  ],
  [
    'runtime dimensions bind keys indexes and current projection',
    sql.match(/runtime_tier/g)?.length >= 6 &&
      sql.match(/verification_environment_id/g)?.length >= 6,
  ],
  [
    'runtime dimensions bind advisory lock and request hash',
    typeScript.includes('advisory lock over') &&
      typeScript.includes('Canonicalize runtimeTier, verificationEnvironmentId'),
  ],
  [
    'exact campaign provider identifiers',
    exactProviderIds.every((value) => sql.includes(value) && typeScript.includes(value)),
  ],
  [
    'protected provider contact hash only',
    sql.includes('provider_contact_ref_hash') &&
      typeScript.includes('providerContactRefHash') &&
      !sql.includes('provider_contact_id') &&
      !typeScript.includes('providerContactId'),
  ],
  [
    'append-only version and current projection',
    ['decision_version', 'superseded_at', 'WHERE superseded_at IS NULL'].every((token) =>
      sql.includes(token),
    ),
  ],
  [
    'database immutability guard',
    sql.includes('guard_governed_campaign_audience_decision_immutability') &&
      sql.includes('only a one-way NULL-to-timestamp supersession is allowed'),
  ],
  [
    'idempotency request and snapshot hashes',
    ['idempotency_key', 'request_hash', 'snapshot_hash'].every((token) => sql.includes(token)),
  ],
  [
    'typed sanitized source facts',
    typeScript.includes('GovernedCampaignSanitizedSourceFacts') &&
      typeScript.includes('Exact allowlist: no arbitrary keys'),
  ],
  [
    'forbidden fact boundary',
    forbiddenFactTokens.every(
      (token) => typeScript.includes(`'${token}'`) && request.includes(`- ${token}`),
    ),
  ],
  ['hard effect ceiling', typeScript.includes('maximumAffectedRows: number')],
  ['one-transaction semantics', typeScript.includes('Begin one database transaction')],
  [
    'exact in-transaction readback',
    typeScript.includes('Read the current projection back in the transaction'),
  ],
  [
    'rollback on mismatch or unknown',
    typeScript.includes('roll back on mismatch or unknown result'),
  ],
  [
    'zero external effect contract',
    ['contactEffects: 0', 'providerEffects: 0', 'sendEffects: 0'].every((token) =>
      typeScript.includes(token),
    ),
  ],
  [
    'zero raw identity and Student record result contract',
    [
      'rawContactPiiIncluded: false',
      'rawProviderContactIdentifiersIncluded: false',
      'studentRecordsIncluded: false',
    ].every((token) => typeScript.includes(token)),
  ],
  [
    'bound acceptance requirements',
    requirementIds.every((value) => typeScript.includes(value) && request.includes(value)),
  ],
  [
    'zero schema-time backfill',
    sql.includes('zero schema-time backfill') && request.includes('schema_time_backfill_rows: 0'),
  ],
  [
    'PostgreSQL 18 and pg-mem proof request',
    request.includes('postgresql_18') && request.includes('pg_mem'),
  ],
  [
    'fresh replay append-only isolation readback rollback proofs',
    [
      'fresh_apply',
      'ledger_replay',
      'append_only',
      'environment_isolation',
      'readback',
      'rollback',
    ].every((token) => request.includes(token)),
  ],
  [
    'exact five-path scope',
    request.includes('exact_path_count: 5') &&
      request.includes('ops/codex-runs/OT-LIVE-002/MIGRATION-REQUEST.yaml'),
  ],
];

const forbidden = [
  ['email-address literal', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['allocated migration claim', /allocation_status:\s*(?:allocated|integrated)\b/i],
  [
    'runtime export or registration',
    /^\s*(?:export\s+\{[^}]*\}|import\s+.*governed-campaign-decision-store)/m,
  ],
  ['executable row mutation statement', /^\s*(?:INSERT INTO|UPDATE\s+|DELETE FROM)\b/im],
];

const failures = required.filter(([, passed]) => !passed).map(([name]) => name);
for (const [name, pattern] of forbidden) {
  if (pattern.test(combined)) failures.push(`forbidden ${name}`);
}

const result = {
  verdict: failures.length === 0 ? 'PASS' : 'FAIL',
  checks: required.length + forbidden.length,
  failures,
  proposalFiles: [sqlPath, typeScriptPath, requestPath],
  requestedMigrationId: 'OT-LIVE-002-MIGRATION-001',
  requestedOrdinal: 2260,
  allocationStatus: 'requested_not_allocated',
  runtimeRegistrationEffects: 0,
  schemaTimeBackfillRows: 0,
  databaseEffects: 0,
  contactEffects: 0,
  providerEffects: 0,
  sendEffects: 0,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
