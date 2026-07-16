#!/usr/bin/env node
/**
 * OPS-08 read-only inventory, probe, fingerprint, and validation toolkit.
 * Node.js 24+, no external dependencies.
 *
 * This tool never changes DNS, Railway, provider, mailbox, or application state.
 * It stores DNS RDATA as SHA-256 digests by default.
 */

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  TASK_ID,
  PACKET_ID,
  usage,
  parseArgs,
  sha256,
  stableJson,
  atomicWrite,
  walkFiles,
  now,
  assertNoSecrets,
  requireTaskPacket,
  commandFingerprint,
} from './OPS-08-toolkit-core.mjs';
import { commandDns } from './OPS-08-toolkit-dns.mjs';
import { commandProbe } from './OPS-08-toolkit-probe.mjs';
import {
  validateInventory,
  validateAuthorization,
  validateChangeManifest,
  validateCrossDocuments,
} from './OPS-08-toolkit-validation.mjs';

async function commandValidate(args) {
  if (!args.inventory) throw new Error('validate requires --inventory');

  let authorization = null;
  let authorizationText = null;
  if (args.authorization) {
    authorizationText = await readFile(args.authorization, 'utf8');
    assertNoSecrets(authorizationText, args.authorization);
    authorization = JSON.parse(authorizationText);
    validateAuthorization(authorization);
  }

  const inventoryText = await readFile(args.inventory, 'utf8');
  assertNoSecrets(inventoryText, args.inventory);
  validateInventory(JSON.parse(inventoryText), authorization);

  if (args['change-manifest']) {
    const text = await readFile(args['change-manifest'], 'utf8');
    assertNoSecrets(text, args['change-manifest']);
    const manifest = JSON.parse(text);
    validateChangeManifest(manifest, authorization);
    if (authorization) validateCrossDocuments(authorization, authorizationText, manifest);
  }

  process.stdout.write(`${TASK_ID} validation: PASS\n`);
}

async function commandInitState(args) {
  if (!args.root || !args['packet-root']) {
    throw new Error('init-state requires --root and --packet-root');
  }
  const statePath = path.join(args.root, 'ops/codex-runs/OPS-08/state.json');
  const commandLogPath = path.join(args.root, 'ops/codex-runs/OPS-08/command-log.ndjson');
  const evidenceIndexPath = path.join(args.root, 'ops/evidence/ops-08/index.json');
  let exists = false;
  try {
    await readFile(statePath, 'utf8');
    exists = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (exists) throw new Error(`state already exists: ${statePath}`);

  const startedAt = now();
  let packetManifestSha256 = null;
  let packetChecksumsSha256 = null;
  let packetMaterialError = null;
  try {
    packetManifestSha256 = sha256(
      await readFile(path.join(args['packet-root'], 'OPS-08-PACKET-MANIFEST.json')),
    );
    packetChecksumsSha256 = sha256(
      await readFile(path.join(args['packet-root'], 'CHECKSUMS.sha256')),
    );
  } catch (error) {
    packetMaterialError = String(error?.message ?? error);
  }

  const state = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    phase: 'state_persisted',
    status: packetMaterialError ? 'blocked_packet_integrity' : 'audit_in_progress',
    packet_integrity_status: packetMaterialError ? 'missing_packet_material' : 'unverified',
    packet_manifest_sha256: packetManifestSha256,
    packet_checksums_sha256: packetChecksumsSha256,
    cutover_authorized: false,
    root_dns_mutation_authorized: false,
    launch_domain_mutation_authorized: false,
    production_deployment_authorized: false,
    production_provider_mutation_authorized: false,
    email_dns_mutation_authorized: false,
    real_send_authorized: false,
    selected_source_sha: null,
    mutation_count: 0,
    created_at: startedAt,
    updated_at: now(),
    command_log_path: 'ops/codex-runs/OPS-08/command-log.ndjson',
    evidence_index_path: 'ops/evidence/ops-08/index.json',
    resume_instruction: 'Resume OPS-08 from the recorded phase; do not repeat an external action.',
  };
  const stateText = stableJson(state);
  await atomicWrite(statePath, stateText);

  const evidenceIndex = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    created_at: state.created_at,
    updated_at: state.updated_at,
    state_path: 'ops/codex-runs/OPS-08/state.json',
    command_log_path: state.command_log_path,
    entries: [],
    raw_secret_values_embedded: false,
  };
  await atomicWrite(evidenceIndexPath, stableJson(evidenceIndex));
  await mkdir(path.join(args.root, 'ops/release/ops-08'), { recursive: true });

  const logEntry = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    phase: 'state_persisted',
    command: 'OPS-08-toolkit init-state',
    started_at: startedAt,
    ended_at: now(),
    exit_code: packetMaterialError ? 1 : 0,
    output_sha256: sha256(stateText),
    redacted: true,
  };
  await atomicWrite(commandLogPath, `${JSON.stringify(logEntry)}\n`);

  if (packetMaterialError) {
    throw new Error(`state persisted but packet material is unavailable: ${packetMaterialError}`);
  }
  process.stdout.write(`${TASK_ID} state initialized: ${statePath}\n`);
}

