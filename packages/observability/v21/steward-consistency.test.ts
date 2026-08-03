import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { load } = require('js-yaml') as {
  load: (source: string, options: { json: boolean }) => unknown;
};

interface InterfaceCheckpoint {
  interface_implementation_head_sha: string;
  contract_digest: string;
  semantic_contract_version: string;
}

interface StewardRequest {
  request_id: string;
  interface_contract: {
    checkpoint_path: string;
    interface_implementation_head_sha: string;
    semantic_contract_version: string;
    contract_digest: string;
  };
}

const CHECKPOINT_PATH = 'ops/v2.1-execution/runtime/P33/INTERFACE-CHECKPOINT.yaml';
const STEWARD_PATHS = [
  'ops/v2.1-execution/runtime/P33/steward-requests/P33-registration-001.yaml',
  'ops/v2.1-execution/runtime/P33/steward-requests/P33-config-001.yaml',
  'ops/v2.1-execution/runtime/P33/steward-requests/P33-deploy-001.yaml',
] as const;

describe('P33 steward request interface consistency', () => {
  it.each(STEWARD_PATHS)('%s pins the active corrected checkpoint', (path) => {
    const checkpoint = readYaml<InterfaceCheckpoint>(CHECKPOINT_PATH);
    const request = readYaml<StewardRequest>(path);
    expect(request.interface_contract).toEqual({
      checkpoint_path: CHECKPOINT_PATH,
      interface_implementation_head_sha: checkpoint.interface_implementation_head_sha,
      semantic_contract_version: checkpoint.semantic_contract_version,
      contract_digest: checkpoint.contract_digest,
    });
    expect(readFileSync(path, 'utf8')).not.toContain(
      'd643626af5b5ba4c6fbdd158b2e418c9f5f88123285b67595610a2e49b0b79b6',
    );
  });
});

function readYaml<T>(path: string): T {
  return load(readFileSync(path, 'utf8'), { json: true }) as T;
}
