import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import {
  ot86ApprovedForSocialEventSchema,
  ot86ContentPublishManifestSchema,
} from '../../../packages/contracts/src/content/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  Ot86ContentPipelineError,
  applyNextOt86Publication,
  approveOt86ContentVersion,
  createOt86CandidateVersion,
  createOt86ContentItem,
  emitOt86ApprovedForSocialEvent,
  receiveOt86PublicationManifest,
  recordOt86ProviderEventReceipt,
  retrieveOt86ApprovedContent,
  sanitizeOt86ProviderError,
  signOt86Manifest,
  transitionOt86ContentState,
  validateOt86ManifestChecksum,
  withOt86ManifestChecksum,
  type Ot86SigningSecret,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
const secret: Ot86SigningSecret = {
  keyId: 'ot86-key-current',
  secret: 'test-only-ot86-signing-secret-with-at-least-32-chars',
};

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    OT86_PUBLISH_SIGNING_KEY_ID: secret.keyId,
    OT86_PUBLISH_SIGNING_SECRET: secret.secret,
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-86A contract schemas', () => {
  it('accepts valid packet fixtures and rejects learner/private-data fixtures', async () => {
    const fixtureRoot = path.resolve('contracts/content-pipeline/v1/fixtures');
    const validManifest = JSON.parse(
      await readFile(path.join(fixtureRoot, 'content-publish-manifest.valid.json'), 'utf8'),
    ) as unknown;
    const revokeManifest = JSON.parse(
      await readFile(path.join(fixtureRoot, 'content-publish-manifest.revoke.valid.json'), 'utf8'),
    ) as unknown;
    const invalidManifest = JSON.parse(
      await readFile(
        path.join(fixtureRoot, 'content-publish-manifest.learner-data.invalid.json'),
        'utf8',
      ),
    ) as unknown;
    const validSocial = JSON.parse(
      await readFile(path.join(fixtureRoot, 'content-approved-for-social.valid.json'), 'utf8'),
    ) as unknown;
    const invalidSocial = JSON.parse(
      await readFile(
        path.join(fixtureRoot, 'content-approved-for-social.learner-face.invalid.json'),
        'utf8',
      ),
    ) as unknown;

    expect(ot86ContentPublishManifestSchema.safeParse(validManifest).success).toBe(true);
    expect(ot86ContentPublishManifestSchema.safeParse(revokeManifest).success).toBe(true);
    expect(ot86ContentPublishManifestSchema.safeParse(invalidManifest).success).toBe(false);
    expect(ot86ApprovedForSocialEventSchema.safeParse(validSocial).success).toBe(true);
    expect(ot86ApprovedForSocialEventSchema.safeParse(invalidSocial).success).toBe(false);
  });
});