async function commandVerifyChecksums(args) {
  if (!args.root) throw new Error('verify-checksums requires --root');
  const checksumPath = path.join(args.root, 'CHECKSUMS.sha256');
  const manifestPath = path.join(args.root, 'OPS-08-PACKET-MANIFEST.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  requireTaskPacket(manifest, 'packet manifest');

  const lines = (await readFile(checksumPath, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const failures = [];
  const listed = new Set();
  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) {
      failures.push({ line, reason: 'malformed' });
      continue;
    }
    const [, expected, relative] = match;
    const pathParts = relative.split('/');
    if (path.isAbsolute(relative) || relative.includes('\\') || pathParts.includes('..')) {
      failures.push({ relative, reason: 'unsafe_path' });
      continue;
    }
    if (relative === 'CHECKSUMS.sha256') {
      failures.push({ relative, reason: 'checksum_file_must_not_hash_itself' });
      continue;
    }
    if (listed.has(relative)) {
      failures.push({ relative, reason: 'duplicate_path' });
      continue;
    }
    listed.add(relative);
    try {
      const data = await readFile(path.join(args.root, relative));
      const observed = sha256(data);
      if (observed !== expected) failures.push({ relative, expected, observed });
    } catch (error) {
      failures.push({ relative, reason: String(error?.message ?? error) });
    }
  }

  const manifestFiles = [...manifest.files].sort();
  for (const relative of manifestFiles) {
    const pathParts = relative.split('/');
    if (path.isAbsolute(relative) || relative.includes('\\') || pathParts.includes('..')) {
      failures.push({ relative, reason: 'unsafe_manifest_path' });
    }
  }
  if (manifest.file_count_including_checksums !== manifestFiles.length) {
    failures.push({ reason: 'manifest_file_count_mismatch' });
  }
  const expectedChecksumPaths = manifestFiles.filter((relative) => relative !== 'CHECKSUMS.sha256');
  if (JSON.stringify([...listed].sort()) !== JSON.stringify(expectedChecksumPaths)) {
    failures.push({
      reason: 'checksum_path_set_mismatch',
      expected: expectedChecksumPaths,
      observed: [...listed].sort(),
    });
  }
  const actualFiles = await walkFiles(args.root);
  if (JSON.stringify(actualFiles) !== JSON.stringify(manifestFiles)) {
    failures.push({ reason: 'packet_file_set_mismatch', expected: manifestFiles, observed: actualFiles });
  }

  if (failures.length) throw new Error(`checksum failures: ${JSON.stringify(failures)}`);
  process.stdout.write(`${TASK_ID} checksums: PASS (${lines.length} files)\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command) {
    usage();
    process.exitCode = 2;
    return;
  }
  if (args.command === 'init-state') return commandInitState(args);
  if (args.command === 'dns') return commandDns(args);
  if (args.command === 'probe') return commandProbe(args);
  if (args.command === 'fingerprint') return commandFingerprint(args);
  if (args.command === 'validate') return commandValidate(args);
  if (args.command === 'verify-checksums') return commandVerifyChecksums(args);
  usage();
  throw new Error(`Unknown command: ${args.command}`);
}

main().catch((error) => {
  process.stderr.write(`${TASK_ID} ERROR: ${String(error?.stack ?? error)}\n`);
  process.exitCode = 1;
});
