import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAwsParentWelcomeObjectStore,
  createPrivateParentWelcomeResultSink,
  createProductionParentWelcomeMediaProbe,
  createPostgresParentWelcomeBindingRepository,
  parentWelcomeAuthorizationBindingSha256,
  runParentWelcomeVideoBinding,
  type ParentWelcomeAuthorizationClaim,
  type ParentWelcomeBindingPlan,
  type ParentWelcomeBindingRepository,
  type ParentWelcomeMediaProbe,
  type ParentWelcomeObjectInspection,
  type ParentWelcomeObjectStore,
  type ParentWelcomePrivateResultSink,
} from '../../../scripts/operations/parent-welcome-video-binding.ts';

const NOW = new Date('2026-08-16T09:30:00.000Z');
const AUTHORIZATION = 'synthetic one-use authorization';
const SECOND_AUTHORIZATION = 'synthetic second one-use authorization';
const RUNTIME_SHA = 'a'.repeat(40);
const SOURCE = Buffer.from('synthetic parent welcome source media');
const MEDIA = Buffer.from('synthetic parent welcome media');
const CAPTIONS = Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nWelcome, parents.\n');
const POSTER = Buffer.from('synthetic parent welcome poster');

let privateRoot: string | undefined;

afterEach(async () => {
  if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
  privateRoot = undefined;
});