describe('OT-86A signed publication inbox and One Time local projection', () => {
  it('authenticates raw bytes, records durable receipts, and handles replay/conflict safely', async () => {
    const rawBody = signedRawBody(baseManifest());
    const headers = signedHeaders(rawBody);

    const badSignature = await receiveOt86PublicationManifest({
      pool,
      rawBody,
      headers: {
        ...headers,
        signature: 'v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(badSignature.status).toBe(401);
    expect(await countRows('onetime.ot86_publication_inbox_receipts')).toBe(0);

    const accepted = await receiveOt86PublicationManifest({
      pool,
      rawBody,
      headers,
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(accepted).toMatchObject({ status: 202, receipt_state: 'queued' });

    const duplicate = await receiveOt86PublicationManifest({
      pool,
      rawBody,
      headers,
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(duplicate).toMatchObject({ status: 200, receipt_state: 'duplicate' });

    const changed = signedRawBody(
      baseManifest({
        canonical_path: '/library/classes/cnt_01J00000000000000000000000-v2',
      }),
    );
    const conflict = await receiveOt86PublicationManifest({
      pool,
      rawBody: changed,
      headers: {
        ...headers,
        signature: signOt86Manifest({
          keyId: secret.keyId,
          secret: secret.secret,
          timestamp: headers.timestamp,
          rawBody: changed,
        }),
      },
      secrets: [secret],
      now: new Date(Number(headers.timestamp) * 1000),
    });
    expect(conflict).toMatchObject({ status: 409, receipt_state: 'conflict' });
    expect(await countRows('onetime.ot86_publication_inbox_receipts')).toBe(1);
  });

  it('applies publish, correct, revoke, and retrieval without a BNA runtime dependency', async () => {
    await receiveSigned(baseManifest());
    expect(await applyNextOt86Publication({ pool })).toMatchObject({
      applied: true,
      action: 'publish',
    });

    const supported = await retrieveOt86ApprovedContent({
      pool,
      tenantId: 'tenant_demo_001',
      principalId: 'student_alpha',
      entitlementContentIds: ['cnt_01J00000000000000000000000'],
      question: 'What is the opening idea?',
      correlationId: 'corr_retrieval_supported_001',
    });
    expect(supported.abstained).toBe(false);
    expect(supported.citations).toHaveLength(1);
    expect(supported.citations[0]?.deep_link).toContain('#section-');

    const denied = await retrieveOt86ApprovedContent({
      pool,
      tenantId: 'tenant_demo_001',
      principalId: 'student_beta',
      entitlementContentIds: [],
      question: 'What is the opening idea?',
      correlationId: 'corr_retrieval_denied_001',
    });
    expect(denied).toMatchObject({ abstained: true, safe_reason_code: 'not_entitled' });

    const otherTenant = await retrieveOt86ApprovedContent({
      pool,
      tenantId: 'tenant_other_001',
      principalId: 'student_alpha',
      entitlementContentIds: ['cnt_01J00000000000000000000000'],
      question: 'What is the opening idea?',
      correlationId: 'corr_retrieval_other_tenant_001',
    });
    expect(otherTenant).toMatchObject({ abstained: true });

    const audit = await pool.query(`SELECT * FROM onetime.ot86_retrieval_audit_events`);
    expect(JSON.stringify(audit.rows)).not.toMatch(/opening idea|What is/i);

    await receiveSigned(
      baseManifest({
        message_id: '22222222-2222-4222-8222-222222222222',
        idempotency_key: 'tenant_demo_001:cnt_01J00000000000000000000000:2:correct',
        action: 'correct',
        version_id: 'ver_01J00000000000000000000001',
        supersedes_version_id: 'ver_01J00000000000000000000000',
        sequence: 2,
        sections: [
          {
            section_id: 'section_002',
            title: 'Corrected opening idea',
            ordinal: 0,
            start_ms: 0,
            end_ms: 90000,
            canonical_path: '/library/classes/cnt_01J00000000000000000000000',
            deep_link: '/library/classes/cnt_01J00000000000000000000000#section-section_002',
            text_sha256: digest('Corrected opening idea'),
          },
        ],
        search_documents: [
          {
            document_id: 'document_002',
            section_id: 'section_002',
            title: 'Corrected opening idea',
            body: 'Corrected approved Rabbi class material about careful review.',
            token_count: 8,
            sha256: digest('Corrected approved Rabbi class material about careful review.'),
          },
        ],
      }),
    );
    expect(await applyNextOt86Publication({ pool })).toMatchObject({
      applied: true,
      action: 'correct',
    });

    const correctedRows = await pool.query(
      `SELECT version_id, active_state
         FROM onetime.ot86_published_content_versions
        WHERE tenant_id = 'tenant_demo_001'
        ORDER BY sequence`,
    );
    expect(correctedRows.rows.map((row) => `${row.version_id}:${row.active_state}`)).toEqual([
      'ver_01J00000000000000000000000:corrected',
      'ver_01J00000000000000000000001:active',
    ]);

    await receiveSigned(
      baseManifest({
        message_id: '33333333-3333-4333-8333-333333333333',
        idempotency_key: 'tenant_demo_001:cnt_01J00000000000000000000000:3:revoke',
        action: 'revoke',
        version_id: 'ver_01J00000000000000000000001',
        sequence: 3,
        canonical_path: undefined,
        artifacts: [],
        sections: [],
        search_documents: [],
      }),
    );
    expect(await applyNextOt86Publication({ pool })).toMatchObject({
      applied: true,
      action: 'revoke',
    });
    const revoked = await retrieveOt86ApprovedContent({
      pool,
      tenantId: 'tenant_demo_001',
      principalId: 'student_alpha',
      entitlementContentIds: ['cnt_01J00000000000000000000000'],
      question: 'careful review',
      correlationId: 'corr_retrieval_revoked_001',
    });
    expect(revoked).toMatchObject({ abstained: true, safe_reason_code: 'unsupported' });
  });
});

describe('OT-86A state machine, approval immutability, social event, and provider replay', () => {
  it('enforces central states, privacy approval gates, immutable versions, and social outbox', async () => {
    await createOt86ContentItem({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      sourceRecordId: 'drive_file_001',
      sourceKind: 'rabbi_class',
      originalName: 'class.mp4',
      sourceSha256: digest('source bytes'),
      byteLength: 100,
      originService: 'bna_drive',
      submittingActorId: 'actor_admin_001',
      correlationId: 'corr_source_001',
    });

    await expect(
      transitionOt86ContentState({
        pool,
        tenantId: 'tenant_demo_001',
        contentId: 'cnt_state_001',
        nextState: 'approved',
        actorId: 'actor_admin_001',
        actorType: 'operator',
        reasonCode: 'invalid_jump',
        correlationId: 'corr_invalid_jump',
      }),
    ).rejects.toBeInstanceOf(Ot86ContentPipelineError);

    await transitionOt86ContentState({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      nextState: 'transcribing',
      actorId: 'svc_pipeline',
      actorType: 'service',
      reasonCode: 'manual_reference_validated',
      correlationId: 'corr_transcribing_001',
    });
    await transitionOt86ContentState({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      nextState: 'processing',
      actorId: 'svc_pipeline',
      actorType: 'service',
      reasonCode: 'transcript_ready',
      correlationId: 'corr_processing_001',
    });
    await transitionOt86ContentState({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      nextState: 'review_needed',
      actorId: 'svc_pipeline',
      actorType: 'service',
      reasonCode: 'candidate_ready',
      correlationId: 'corr_review_001',
    });

    await createOt86CandidateVersion({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      versionId: 'ver_privacy_blocked_001',
      revisionNumber: 1,
      metadata: { title: 'Blocked' },
      sections: [{ section_id: 'section_blocked', title: 'Blocked' }],
      artifacts: [],
      searchDocuments: [],
      privacy: {
        containsLearnerName: true,
        approvedForStudentKb: true,
      },
    });
    await expect(
      approveOt86ContentVersion({
        pool,
        tenantId: 'tenant_demo_001',
        contentId: 'cnt_state_001',
        versionId: 'ver_privacy_blocked_001',
        approvalId: 'approval_blocked_001',
        approvedByActorId: 'actor_admin_001',
        policyVersion: 'ot86-privacy-v1',
        correlationId: 'corr_approve_blocked',
      }),
    ).rejects.toMatchObject({ code: 'PRIVACY_ATTESTATION_FAILED' });

    await createOt86CandidateVersion({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      versionId: 'ver_approved_001',
      revisionNumber: 2,
      metadata: { title: 'Approved class', summary: 'Approved social excerpt.' },
      sections: [{ section_id: 'section_approved', title: 'Approved class' }],
      artifacts: [],
      searchDocuments: [],
      privacy: {
        approvedForStudentKb: true,
        approvedForSocial: true,
      },
    });
    await approveOt86ContentVersion({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      versionId: 'ver_approved_001',
      approvalId: 'approval_approved_001',
      approvedByActorId: 'actor_admin_001',
      policyVersion: 'ot86-privacy-v1',
      approvedForSocial: true,
      correlationId: 'corr_approve_001',
    });
    await expect(
      approveOt86ContentVersion({
        pool,
        tenantId: 'tenant_demo_001',
        contentId: 'cnt_state_001',
        versionId: 'ver_approved_001',
        approvalId: 'approval_approved_002',
        approvedByActorId: 'actor_admin_001',
        policyVersion: 'ot86-privacy-v1',
        approvedForSocial: true,
        correlationId: 'corr_approve_again',
      }),
    ).rejects.toMatchObject({ code: 'VERSION_IMMUTABLE' });

    const event = await emitOt86ApprovedForSocialEvent({
      pool,
      tenantId: 'tenant_demo_001',
      contentId: 'cnt_state_001',
      versionId: 'ver_approved_001',
      canonicalUrl: 'https://join.onetimeonetime.com/library/classes/cnt_state_001',
      eventId: '44444444-4444-4444-8444-444444444444',
      sequence: 1,
    });
    expect(event.event_type).toBe('content.approved_for_social');
    expect(event.privacy).toMatchObject({
      contains_learner_name: false,
      contains_learner_voice: false,
      contains_learner_face: false,
      contains_learner_question: false,
      contains_private_data: false,
    });
    expect(JSON.stringify(event)).not.toMatch(/secret|token|password|private note/i);
    expect(await countRows('onetime.ot86_publication_outbox')).toBe(1);
  });

  it('dedupes provider webhook receipts and redacts hostile provider errors', async () => {
    const first = await recordOt86ProviderEventReceipt({
      pool,
      providerEventId: 'evt_vimeo_001',
      rawBody: '{"status":"complete"}',
      normalizedEventType: 'video_available',
      normalizedEventKey: 'vimeo:video:123:complete',
    });
    const duplicate = await recordOt86ProviderEventReceipt({
      pool,
      providerEventId: 'evt_vimeo_001',
      rawBody: '{"status":"complete"}',
      normalizedEventType: 'video_available',
      normalizedEventKey: 'vimeo:video:123:complete',
    });
    const conflict = await recordOt86ProviderEventReceipt({
      pool,
      providerEventId: 'evt_vimeo_001',
      rawBody: '{"status":"changed"}',
      normalizedEventType: 'video_available',
      normalizedEventKey: 'vimeo:video:123:complete',
    });

    expect(first).toMatchObject({ recorded: true, conflict: false });
    expect(duplicate).toMatchObject({ recorded: false, duplicate: true });
    expect(conflict).toMatchObject({ recorded: false, conflict: true });
    const bearerCredential = ['abcdefghijklmnopqrstuvwxyz', '123456'].join('');
    const clientSecret = ['super', 'secret', 'value'].join('');
    expect(
      sanitizeOt86ProviderError(
        `Provider failed with Authorization: Bearer ${bearerCredential} and client_secret=${clientSecret}`,
      ),
    ).not.toMatch(/abcdefghijklmnopqrstuvwxyz|supersecretvalue/);
  });
});

describe('OT-86A internal HTTP endpoint', () => {
  it('records a signed manifest through the raw-byte Express route without requiring a user session', async () => {
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const rawBody = signedRawBody(
        baseManifest({
          message_id: '55555555-5555-4555-8555-555555555555',
          idempotency_key: 'tenant_demo_001:cnt_http_001:1:publish',
          content_id: 'cnt_http_001',
          version_id: 'ver_http_001',
        }),
      );
      const timestamp = String(Math.floor(Date.now() / 1000));
      const response = await fetch(`${server.baseUrl}/internal/content-publications/v1/manifests`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ot86-key-id': secret.keyId,
          'x-ot86-timestamp': timestamp,
          'x-ot86-delivery-id': '55555555-5555-4555-8555-555555555555',
          'x-ot86-signature': signOt86Manifest({
            keyId: secret.keyId,
            secret: secret.secret,
            timestamp,
            rawBody,
          }),
        },
        body: rawBody,
      });
      expect(response.status).toBe(202);
      expect(await countRows('onetime.ot86_publication_inbox_receipts')).toBe(1);
    } finally {
      await server.close();
    }
  });
});

function baseManifest(overrides: Record<string, unknown> = {}) {
  const body =
    'The opening idea is a deterministic approved Rabbi class excerpt used only as a schema fixture.';
  return withOt86ManifestChecksum({
    schema_version: 1,
    event_type: 'content.publication_manifest',
    message_id: '11111111-1111-4111-8111-111111111111',
    idempotency_key: 'tenant_demo_001:cnt_01J00000000000000000000000:1:publish',
    action: 'publish',
    tenant_id: 'tenant_demo_001',
    content_id: 'cnt_01J00000000000000000000000',
    version_id: 'ver_01J00000000000000000000000',
    sequence: 1,
    occurred_at: '2026-01-02T03:04:05Z',
    canonical_path: '/library/classes/cnt_01J00000000000000000000000',
    approval: {
      approval_id: 'approval_01J0000000000000000000',
      approved_by_actor_id: 'actor_rabbi_001',
      approved_at: '2026-01-02T03:00:00Z',
      policy_version: 'ot86-privacy-v1',
    },
    source: {
      source_kind: 'rabbi_class',
      bna_record_id: 'bna_class_0001',
      source_sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      vimeo_reference: {
        provider: 'vimeo',
        video_id: '987654321',
        reference_mode: 'manual_approved_reference',
      },
    },
    artifacts: [
      {
        artifact_id: 'artifact_video_001',
        kind: 'video',
        uri: 'https://objects.example.invalid/ot86/video-001',
        mime_type: 'video/mp4',
        sha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        byte_length: 1048576,
        privacy: manifestPrivacy(),
      },
    ],
    sections: [
      {
        section_id: 'section_001',
        title: 'Opening idea',
        ordinal: 0,
        start_ms: 0,
        end_ms: 90000,
        canonical_path: '/library/classes/cnt_01J00000000000000000000000',
        deep_link: '/library/classes/cnt_01J00000000000000000000000#section-section_001',
        text_sha256: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      },
    ],
    search_documents: [
      {
        document_id: 'document_001',
        section_id: 'section_001',
        title: 'Opening idea',
        body,
        token_count: 13,
        sha256: digest(body),
      },
    ],
    privacy: manifestPrivacy(),
    checksum_algorithm: 'sha256',
    ...overrides,
  });
}

function manifestPrivacy() {
  return {
    source_scope: 'approved_rabbi_content',
    contains_learner_name: false,
    contains_learner_voice: false,
    contains_learner_face: false,
    contains_learner_question: false,
    contains_private_data: false,
    approved_for_student_kb: true,
  } as const;
}

function signedRawBody(manifest: ReturnType<typeof baseManifest>) {
  expect(validateOt86ManifestChecksum(manifest)).toBe(true);
  return Buffer.from(JSON.stringify(manifest), 'utf8');
}

function signedHeaders(rawBody: Buffer) {
  const timestamp = '1767227045';
  const manifest = JSON.parse(rawBody.toString('utf8')) as { message_id: string };
  return {
    contentType: 'application/json',
    keyId: secret.keyId,
    timestamp,
    deliveryId: manifest.message_id,
    signature: signOt86Manifest({
      keyId: secret.keyId,
      secret: secret.secret,
      timestamp,
      rawBody,
    }),
  };
}

async function receiveSigned(manifest: ReturnType<typeof baseManifest>) {
  const rawBody = signedRawBody(manifest);
  const headers = signedHeaders(rawBody);
  return receiveOt86PublicationManifest({
    pool,
    rawBody,
    headers,
    secrets: [secret],
    now: new Date(Number(headers.timestamp) * 1000),
  });
}

async function countRows(table: string) {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
