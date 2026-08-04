import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sqlPath = resolve(
  'packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.sql',
);
const typeScriptPath = resolve(
  'packages/db/src/audience-reconciliation/governed-campaign-decision-store.proposal.ts',
);

const sql = readFileSync(sqlPath, 'utf8');
const typeScript = readFileSync(typeScriptPath, 'utf8');
const combined = `${sql}\n${typeScript}`;

const required = [
  [
    'design-only SQL location',
    !sqlPath.includes('/migrations/') && !sqlPath.includes('\\migrations\\'),
  ],
  [
    'explicit non-application guard',
    sql.includes('must not be applied, registered, or assigned a migration number'),
  ],
  [
    'campaign-bound provider identifiers',
    [
      'provider_location_id',
      'provider_campaign_id',
      'provider_workflow_id',
      'provider_launch_tag_id',
    ].every((token) => sql.includes(token)),
  ],
  [
    'immutable version columns',
    ['decision_version', 'superseded_at'].every((token) => sql.includes(token)),
  ],
  ['single-current-version constraint', sql.includes('WHERE superseded_at IS NULL')],
  [
    'idempotency and request/snapshot hashes',
    ['idempotency_key', 'request_hash', 'snapshot_hash'].every((token) => sql.includes(token)),
  ],
  ['sanitized source facts', sql.includes('source_facts') && typeScript.includes('PII-bearing')],
  ['hard effect ceiling input', typeScript.includes('maximumAffectedRows: number')],
  ['campaign-scoped advisory lock', typeScript.includes('campaign-scoped advisory')],
  ['one-transaction semantics', typeScript.includes('Begin one database transaction')],
  [
    'exact in-transaction readback',
    typeScript.includes('Read the current projection back in the same transaction'),
  ],
  [
    'rollback on mismatch or unknown',
    typeScript.includes('Roll back on every mismatch or unknown result'),
  ],
  ['zero provider-effect result contract', typeScript.includes('providerEffects: 0')],
  ['explicit no-raw-PII result contract', typeScript.includes('rawContactPiiIncluded: false')],
];

const forbidden = [
  ['email-address literal', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['numbered migration allocation', /migration\s+\d{3,}/i],
  [
    'runtime export or import',
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
  proposalFiles: [sqlPath, typeScriptPath],
  runtimeRegistrationEffects: 0,
  databaseEffects: 0,
  providerEffects: 0,
  sendEffects: 0,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
