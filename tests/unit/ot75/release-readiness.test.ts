import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readJson<T = Record<string, unknown>>(filePath: string): T {
  return JSON.parse(readFileSync(path.resolve(root, filePath), 'utf8')) as T;
}

describe('OT-75 release readiness contract', () => {
  const contract = readJson<{
    task: Record<string, string>;
    mutation_policy: Record<string, boolean>;
    ownership: { forbidden_runtime_paths: string[]; allowed_path_prefixes: string[] };
    contracts: Record<string, string>;
    deployment_descriptors: string[];
    required_gate_ids: string[];
  }>('ops/release/ot75/release-readiness.contract.json');

  it('pins the requested repository, base, branch, and mutation policy', () => {
    expect(contract.task.repository).toBe('webcraft-media/onetimev2');
    expect(contract.task.immutable_base_sha).toBe('dfef7de2035e08f1ee72e0133ccf656fe7a74444');
    expect(contract.task.branch).toBe('codex/ot75-release-observability-readiness');
    expect(Object.values(contract.mutation_policy).every((allowed) => allowed === false)).toBe(
      true,
    );
  });

  it('keeps runtime composition out of OT-75 scope', () => {
    expect(contract.ownership.forbidden_runtime_paths).toContain('apps/web/src/server/app.ts');
    expect(contract.ownership.forbidden_runtime_paths).toContain('package.json');
    expect(contract.ownership.allowed_path_prefixes).toContain('scripts/ot75/');
  });

  it('models the known release blockers as machine-checkable gates', () => {
    const gates = readJson<{ gates: Array<{ id: string; machine_check: { type: string } }> }>(
      'ops/release/ot75/predeploy-gates.json',
    );
    const gateIds = new Set(gates.gates.map((gate) => gate.id));
    for (const id of contract.required_gate_ids) {
      expect(gateIds.has(id), `${id} is present`).toBe(true);
    }
    expect(gates.gates.every((gate) => Boolean(gate.machine_check.type))).toBe(true);
  });

  it('keeps descriptors and referenced contracts present', () => {
    for (const filePath of Object.values(contract.contracts)) {
      expect(existsSync(path.resolve(root, filePath)), `${filePath} exists`).toBe(true);
    }
    for (const filePath of contract.deployment_descriptors) {
      expect(existsSync(path.resolve(root, filePath)), `${filePath} exists`).toBe(true);
    }
  });

  it('keeps the OT-75 workflow static-validation only', () => {
    const workflow = readFileSync(
      path.resolve(root, '.github/workflows/ot75-release-readiness.yml'),
      'utf8',
    );
    expect(workflow).toContain('node scripts/ot75/validate-release-readiness.mjs');
    expect(workflow).not.toMatch(/\brailway\s+(up|deploy|variables|env|run)\b/i);
    expect(workflow).not.toMatch(/\bnpm\s+run\s+db:migrate\b/i);
    expect(workflow).not.toMatch(/\bpsql\s+/i);
  });
});