describe('Parent welcome video governed binding operation', () => {
  it('defaults to a read-only dry run and returns no private material', async () => {
    const harness = await createHarness();
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('dry_run_planned');
    expect(report.apply).toBe(false);
    expect(harness.objectStore.putCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expect(report.effects).toEqual({
      s3_objects_created: 0,
      s3_objects_removed_during_rollback: 0,
      database_transaction_committed: false,
      non_storage_provider_mutations: 0,
      email_sends: 0,
      customer_messages: 0,
    });
    expectSanitized(report, harness);
  });

  it('refuses apply without the invocation-scoped ephemeral authorization', async () => {
    const harness = await createHarness();
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('ephemeral_authorization_missing');
    expect(harness.objectStore.putCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expectSanitized(report, harness);
  });

  it('uploads each exact object once and commits one atomic binding', async () => {
    const harness = await createHarness();
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('applied');
    expect(harness.objectStore.putCalls).toBe(3);
    expect(harness.objectStore.readbackCalls).toBeGreaterThanOrEqual(3);
    expect(harness.repository.applyCalls).toBe(1);
    expect(harness.repository.lastPlan?.assets).toHaveLength(3);
    expect(harness.repository.lastPlan?.processingArtifacts).toHaveLength(7);
    expect(
      harness.repository.lastPlan?.processingArtifacts.find(
        ({ kind }) => kind === 'compressed_video',
      )?.payload,
    ).toMatchObject({
      profileVersion: 'OT-PARENT-WELCOME-EXISTING-VIDEO-1',
      audioSampleRateHz: 44_100,
      sourceMetadataRemoved: true,
    });
    expect(
      (
        harness.repository.lastPlan?.processingVersion.transcodePlan as {
          profile: { audioSampleRateHz: number };
        }
      ).profile.audioSampleRateHz,
    ).toBe(44_100);
    expect(report.effects).toMatchObject({
      s3_objects_created: 3,
      database_transaction_committed: true,
      non_storage_provider_mutations: 0,
      email_sends: 0,
      customer_messages: 0,
    });
    expectSanitized(report, harness);
  });

  it('reconciles an exact replay without creating another object or database row', async () => {
    const harness = await createHarness();
    const first = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });
    const second = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: new Date('2026-08-16T09:31:00.000Z'),
    });

    expect(first.status).toBe('applied');
    expect(second.status).toBe('already_applied');
    expect(harness.objectStore.putCalls).toBe(3);
    expect(harness.repository.applyCalls).toBe(1);
    expect(second.effects.s3_objects_created).toBe(0);
    expectSanitized(second, harness);
  });

  it('stops on an ambiguous object inventory without uploading or touching the database', async () => {
    const harness = await createHarness();
    harness.objectStore.forceAmbiguous = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('s3_object_inventory_ambiguous');
    expect(harness.objectStore.putCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expectSanitized(report, harness);
  });

  it('removes only newly created exact versions when the database transaction fails', async () => {
    const harness = await createHarness();
    harness.repository.failApply = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('database_transaction_failed');
    expect(harness.objectStore.putCalls).toBe(3);
    expect(harness.objectStore.deleteCalls).toBe(3);
    expect(harness.objectStore.objectCount()).toBe(0);
    expect(harness.repository.committedPlan).toBeUndefined();
    expect(report.effects).toMatchObject({
      s3_objects_created: 3,
      s3_objects_removed_during_rollback: 3,
      database_transaction_committed: false,
    });
    expectSanitized(report, harness);
  });

  it('preserves uploaded versions when a database commit attempt is ambiguous', async () => {
    const harness = await createHarness();
    harness.repository.throwApplyAmbiguous = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('acceptance_unknown');
    expect(report.blockers).toContain('database_commit_acceptance_unknown');
    expect(harness.repository.applyCalls).toBe(1);
    expect(harness.objectStore.putCalls).toBe(3);
    expect(harness.objectStore.deleteCalls).toBe(0);
    expect(harness.objectStore.objectCount()).toBe(3);
    expectSanitized(report, harness);
  });

  it('removes a known-created version when its immediate readback mismatches', async () => {
    const harness = await createHarness();
    harness.objectStore.forceMismatchAfterPut = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('s3_upload_readback_mismatch');
    expect(harness.objectStore.putCalls).toBe(1);
    expect(harness.objectStore.deleteCalls).toBe(1);
    expect(harness.objectStore.objectCount()).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expect(report.effects).toMatchObject({
      s3_objects_created: 1,
      s3_objects_removed_during_rollback: 1,
      database_transaction_committed: false,
    });
    expectSanitized(report, harness);
  });

  it('does not retry or delete an upload whose acceptance is ambiguous', async () => {
    const harness = await createHarness();
    harness.objectStore.throwAfterPut = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('acceptance_unknown');
    expect(report.blockers).toContain('s3_upload_acceptance_unknown');
    expect(harness.objectStore.putCalls).toBe(1);
    expect(harness.objectStore.deleteCalls).toBe(0);
    expect(harness.objectStore.objectCount()).toBe(1);
    expect(harness.repository.applyCalls).toBe(0);
    expectSanitized(report, harness);
  });

  it('rejects a local hash mismatch before any external effect', async () => {
    const harness = await createHarness();
    harness.manifest.assets.poster.sha256 = sha('not the poster');
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('local_asset_readback_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.objectStore.putCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expectSanitized(report, harness);
  });

  it('rejects approved public text that contains a private source locator', async () => {
    const harness = await createHarness();
    harness.manifest.presentation.title = `Welcome ${harness.manifest.drive_source.file_identity}`;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('approved_public_text_contains_private_material');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.objectStore.putCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expectSanitized(report, harness);
  });

  it('fails closed when account, tier, environment, or runtime source differs', async () => {
    const harness = await createHarness();
    harness.runtime.verificationEnvironmentId = 'different-environment';
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('runtime_scope_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expectSanitized(report, harness);
  });

  it('requires the runtime write gate in addition to the one-use authorization', async () => {
    const harness = await createHarness();
    harness.runtime.writesAllowed = false;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('runtime_writes_not_allowed');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.objectStore.putCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
    expectSanitized(report, harness);
  });

  it('serializes an exact concurrent replay without consuming or applying twice', async () => {
    const harness = await createHarness();
    harness.repository.holdNextClaim();
    const invoke = () =>
      runParentWelcomeVideoBinding({
        manifest: harness.manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: harness.resultSink,
        now: NOW,
      });

    const firstPromise = invoke();
    await harness.repository.waitUntilClaimed();
    const secondPromise = invoke();
    harness.repository.releaseClaim();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    const reports = [first, second];

    expect(reports.map(({ status }) => status).sort()).toEqual(['already_applied', 'applied']);
    expect(harness.repository.consumeCalls).toBe(2);
    expect(harness.repository.applyCalls).toBe(1);
    expect(harness.objectStore.putCalls).toBe(3);
  });

  it('serializes distinct authorized manifests before storage and never deletes committed versions', async () => {
    const harness = await createHarness();
    const secondManifest = structuredClone(harness.manifest);
    secondManifest.operation_id = `pwb_${'2'.repeat(32)}`;
    secondManifest.authorization_phrase_sha256 = sha(SECOND_AUTHORIZATION);
    secondManifest.presentation.title = 'A second safe Parent welcome title';
    secondManifest.authorization_binding_sha256 = parentWelcomeAuthorizationBindingSha256(
      secondManifest,
      SECOND_AUTHORIZATION,
    );
    harness.objectStore.holdNextPut();

    const firstPromise = runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });
    await harness.objectStore.waitUntilPutStarted();
    const secondPromise = runParentWelcomeVideoBinding({
      manifest: secondManifest,
      apply: true,
      authorizationPhrase: SECOND_AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: new MemoryResultSink(),
      now: NOW,
    });
    harness.objectStore.releasePut();
    const reports = await Promise.all([firstPromise, secondPromise]);

    expect(reports.map(({ status }) => status).sort()).toEqual(['applied', 'blocked']);
    expect(harness.repository.consumeCalls).toBe(2);
    expect(harness.repository.applyCalls).toBe(1);
    expect(harness.objectStore.putCalls).toBe(3);
    expect(harness.objectStore.deleteCalls).toBe(0);
    expect(harness.objectStore.objectCount()).toBe(3);
    for (const asset of harness.repository.committedPlan!.assets) {
      expect(harness.objectStore.hasExactVersion(asset.objectKey, asset.objectVersionId)).toBe(
        true,
      );
    }
  });

  it('does not reuse a consumed phrase for a different manifest', async () => {
    const harness = await createHarness();
    const first = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });
    harness.manifest.operation_id = `pwb_${'2'.repeat(32)}`;
    harness.manifest.authorization_binding_sha256 = parentWelcomeAuthorizationBindingSha256(
      harness.manifest,
      AUTHORIZATION,
    );
    const second = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(first.status).toBe('applied');
    expect(second.status).toBe('blocked');
    expect(second.blockers).toContain('authorization_manifest_conflict');
    expect(harness.repository.applyCalls).toBe(1);
    expect(harness.objectStore.putCalls).toBe(3);
  });

  it('treats a thrown authorization claim as unknown and never retries into storage', async () => {
    const harness = await createHarness();
    harness.repository.throwAfterConsume = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('acceptance_unknown');
    expect(report.blockers).toContain('authorization_claim_acceptance_unknown');
    expect(harness.repository.consumeCalls).toBe(1);
    expect(harness.objectStore.putCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
  });

  it('binds authorization to the exact manifest before any upload', async () => {
    const harness = await createHarness();
    harness.manifest.presentation.title = 'Changed safe title';
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('authorization_manifest_binding_mismatch');
    expect(harness.repository.consumeCalls).toBe(0);
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.objectStore.putCalls).toBe(0);
  });

  it('rejects arbitrary, name-like, Drive-like, and hash-like operation identifiers', async () => {
    const harness = await createHarness();
    for (const rejected of [
      'parent-welcome-approved',
      '1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      'a'.repeat(64),
    ]) {
      const manifest = { ...harness.manifest, operation_id: rejected };
      const report = await runParentWelcomeVideoBinding({
        manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: harness.resultSink,
        now: NOW,
      });
      expect(report.status).toBe('blocked');
      expect(report.blockers).toContain('private_manifest_invalid');
      expect(JSON.stringify(report)).not.toContain(rejected);
    }
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('reserves the private result before any readback or mutation', async () => {
    const harness = await createHarness();
    harness.resultSink.failReserve = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('private_result_sink_reservation_failed');
    expect(report.safety.result_sink_reserved_before_effects).toBe(false);
    expect(harness.mediaProbe.mediaCalls).toBe(0);
    expect(harness.mediaProbe.posterCalls).toBe(0);
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
    expect(harness.repository.applyCalls).toBe(0);
  });

  it('classifies a post-effect result failure as unknown and only reconciles read-only', async () => {
    const harness = await createHarness();
    harness.resultSink.failFinalize = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('acceptance_unknown');
    expect(report.blockers).toContain('private_result_finalize_acceptance_unknown');
    expect(harness.repository.reconcileCommittedCalls).toBe(1);
    expect(harness.repository.applyCalls).toBe(1);
    expect(harness.objectStore.putCalls).toBe(3);
    expect(harness.resultSink.finalizeCalls).toBe(1);
    expectSanitized(report, harness);
  });

  it('rejects a mismatched private Drive source before probing or external reads', async () => {
    const harness = await createHarness();
    harness.manifest.drive_source.sha256 = sha('different source bytes');
    harness.manifest.authorization_binding_sha256 = parentWelcomeAuthorizationBindingSha256(
      harness.manifest,
      AUTHORIZATION,
    );
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('private_source_readback_mismatch');
    expect(harness.mediaProbe.mediaCalls).toBe(0);
    expect(harness.mediaProbe.posterCalls).toBe(0);
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('accepts the distinct approved 832x464 source and exact 832x468 derivative', async () => {
    const harness = await createHarness();
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('dry_run_planned');
    expect(harness.mediaProbe.mediaCalls).toBe(2);
    expect(harness.objectStore.policyChecks).toBe(1);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects false approved-source facts before database or storage access', async () => {
    const harness = await createHarness();
    for (const falseFact of [
      'falseSourceWidth',
      'falseSourceDuration',
      'falseSourceCodec',
      'wrongSourceAudioRate',
    ] as const) {
      harness.mediaProbe.falseSourceWidth = false;
      harness.mediaProbe.falseSourceDuration = false;
      harness.mediaProbe.falseSourceCodec = false;
      harness.mediaProbe.wrongSourceAudioRate = false;
      harness.mediaProbe[falseFact] = true;
      const report = await runParentWelcomeVideoBinding({
        manifest: harness.manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: harness.resultSink,
        now: NOW,
      });

      expect(report.status).toBe('blocked');
      expect(report.blockers).toContain('private_source_probe_evidence_mismatch');
    }
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects a broken approved source before database or storage access', async () => {
    const harness = await createHarness();
    harness.mediaProbe.failSource = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('media_probe_failed');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects swapped source and derivative probe evidence before effects', async () => {
    const harness = await createHarness();
    harness.mediaProbe.swapSourceAndDerivative = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('media_probe_evidence_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects false probed media metadata before database or storage access', async () => {
    const harness = await createHarness();
    harness.mediaProbe.falseWidth = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('media_probe_evidence_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('accepts the exact 44.1-kHz audio and rejects a probed 48-kHz mismatch', async () => {
    const accepted = await createHarness();
    const acceptedReport = await runParentWelcomeVideoBinding({
      manifest: accepted.manifest,
      runtime: accepted.runtime,
      objectStore: accepted.objectStore,
      repository: accepted.repository,
      mediaProbe: accepted.mediaProbe,
      resultSink: accepted.resultSink,
      now: NOW,
    });
    expect(acceptedReport.status).toBe('dry_run_planned');

    accepted.mediaProbe.wrongAudioRate = true;
    const rejectedReport = await runParentWelcomeVideoBinding({
      manifest: accepted.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: accepted.runtime,
      objectStore: accepted.objectStore,
      repository: accepted.repository,
      mediaProbe: accepted.mediaProbe,
      resultSink: accepted.resultSink,
      now: NOW,
    });
    expect(rejectedReport.status).toBe('blocked');
    expect(rejectedReport.blockers).toContain('media_probe_evidence_mismatch');
    expect(accepted.objectStore.policyChecks).toBe(1);
    expect(accepted.repository.consumeCalls).toBe(0);
  });

  it('rejects false decoded poster dimensions before database or storage access', async () => {
    const harness = await createHarness();
    harness.mediaProbe.falsePosterWidth = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('poster_probe_evidence_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects unremoved derivative container metadata before database or storage access', async () => {
    const harness = await createHarness();
    harness.mediaProbe.mediaMetadataPresent = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('media_probe_evidence_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects unremoved poster privacy metadata before database or storage access', async () => {
    const harness = await createHarness();
    harness.mediaProbe.posterMetadataPresent = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('poster_probe_evidence_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects rotated media whose effective display is not the approved 16:9', async () => {
    const harness = await createHarness();
    harness.mediaProbe.rotated = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('media_probe_evidence_mismatch');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects private bytes changed during probing before database or storage access', async () => {
    const harness = await createHarness();
    harness.mediaProbe.mutateMediaAfterProbe = true;
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('private_input_changed_during_verification');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects captions with cues beyond the decoded media duration', async () => {
    const harness = await createHarness();
    const invalid = Buffer.from(
      'WEBVTT\n\n00:01:29.500 --> 00:01:30.500\nOutside decoded duration.\n',
    );
    await writeFile(path.join(harness.manifest.private_asset_root, 'approved.vtt'), invalid);
    harness.manifest.assets.captions.sha256 = sha(invalid);
    harness.manifest.assets.captions.byte_count = invalid.byteLength;
    harness.manifest.authorization_binding_sha256 = parentWelcomeAuthorizationBindingSha256(
      harness.manifest,
      AUTHORIZATION,
    );
    const report = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });

    expect(report.status).toBe('blocked');
    expect(report.blockers).toContain('captions_invalid');
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('rejects private values hidden in raw VTT identifiers or markup before effects', async () => {
    const harness = await createHarness();
    for (const raw of [
      Buffer.from(
        `WEBVTT\n\n${harness.manifest.operation_id}\n00:00:00.000 --> 00:00:01.000\nWelcome, parents.\n`,
      ),
      Buffer.from(
        `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<v ${harness.manifest.drive_source.file_identity}>Welcome, parents.</v>\n`,
      ),
      Buffer.from(
        `WEBVTT\n\n${harness.manifest.private_asset_root.replaceAll('\\', '/').toUpperCase()}\n00:00:00.000 --> 00:00:01.000\nWelcome, parents.\n`,
      ),
      Buffer.from(
        'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<v https://drive.google.com/file/d/synthetic-private-id>Welcome, parents.</v>\n',
      ),
    ]) {
      await writeFile(path.join(harness.manifest.private_asset_root, 'approved.vtt'), raw);
      harness.manifest.assets.captions.sha256 = sha(raw);
      harness.manifest.assets.captions.byte_count = raw.byteLength;
      harness.manifest.authorization_binding_sha256 = parentWelcomeAuthorizationBindingSha256(
        harness.manifest,
        AUTHORIZATION,
      );
      const report = await runParentWelcomeVideoBinding({
        manifest: harness.manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: harness.resultSink,
        now: NOW,
      });

      expect(report.status).toBe('blocked');
      expect(report.blockers).toContain('captions_contain_private_material');
    }
    expect(harness.objectStore.policyChecks).toBe(0);
    expect(harness.repository.consumeCalls).toBe(0);
  });

  it('fails closed for Windows, invalid-parent, and unwritable private result sinks', async () => {
    const harness = await createHarness();
    const generatedAt = NOW.toISOString();
    await expect(
      createPrivateParentWelcomeResultSink(
        path.join(harness.manifest.private_asset_root, 'windows.private.json'),
        { platform: 'win32' },
      ).reserve({ generatedAt, apply: true }),
    ).rejects.toThrow();
    await expect(
      createPrivateParentWelcomeResultSink(
        path.join(harness.manifest.private_asset_root, 'missing', 'result.private.json'),
        { platform: 'linux' },
      ).reserve({ generatedAt, apply: true }),
    ).rejects.toThrow();
    await expect(
      createPrivateParentWelcomeResultSink(
        path.join(harness.manifest.private_asset_root, 'unwritable.private.json'),
        {
          platform: 'linux',
          openFile: (async () => {
            throw Object.assign(new Error('synthetic permission denial'), { code: 'EACCES' });
          }) as never,
        },
      ).reserve({ generatedAt, apply: true }),
    ).rejects.toThrow();
  });

  it.runIf(process.platform !== 'win32')(
    'keeps the reserved and finalized result owner-only and sanitized',
    async () => {
      const harness = await createHarness();
      const report = await runParentWelcomeVideoBinding({
        manifest: harness.manifest,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: harness.resultSink,
        now: NOW,
      });
      const resultPath = path.join(
        harness.manifest.private_asset_root,
        'owner-only-result.private.json',
      );
      const sink = createPrivateParentWelcomeResultSink(resultPath);
      await sink.reserve({ generatedAt: NOW.toISOString(), apply: false });
      expect(JSON.parse(await readFile(resultPath, 'utf8')).status).toBe('acceptance_unknown');
      expect((await stat(resultPath)).mode & 0o777).toBe(0o600);
      await sink.finalize(report);
      const finalized = await readFile(resultPath, 'utf8');
      expect(JSON.parse(finalized)).toEqual(report);
      expect((await stat(resultPath)).mode & 0o777).toBe(0o600);
      expectSanitized(JSON.parse(finalized), harness);
    },
  );

  it.runIf(process.platform !== 'win32')(
    'keeps the pessimistic result when a pre-rename durability check fails',
    async () => {
      const harness = await createHarness();
      const report = await runParentWelcomeVideoBinding({
        manifest: harness.manifest,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: harness.resultSink,
        now: NOW,
      });
      const resultPath = path.join(harness.manifest.private_asset_root, 'durable.private.json');
      let parentSyncCalls = 0;
      const sink = createPrivateParentWelcomeResultSink(resultPath, {
        platform: 'linux',
        syncParent: async () => {
          parentSyncCalls += 1;
          if (parentSyncCalls === 2) throw new Error('synthetic pre-rename sync failure');
        },
      });

      await sink.reserve({ generatedAt: NOW.toISOString(), apply: true });
      await expect(sink.finalize(report)).rejects.toThrow();
      expect(JSON.parse(await readFile(resultPath, 'utf8')).status).toBe('acceptance_unknown');
    },
  );

  it.runIf(process.platform !== 'win32')(
    'accepts an exact terminal readback when rename reports an ambiguous error',
    async () => {
      const harness = await createHarness();
      const report = await runParentWelcomeVideoBinding({
        manifest: harness.manifest,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: harness.resultSink,
        now: NOW,
      });
      const resultPath = path.join(harness.manifest.private_asset_root, 'rename.private.json');
      const sink = createPrivateParentWelcomeResultSink(resultPath, {
        platform: 'linux',
        syncParent: async () => undefined,
        renameFile: async (from, to) => {
          await rename(from, to);
          throw new Error('synthetic error after accepted rename');
        },
      });

      await sink.reserve({ generatedAt: NOW.toISOString(), apply: false });
      await expect(sink.finalize(report)).resolves.toBeUndefined();
      expect(JSON.parse(await readFile(resultPath, 'utf8'))).toEqual(report);
    },
  );

  it.runIf(process.platform !== 'win32')(
    'classifies a post-rename directory fsync failure as unknown after exact readback',
    async () => {
      const harness = await createHarness();
      const resultPath = path.join(harness.manifest.private_asset_root, 'post-rename.private.json');
      let parentSyncCalls = 0;
      const sink = createPrivateParentWelcomeResultSink(resultPath, {
        platform: 'linux',
        syncParent: async () => {
          parentSyncCalls += 1;
          if (parentSyncCalls === 3) throw new Error('synthetic post-rename sync failure');
        },
      });

      const report = await runParentWelcomeVideoBinding({
        manifest: harness.manifest,
        apply: true,
        authorizationPhrase: AUTHORIZATION,
        runtime: harness.runtime,
        objectStore: harness.objectStore,
        repository: harness.repository,
        mediaProbe: harness.mediaProbe,
        resultSink: sink,
        now: NOW,
      });

      expect(report.status).toBe('acceptance_unknown');
      expect(report.blockers).toContain('private_result_finalize_acceptance_unknown');
      expect(parentSyncCalls).toBe(3);
      expect(JSON.parse(await readFile(resultPath, 'utf8')).status).toBe('applied');
      expect(harness.repository.reconcileCommittedCalls).toBe(1);
    },
  );

  it('uses strict ffprobe/decode evidence and rejects broken media and poster bytes', async () => {
    const harness = await createHarness();
    const calls: string[] = [];
    const mediaPath = path.join(harness.manifest.private_asset_root, 'approved.mp4');
    const ffprobePayload = {
      format: {
        format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
        duration: '90.000',
        tags: {
          major_brand: 'isom',
          minor_version: '512',
          compatible_brands: 'isomiso2avc1mp41',
          encoder: 'Lavf61.7.100',
        },
      },
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          pix_fmt: 'yuv420p',
          width: 832,
          height: 468,
          sample_aspect_ratio: '1:1',
          avg_frame_rate: '30/1',
          tags: {
            language: 'und',
            handler_name: 'VideoHandler',
            vendor_id: '[0][0][0][0]',
            encoder: 'Lavc61.19.100 libx264',
          },
        },
        {
          codec_type: 'audio',
          codec_name: 'aac',
          profile: 'LC',
          sample_rate: '44100',
          channels: 2,
          tags: {
            language: 'und',
            handler_name: 'SoundHandler',
            vendor_id: '[0][0][0][0]',
          },
        },
      ],
    };
    const ffprobeStdout = JSON.stringify(ffprobePayload);
    const probe = createProductionParentWelcomeMediaProbe({
      runCommand: async (executable, args) => {
        calls.push(executable);
        expect(args.at(-1)).toBe(executable === 'ffprobe' ? mediaPath : '-');
        if (executable === 'ffmpeg') expect(args).toContain('-xerror');
        if (executable === 'ffprobe') {
          return { exitCode: 0, stdout: ffprobeStdout };
        }
        return { exitCode: 1, stdout: '' };
      },
      decodePoster: async () => ({
        format: 'jpeg',
        width: 832,
        height: 468,
        decoded: true,
        privacyMetadataRemoved: true,
      }),
    });
    await expect(probe.inspectMedia(mediaPath)).rejects.toThrow();
    expect(calls).toEqual(['ffprobe', 'ffmpeg']);

    const brokenContainerProbe = createProductionParentWelcomeMediaProbe({
      runCommand: async (executable, args) => {
        expect(executable).toBe('ffprobe');
        expect(args.at(-1)).toBe(mediaPath);
        return { exitCode: 1, stdout: 'not an mp4 probe result' };
      },
      decodePoster: async () => ({
        format: 'jpeg',
        width: 832,
        height: 468,
        decoded: true,
        privacyMetadataRemoved: true,
      }),
    });
    await expect(brokenContainerProbe.inspectMedia(mediaPath)).rejects.toThrow();

    const validProbe = createProductionParentWelcomeMediaProbe({
      runCommand: async (executable) => ({
        exitCode: 0,
        stdout: executable === 'ffprobe' ? ffprobeStdout : '',
      }),
      decodePoster: async () => ({
        format: 'jpeg',
        width: 832,
        height: 468,
        decoded: true,
        privacyMetadataRemoved: true,
      }),
    });
    await expect(validProbe.inspectMedia(mediaPath)).resolves.toMatchObject({
      container: 'mp4',
      decoded: true,
      rotationDegrees: 0,
      sampleAspectRatio: '1:1',
      audioSampleRateHz: 44_100,
      privacyMetadataRemoved: true,
    });

    const taggedProbe = createProductionParentWelcomeMediaProbe({
      runCommand: async (executable) => ({
        exitCode: 0,
        stdout:
          executable === 'ffprobe'
            ? JSON.stringify({
                ...ffprobePayload,
                format: {
                  ...ffprobePayload.format,
                  tags: {
                    ...ffprobePayload.format.tags,
                    comment: 'synthetic private locator',
                  },
                },
              })
            : '',
      }),
      decodePoster: async () => ({
        format: 'jpeg',
        width: 832,
        height: 468,
        decoded: true,
        privacyMetadataRemoved: true,
      }),
    });
    await expect(taggedProbe.inspectMedia(mediaPath)).resolves.toMatchObject({
      privacyMetadataRemoved: false,
    });

    const defaultPosterProbe = createProductionParentWelcomeMediaProbe({
      runCommand: async () => ({ exitCode: 1, stdout: '' }),
    });
    await expect(
      defaultPosterProbe.inspectPoster(
        path.join(harness.manifest.private_asset_root, 'approved.jpg'),
      ),
    ).rejects.toThrow();

    const cleanPosterPath = path.join(harness.manifest.private_asset_root, 'clean.jpg');
    const taggedPosterPath = path.join(harness.manifest.private_asset_root, 'tagged.jpg');
    const cleanPoster = await sharp({
      create: { width: 832, height: 468, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .toBuffer();
    const taggedPoster = await sharp({
      create: { width: 832, height: 468, channels: 3, background: '#ffffff' },
    })
      .withExif({ IFD0: { Artist: 'synthetic private author' } })
      .jpeg()
      .toBuffer();
    await writeFile(cleanPosterPath, cleanPoster);
    await writeFile(taggedPosterPath, taggedPoster);
    await expect(defaultPosterProbe.inspectPoster(cleanPosterPath)).resolves.toMatchObject({
      privacyMetadataRemoved: true,
    });
    await expect(defaultPosterProbe.inspectPoster(taggedPosterPath)).rejects.toThrow();
  });

  it('orders database parents before children and replays without another insert', async () => {
    const harness = await createHarness();
    const prepared = await runParentWelcomeVideoBinding({
      manifest: harness.manifest,
      apply: true,
      authorizationPhrase: AUTHORIZATION,
      runtime: harness.runtime,
      objectStore: harness.objectStore,
      repository: harness.repository,
      mediaProbe: harness.mediaProbe,
      resultSink: harness.resultSink,
      now: NOW,
    });
    expect(prepared.status).toBe('applied');
    const plan = harness.repository.lastPlan!;
    const database = new RecordingDatabase();
    const repository = createPostgresParentWelcomeBindingRepository(database.pool as never);

    await expect(
      repository.withOperationLock({ scope: plan.scope }, async () => 'lock-held'),
    ).resolves.toBe('lock-held');

    await expect(
      repository.consumeAuthorization({
        operationId: plan.operationId,
        manifestDigest: plan.manifestDigest,
        authorizationPhraseSha256: plan.authorizationPhraseSha256,
        authorizationBindingSha256: plan.authorizationBindingSha256,
        scope: plan.scope,
        consumedAt: plan.publishedAt,
      }),
    ).resolves.toBe('claimed');

    await expect(repository.apply(plan)).resolves.toBe('applied');
    const firstInsertCount = database.inserts.length;
    await expect(repository.apply(plan)).resolves.toBe('replayed');

    expect(database.inserts).toHaveLength(firstInsertCount);
    expect(database.statements.filter((sql) => sql === 'BEGIN')).toHaveLength(3);
    expect(database.statements.filter((sql) => sql === 'COMMIT')).toHaveLength(3);
    expect(database.statements).toContain('SELECT pg_advisory_xact_lock($1)');
    expect(database.statements).toContain('SELECT pg_try_advisory_lock($1) AS acquired');
    expect(database.statements).toContain('SELECT pg_advisory_unlock($1) AS released');
    expect(database.firstValueFor('SELECT pg_try_advisory_lock($1) AS acquired')).not.toBe(
      database.firstValueFor('SELECT pg_advisory_xact_lock($1)'),
    );
    expect(database.statements.join('\n')).toMatch(
      /INSERT INTO onetime\.parent_welcome_binding_authorizations_v21[\s\S]*ON CONFLICT DO NOTHING RETURNING operation_id/u,
    );
    expect(database.statements.join('\n')).toContain(
      "FROM onetime.content_drive_observations WHERE account_key=$1 AND product_key=$2 AND drive_file_ref_digest=$3 AND change_marker=$4 AND drive_state='processed'",
    );
    expect(database.statements.join('\n')).not.toContain(
      "AND change_marker=$4 AND state='processed'",
    );
    expect(insertIndex(database.inserts, 'parent_welcome_binding_authorizations_v21')).toBeLessThan(
      insertIndex(database.inserts, 'content_sources_v21'),
    );
    expect(insertIndex(database.inserts, 'content_processing_versions')).toBeLessThan(
      insertIndex(database.inserts, 'content_processing_artifacts'),
    );
    expect(insertIndex(database.inserts, 'content_processing_versions')).toBeLessThan(
      insertIndex(database.inserts, 'content_publications'),
    );
    expect(insertIndex(database.inserts, 'content_publications')).toBeLessThan(
      insertIndex(database.inserts, 'content_publication_receipts'),
    );
    expect(insertIndex(database.inserts, 'content_publications')).toBeLessThan(
      insertIndex(database.inserts, 'parent_welcome_video_slots_v21'),
    );
    expect(insertIndex(database.inserts, 'parent_welcome_video_slots_v21')).toBeLessThan(
      insertIndex(database.inserts, 'parent_welcome_video_assets_v21'),
    );
    expect(insertIndex(database.inserts, 'parent_welcome_video_assets_v21')).toBeLessThan(
      insertIndex(database.inserts, 'parent_welcome_binding_operation_results_v21'),
    );
    expect(
      database.inserts.filter((sql) => sql.includes('parent_welcome_video_assets_v21')),
    ).toHaveLength(3);
    expect(database.statements.join('\n')).not.toMatch(
      /content_publication_outbox|provider_operation_binding|vimeo|highlevel|ghl|email|customer/iu,
    );
  });

  it('uses one conditional versioned KMS upload and exact version readback in the AWS adapter', async () => {
    const harness = await createHarness();
    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
    const versionId = 'synthetic-version-id';
    const objectKey = `parent_welcome_media_${sha(MEDIA)}`;
    const client = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        const name = command.constructor.name;
        calls.push({ name, input: command.input });
        if (name === 'GetBucketLocationCommand') return { LocationConstraint: 'eu-central-1' };
        if (name === 'GetBucketVersioningCommand') return { Status: 'Enabled' };
        if (name === 'GetPublicAccessBlockCommand') {
          return {
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: true,
              IgnorePublicAcls: true,
              BlockPublicPolicy: true,
              RestrictPublicBuckets: true,
            },
          };
        }
        if (name === 'GetBucketOwnershipControlsCommand') {
          return { OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] } };
        }
        if (name === 'GetBucketEncryptionCommand') {
          return {
            ServerSideEncryptionConfiguration: {
              Rules: [
                {
                  ApplyServerSideEncryptionByDefault: {
                    SSEAlgorithm: 'aws:kms',
                    KMSMasterKeyID: harness.runtime.kmsKeyArn,
                  },
                },
              ],
            },
          };
        }
        if (name === 'ListObjectVersionsCommand') {
          return { Versions: [{ Key: objectKey, VersionId: versionId }], DeleteMarkers: [] };
        }
        if (name === 'HeadObjectCommand') {
          return {
            VersionId: versionId,
            ContentLength: MEDIA.byteLength,
            ContentType: 'video/mp4',
            ServerSideEncryption: 'aws:kms',
            SSEKMSKeyId: harness.runtime.kmsKeyArn,
            ChecksumSHA256: Buffer.from(sha(MEDIA), 'hex').toString('base64'),
            Metadata: {
              'ot-asset-kind': 'media',
              'ot-payload-sha256': sha(MEDIA),
              'ot-byte-count': String(MEDIA.byteLength),
            },
          };
        }
        if (name === 'GetObjectCommand') {
          return {
            VersionId: versionId,
            ContentLength: MEDIA.byteLength,
            ContentType: 'video/mp4',
            Body: {
              async *[Symbol.asyncIterator]() {
                yield MEDIA;
              },
            },
          };
        }
        if (name === 'PutObjectCommand') {
          (command.input.Body as { destroy?: () => void } | undefined)?.destroy?.();
          return { VersionId: versionId };
        }
        if (name === 'DeleteObjectCommand') return {};
        throw new Error(`unexpected synthetic command: ${name}`);
      },
    };
    const store = createAwsParentWelcomeObjectStore({
      client: client as never,
      bucketRef: harness.runtime.bucketRef,
      kmsKeyArn: harness.runtime.kmsKeyArn,
      storageClass: harness.runtime.storageClass,
    });
    const asset = {
      kind: 'media' as const,
      localPath: path.join(harness.manifest.private_asset_root, 'approved.mp4'),
      objectKey,
      sha256: sha(MEDIA),
      byteCount: MEDIA.byteLength,
      contentType: 'video/mp4',
      width: null,
      height: null,
    };

    await store.assertPrivateVersionedPolicy({
      region: harness.runtime.region,
      bucketRef: harness.runtime.bucketRef,
      kmsKeyArn: harness.runtime.kmsKeyArn,
      storageClass: harness.runtime.storageClass,
    });
    await expect(store.inspect(asset)).resolves.toEqual({ state: 'exact', versionId });
    await expect(store.putOnce(asset)).resolves.toEqual({ versionId });
    await store.deleteExactVersion({ objectKey, versionId });

    const put = calls.find(({ name }) => name === 'PutObjectCommand')!.input;
    expect(put).toMatchObject({
      IfNoneMatch: '*',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: harness.runtime.kmsKeyArn,
      ChecksumSHA256: Buffer.from(sha(MEDIA), 'hex').toString('base64'),
      StorageClass: harness.runtime.storageClass,
    });
    expect(calls.filter(({ name }) => name === 'PutObjectCommand')).toHaveLength(1);
    expect(calls.find(({ name }) => name === 'HeadObjectCommand')?.input.VersionId).toBe(versionId);
    expect(calls.find(({ name }) => name === 'GetObjectCommand')?.input.VersionId).toBe(versionId);
    expect(calls.find(({ name }) => name === 'DeleteObjectCommand')?.input.VersionId).toBe(
      versionId,
    );
  });
});

async function createHarness() {
  privateRoot = await mkdtemp(path.join(tmpdir(), 'ot-parent-welcome-operation-'));
  await Promise.all([
    writeFile(path.join(privateRoot, 'source.mp4'), SOURCE, { mode: 0o600 }),
    writeFile(path.join(privateRoot, 'approved.mp4'), MEDIA, { mode: 0o600 }),
    writeFile(path.join(privateRoot, 'approved.vtt'), CAPTIONS, { mode: 0o600 }),
    writeFile(path.join(privateRoot, 'approved.jpg'), POSTER, { mode: 0o600 }),
  ]);
  const manifest = {
    schema_version: 'onetime.parent_welcome.binding.private.v1',
    operation_id: `pwb_${'1'.repeat(32)}`,
    expires_at: '2026-08-16T09:40:00.000Z',
    expected_runtime_source_sha: RUNTIME_SHA,
    authorization_phrase_sha256: sha(AUTHORIZATION),
    authorization_binding_sha256: '0'.repeat(64),
    scope: {
      account_key: 'synthetic_account',
      product_key: 'one_time_mishnayos',
      runtime_tier: 'production' as const,
      verification_environment_id: 'synthetic-production-environment',
    },
    storage: {
      region: 'eu-central-1',
      bucket_ref: 'synthetic-private-bucket',
      kms_key_arn: 'arn:aws:kms:eu-central-1:111122223333:key/synthetic',
      storage_class: 'STANDARD' as const,
    },
    drive_source: {
      file_identity: 'synthetic-private-drive-file',
      revision_identity: 'synthetic-private-drive-revision',
      private_source_relative_path: 'source.mp4',
      sha256: sha(SOURCE),
      byte_count: SOURCE.byteLength,
      media: {
        content_type: 'video/mp4' as const,
        container: 'mp4' as const,
        duration_ms: 90_000,
        width: 832,
        height: 464,
        frames_per_second: 30,
        video_codec: 'h264' as const,
        pixel_format: 'yuv420p' as const,
        rotation_degrees: 0 as const,
        sample_aspect_ratio: '1:1' as const,
        audio_codec: 'aac' as const,
        audio_profile: 'LC' as const,
        audio_sample_rate_hz: 44_100 as const,
        audio_channels: 2 as const,
      },
    },
    review: {
      approved_by_admin_id: 'synthetic_admin',
      rights_attested_at: '2026-08-16T09:00:00.000Z',
      human_reviewed_at: '2026-08-16T09:05:00.000Z',
      approved_at: '2026-08-16T09:10:00.000Z',
      publication_requested_at: '2026-08-16T09:15:00.000Z',
      child_data_disposition: 'redactions_complete' as const,
    },
    presentation: {
      title: 'Welcome to One Time',
      class_topic: 'Parent orientation',
    },
    private_asset_root: privateRoot,
    assets: {
      media: {
        relative_path: 'approved.mp4',
        sha256: sha(MEDIA),
        byte_count: MEDIA.byteLength,
        content_type: 'video/mp4' as const,
        duration_ms: 90_000,
        width: 832,
        height: 468,
        frames_per_second: 30,
        audio_sample_rate_hz: 44_100 as const,
      },
      captions: {
        relative_path: 'approved.vtt',
        sha256: sha(CAPTIONS),
        byte_count: CAPTIONS.byteLength,
        content_type: 'text/vtt' as const,
      },
      poster: {
        relative_path: 'approved.jpg',
        sha256: sha(POSTER),
        byte_count: POSTER.byteLength,
        content_type: 'image/jpeg' as const,
        width: 832,
        height: 468,
      },
    },
  };
  manifest.authorization_binding_sha256 = parentWelcomeAuthorizationBindingSha256(
    manifest,
    AUTHORIZATION,
  );
  const runtime = {
    commitSha: RUNTIME_SHA,
    accountKey: manifest.scope.account_key,
    productKey: manifest.scope.product_key,
    runtimeTier: manifest.scope.runtime_tier,
    verificationEnvironmentId: manifest.scope.verification_environment_id,
    writesAllowed: true,
    region: manifest.storage.region,
    bucketRef: manifest.storage.bucket_ref,
    kmsKeyArn: manifest.storage.kms_key_arn,
    storageClass: manifest.storage.storage_class,
  };
  return {
    manifest,
    runtime,
    objectStore: new MemoryObjectStore(),
    repository: new MemoryBindingRepository(),
    mediaProbe: new SyntheticMediaProbe(),
    resultSink: new MemoryResultSink(),
  };
}

class SyntheticMediaProbe implements ParentWelcomeMediaProbe {
  failMedia = false;
  falseWidth = false;
  falsePosterWidth = false;
  rotated = false;
  wrongAudioRate = false;
  mutateMediaAfterProbe = false;
  falseSourceWidth = false;
  falseSourceDuration = false;
  falseSourceCodec = false;
  wrongSourceAudioRate = false;
  failSource = false;
  swapSourceAndDerivative = false;
  failPoster = false;
  mediaMetadataPresent = false;
  posterMetadataPresent = false;
  mediaCalls = 0;
  posterCalls = 0;

  async inspectMedia(filePath: string) {
    this.mediaCalls += 1;
    const source = path.basename(filePath) === 'source.mp4';
    if (source && this.failSource) throw new Error('synthetic broken source');
    if (this.failMedia) throw new Error('synthetic broken media');
    if (!source && this.mutateMediaAfterProbe) {
      await writeFile(filePath, Buffer.from('synthetic changed media bytes'));
    }
    const sourceShape = this.swapSourceAndDerivative ? !source : source;
    return {
      container: 'mp4' as const,
      videoStreamCount: 1 as const,
      audioStreamCount: 1 as const,
      width: source && this.falseSourceWidth ? 640 : !source && this.falseWidth ? 640 : 832,
      height: sourceShape ? 464 : 468,
      rotationDegrees: this.rotated ? 90 : 0,
      sampleAspectRatio: '1:1' as const,
      durationMs: source && this.falseSourceDuration ? 89_000 : 90_000,
      framesPerSecond: 30,
      videoCodec: source && this.falseSourceCodec ? ('vp9' as const) : ('h264' as const),
      pixelFormat: 'yuv420p' as const,
      audioCodec: 'aac' as const,
      audioProfile: 'LC' as const,
      audioSampleRateHz:
        this.wrongAudioRate || (source && this.wrongSourceAudioRate) ? 48_000 : 44_100,
      audioChannels: 2 as const,
      decoded: true as const,
      privacyMetadataRemoved: !source && !this.mediaMetadataPresent,
    };
  }

  async inspectPoster() {
    this.posterCalls += 1;
    if (this.failPoster) throw new Error('synthetic broken poster');
    return {
      format: 'jpeg' as const,
      width: this.falsePosterWidth ? 640 : 832,
      height: 468,
      decoded: true as const,
      privacyMetadataRemoved: !this.posterMetadataPresent,
    };
  }
}

class MemoryResultSink implements ParentWelcomePrivateResultSink {
  reserveCalls = 0;
  finalizeCalls = 0;
  failReserve = false;
  failFinalize = false;

  async reserve() {
    this.reserveCalls += 1;
    if (this.failReserve) throw new Error('synthetic sink reservation failure');
  }

  async finalize() {
    this.finalizeCalls += 1;
    if (this.failFinalize) throw new Error('synthetic sink finalize failure');
  }
}

class MemoryObjectStore implements ParentWelcomeObjectStore {
  policyChecks = 0;
  putCalls = 0;
  readbackCalls = 0;
  deleteCalls = 0;
  forceAmbiguous = false;
  forceMismatchAfterPut = false;
  throwAfterPut = false;
  private putGate: Promise<void> | undefined;
  private releasePutGate: (() => void) | undefined;
  private putObserved: Promise<void> | undefined;
  private markPutObserved: (() => void) | undefined;
  private readonly objects = new Map<
    string,
    { versionId: string; sha256: string; byteCount: number; contentType: string }
  >();

  async assertPrivateVersionedPolicy() {
    this.policyChecks += 1;
  }

  holdNextPut() {
    this.putGate = new Promise((resolve) => {
      this.releasePutGate = resolve;
    });
    this.putObserved = new Promise((resolve) => {
      this.markPutObserved = resolve;
    });
  }

  async waitUntilPutStarted() {
    await this.putObserved;
  }

  releasePut() {
    this.releasePutGate?.();
  }

  async inspect(input: {
    objectKey: string;
    sha256: string;
    byteCount: number;
    contentType: string;
  }): Promise<ParentWelcomeObjectInspection> {
    if (this.forceAmbiguous) return { state: 'ambiguous' };
    const stored = this.objects.get(input.objectKey);
    if (!stored) return { state: 'absent' };
    this.readbackCalls += 1;
    if (this.forceMismatchAfterPut) {
      return { state: 'mismatch', versionId: stored.versionId };
    }
    if (
      stored.sha256 !== input.sha256 ||
      stored.byteCount !== input.byteCount ||
      stored.contentType !== input.contentType
    ) {
      return { state: 'mismatch', versionId: stored.versionId };
    }
    return { state: 'exact', versionId: stored.versionId };
  }

  async putOnce(input: {
    objectKey: string;
    sha256: string;
    byteCount: number;
    contentType: string;
  }) {
    this.putCalls += 1;
    if (this.objects.has(input.objectKey)) throw new Error('synthetic duplicate');
    this.objects.set(input.objectKey, {
      versionId: `synthetic-version-${this.putCalls}`,
      sha256: input.sha256,
      byteCount: input.byteCount,
      contentType: input.contentType,
    });
    if (this.putCalls === 1 && this.putGate) {
      this.markPutObserved?.();
      await this.putGate;
    }
    if (this.throwAfterPut) throw new Error('synthetic acceptance ambiguity');
    return { versionId: `synthetic-version-${this.putCalls}` };
  }

  async deleteExactVersion(input: { objectKey: string; versionId: string }) {
    this.deleteCalls += 1;
    const stored = this.objects.get(input.objectKey);
    if (!stored || stored.versionId !== input.versionId) throw new Error('synthetic mismatch');
    this.objects.delete(input.objectKey);
  }

  objectCount() {
    return this.objects.size;
  }

  hasExactVersion(objectKey: string, objectVersionId: string) {
    return this.objects.get(objectKey)?.versionId === objectVersionId;
  }
}

class MemoryBindingRepository implements ParentWelcomeBindingRepository {
  applyCalls = 0;
  consumeCalls = 0;
  reconcileCommittedCalls = 0;
  failApply = false;
  throwApplyAmbiguous = false;
  throwAfterConsume = false;
  lastPlan: ParentWelcomeBindingPlan | undefined;
  committedPlan: ParentWelcomeBindingPlan | undefined;
  private readonly claims: ParentWelcomeAuthorizationClaim[] = [];
  private claimGate: Promise<void> | undefined;
  private releaseClaimGate: (() => void) | undefined;
  private claimObserved: Promise<void> | undefined;
  private markClaimObserved: (() => void) | undefined;
  private operationLockTail: Promise<void> = Promise.resolve();

  async withOperationLock<T>(_input: unknown, work: () => Promise<T>) {
    const previous = this.operationLockTail;
    let releaseLock!: () => void;
    this.operationLockTail = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      releaseLock();
    }
  }

  holdNextClaim() {
    this.claimGate = new Promise((resolve) => {
      this.releaseClaimGate = resolve;
    });
    this.claimObserved = new Promise((resolve) => {
      this.markClaimObserved = resolve;
    });
  }

  async waitUntilClaimed() {
    await this.claimObserved;
  }

  releaseClaim() {
    this.releaseClaimGate?.();
  }

  async consumeAuthorization(input: ParentWelcomeAuthorizationClaim) {
    this.consumeCalls += 1;
    const claimed = this.claims.find(
      (entry) =>
        entry.authorizationPhraseSha256 === input.authorizationPhraseSha256 ||
        entry.operationId === input.operationId,
    );
    if (!claimed) {
      this.claims.push(structuredClone(input));
      this.markClaimObserved?.();
      if (this.claimGate) await this.claimGate;
      if (this.throwAfterConsume) throw new Error('synthetic claim acceptance ambiguity');
      return 'claimed' as const;
    }
    if (!sameAuthorizationClaim(claimed, input)) return 'conflict' as const;
    return this.committedPlan?.operationId === input.operationId
      ? ('committed_replay' as const)
      : ('consumed' as const);
  }

  async reconcileAuthorization(input: ParentWelcomeAuthorizationClaim) {
    const claimed = this.claims.find(
      (entry) =>
        entry.authorizationPhraseSha256 === input.authorizationPhraseSha256 ||
        entry.operationId === input.operationId,
    );
    if (!claimed) return 'unseen' as const;
    if (!sameAuthorizationClaim(claimed, input)) return 'conflict' as const;
    return this.committedPlan?.operationId === input.operationId
      ? ('committed_replay' as const)
      : ('claimed' as const);
  }

  async reconcileCommittedOperation(input: { operationId: string; manifestDigest: string }) {
    this.reconcileCommittedCalls += 1;
    if (!this.committedPlan) return 'absent' as const;
    return this.committedPlan.operationId === input.operationId &&
      this.committedPlan.manifestDigest === input.manifestDigest
      ? ('exact' as const)
      : ('conflict' as const);
  }

  async preflight(input: { videoVersionId: string }) {
    if (!this.committedPlan) return { state: 'absent' as const };
    return this.committedPlan.videoVersionId === input.videoVersionId
      ? { state: 'candidate' as const }
      : { state: 'conflict' as const };
  }

  async reconcile(plan: ParentWelcomeBindingPlan) {
    return this.committedPlan && fingerprint(this.committedPlan) === fingerprint(plan)
      ? ('exact' as const)
      : ('conflict' as const);
  }

  async apply(plan: ParentWelcomeBindingPlan) {
    this.applyCalls += 1;
    this.lastPlan = plan;
    if (this.failApply) return 'precommit_failure' as const;
    if (this.throwApplyAmbiguous) throw new Error('synthetic commit acceptance ambiguity');
    this.committedPlan = structuredClone(plan);
    return 'applied' as const;
  }
}

class RecordingDatabase {
  statements: string[] = [];
  inserts: string[] = [];
  calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  private hasInventory = false;
  private authorization: Record<string, unknown> | undefined;
  private hasOperationResult = false;

  readonly pool = {
    connect: async () => ({
      query: async (statement: string, values: readonly unknown[] = []) => {
        const sql = statement.replace(/\s+/gu, ' ').trim();
        this.statements.push(sql);
        this.calls.push({ sql, values });
        if (sql === 'SELECT pg_try_advisory_lock($1) AS acquired') {
          return { rows: [{ acquired: true }] };
        }
        if (sql === 'SELECT pg_advisory_unlock($1) AS released') {
          return { rows: [{ released: true }] };
        }
        if (/^INSERT INTO onetime\.parent_welcome_binding_authorizations_v21/u.test(sql)) {
          this.inserts.push(sql);
          if (this.authorization) return { rows: [] };
          this.authorization = {
            authorization_phrase_sha256: values[0],
            operation_id: values[1],
            manifest_digest: values[2],
            authorization_binding_sha256: values[3],
            account_key: values[4],
            product_key: values[5],
            runtime_tier: values[6],
            verification_environment_id: values[7],
          };
          return { rows: [{ operation_id: values[1] }] };
        }
        if (/FROM onetime\.parent_welcome_binding_authorizations_v21 AS binding_auth/u.test(sql)) {
          return {
            rows: this.authorization
              ? [
                  {
                    ...this.authorization,
                    result_manifest_digest: this.hasOperationResult
                      ? this.authorization.manifest_digest
                      : null,
                  },
                ]
              : [],
          };
        }
        if (/^INSERT INTO onetime\.parent_welcome_binding_operation_results_v21/u.test(sql)) {
          this.inserts.push(sql);
          this.hasOperationResult = true;
          return { rows: [] };
        }
        if (/^SELECT 1 FROM onetime\.parent_welcome_binding_operation_results_v21/u.test(sql)) {
          return { rows: this.hasOperationResult ? [{}] : [] };
        }
        if (/^INSERT INTO /u.test(sql)) {
          this.hasInventory = true;
          this.inserts.push(sql);
          return { rows: [] };
        }
        if (/^SELECT EXISTS\(/u.test(sql)) {
          return { rows: [{ present: this.hasInventory }] };
        }
        if (/^SELECT 1 FROM /u.test(sql)) {
          return { rows: this.hasInventory ? [{}] : [] };
        }
        return { rows: [] };
      },
      release: () => undefined,
    }),
  };

  firstValueFor(sql: string) {
    return this.calls.find((call) => call.sql === sql)?.values[0];
  }
}

function expectSanitized(report: unknown, harness: Awaited<ReturnType<typeof createHarness>>) {
  const serialized = JSON.stringify(report);
  const privateValues = [
    harness.manifest.private_asset_root,
    harness.manifest.operation_id,
    harness.manifest.drive_source.file_identity,
    harness.manifest.drive_source.revision_identity,
    harness.manifest.drive_source.private_source_relative_path,
    harness.manifest.drive_source.sha256,
    harness.manifest.assets.media.sha256,
    harness.manifest.assets.captions.sha256,
    harness.manifest.assets.poster.sha256,
    harness.manifest.authorization_binding_sha256,
    harness.manifest.storage.bucket_ref,
    harness.manifest.storage.kms_key_arn,
    AUTHORIZATION,
  ];
  for (const value of privateValues) expect(serialized).not.toContain(value);
  expect(serialized).not.toContain('Welcome, parents.');
}

function fingerprint(value: unknown) {
  return JSON.stringify(value);
}

function sameAuthorizationClaim(
  left: ParentWelcomeAuthorizationClaim,
  right: ParentWelcomeAuthorizationClaim,
) {
  const bound = ({
    operationId,
    manifestDigest,
    authorizationPhraseSha256,
    authorizationBindingSha256,
    scope,
  }: ParentWelcomeAuthorizationClaim) => ({
    operationId,
    manifestDigest,
    authorizationPhraseSha256,
    authorizationBindingSha256,
    scope,
  });
  return fingerprint(bound(left)) === fingerprint(bound(right));
}

function insertIndex(statements: readonly string[], table: string) {
  const index = statements.findIndex((sql) => sql.includes(`INSERT INTO onetime.${table}`));
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

function sha(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}
