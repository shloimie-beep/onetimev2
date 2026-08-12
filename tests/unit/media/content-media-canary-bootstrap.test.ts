import { describe, expect, it } from 'vitest';

import {
  CONTENT_MEDIA_CANARY_BOOTSTRAP_SCHEMA,
  inspectContentMediaCanaryBootstrap,
  type ContentMediaCanaryBootstrapInput,
} from '../../../scripts/media/content-media-canary-bootstrap.ts';

const sha = (character: string) => character.repeat(64);

function readyInput(): ContentMediaCanaryBootstrapInput {
  const envPresence = Object.fromEntries(
    [
      'ONE_TIME_RUNTIME_ENVIRONMENT',
      'ONE_TIME_VERIFICATION_ENVIRONMENT_ID',
      'ONE_TIME_CONTENT_MEDIA_MODE',
      'ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID',
      'ONE_TIME_CONTENT_CANARY_ID',
      'CONTENT_S3_BUCKET',
      'CONTENT_S3_KMS_KEY_ARN',
      'CONTENT_S3_STORAGE_CLASS',
      'AWS_REGION',
      'CONTENT_FFMPEG_PATH',
      'CONTENT_FFPROBE_PATH',
      'OPENAI_API_KEY',
      'OPENAI_PROJECT_ID',
      'VIMEO_ACCESS_TOKEN',
      'VIMEO_ACCOUNT_ID',
      'VIMEO_WEBHOOK_SECRET',
      'CONTENT_S3_PROVIDER_ACCOUNT_REF_HASH',
      'CONTENT_S3_REGISTRY_EVIDENCE_DIGEST',
      'CONTENT_S3_PROVIDER_READBACK_EVIDENCE_DIGEST',
      'CONTENT_S3_REGISTRY_VERSION',
      'CONTENT_S3_REGISTRY_OBSERVED_NOT_BEFORE',
      'CONTENT_OPENAI_PROVIDER_ACCOUNT_REF_HASH',
      'CONTENT_OPENAI_REGISTRY_EVIDENCE_DIGEST',
      'CONTENT_OPENAI_PROVIDER_READBACK_EVIDENCE_DIGEST',
      'CONTENT_OPENAI_REGISTRY_VERSION',
      'CONTENT_OPENAI_REGISTRY_OBSERVED_NOT_BEFORE',
      'CONTENT_VIMEO_PROVIDER_ACCOUNT_REF_HASH',
      'CONTENT_VIMEO_REGISTRY_EVIDENCE_DIGEST',
      'CONTENT_VIMEO_PROVIDER_READBACK_EVIDENCE_DIGEST',
      'CONTENT_VIMEO_REGISTRY_VERSION',
      'CONTENT_VIMEO_REGISTRY_OBSERVED_NOT_BEFORE',
    ].map((name) => [name, true]),
  );
  const receipt = {
    provider_account_ref_hash: sha('a'),
    registry_evidence_digest: sha('b'),
    provider_readback_evidence_digest: sha('c'),
    observed_at: '2026-08-12T12:00:00.000Z',
    version: 1,
  };
  return {
    schema_version: CONTENT_MEDIA_CANARY_BOOTSTRAP_SCHEMA,
    services: {
      web: {
        content_media_enabled: true,
        content_media_worker_enabled: false,
        shared_configuration_digest: sha('d'),
        env_presence: envPresence,
      },
      worker: {
        content_media_enabled: false,
        content_media_worker_enabled: false,
        shared_configuration_digest: sha('d'),
        env_presence: envPresence,
      },
    },
    handoff: {
      phase: 'temporary',
      temporary_reference_digest: sha('e'),
      dec_160_standalone_source_confirmed: true,
    },
    registry_receipts: { s3: receipt, openai: receipt, vimeo: receipt },
  };
}

describe('content media canary bootstrap inspector', () => {
  it('reports a zero-effect temporary T handoff ready only for separately authorized apply', () => {
    const report = inspectContentMediaCanaryBootstrap(readyInput());

    expect(report).toMatchObject({
      status: 'ready_for_separately_authorized_apply',
      effects: {
        external_provider_calls: 0,
        database_reads: 0,
        database_writes: 0,
        environment_writes: 0,
        deployments: 0,
      },
      handoff_check: {
        phase: 'temporary',
        processing_or_publication_permitted: false,
      },
      service_check: {
        web_enabled: true,
        worker_enabled: false,
        worker_media_runner_enabled: false,
        shared_configuration_parity: true,
      },
    });
    expect(JSON.stringify(report)).not.toContain('VIMEO_ACCESS_TOKEN=');
    expect(report.redacted_registry_plan.map((entry) => entry.registry_binding_key)).toEqual([
      's3_content_original_primary',
      'openai_content_processing_primary',
      'vimeo_publication_primary',
    ]);
  });

  it('allows confirmed S only with a durable receipt and the DEC-160 standalone confirmation', () => {
    const input = readyInput();
    input.handoff = {
      phase: 'confirmed',
      temporary_reference_digest: sha('e'),
      confirmed_source_key: `source_${'f'.repeat(32)}`,
      durable_source_receipt: {
        source_sha256: sha('f'),
        object_version_id_present: true,
        checksum_readback_receipt_id_present: true,
      },
      dec_160_standalone_source_confirmed: true,
    };

    expect(inspectContentMediaCanaryBootstrap(input).status).toBe(
      'ready_for_separately_authorized_apply',
    );

    input.handoff.dec_160_standalone_source_confirmed = false;
    expect(inspectContentMediaCanaryBootstrap(input).blocked_reasons).toContain(
      'BLOCKED_DEC_160_STANDALONE_SOURCE_INVARIANT_UNCONFIRMED',
    );
  });

  it('fails closed when parity, worker-off, receipt, or T-to-S boundaries are incomplete', () => {
    const input = readyInput();
    input.services.worker.content_media_enabled = true;
    input.services.worker.shared_configuration_digest = sha('9');
    input.registry_receipts = {};
    input.handoff.confirmed_source_key = `source_${'f'.repeat(32)}`;

    const report = inspectContentMediaCanaryBootstrap(input);

    expect(report.status).toBe('blocked');
    expect(report.blocked_reasons).toEqual(
      expect.arrayContaining([
        'BLOCKED_WORKER_MUST_REMAIN_OFF_FOR_HANDOFF',
        'BLOCKED_WEB_WORKER_SHARED_CONFIGURATION_PARITY_UNPROVEN',
        'BLOCKED_PROVIDER_REGISTRY_RECEIPT_INCOMPLETE',
        'BLOCKED_TEMPORARY_HANDOFF_MUST_NOT_ASSERT_CONFIRMED_SOURCE',
      ]),
    );
  });
});
