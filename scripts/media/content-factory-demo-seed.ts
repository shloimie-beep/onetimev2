import 'dotenv/config';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import { createAccountUser } from '../../packages/domain/src/auth/service.ts';
import {
  ingestContentFactoryItem,
  performContentFactoryAction,
} from '../../packages/domain/src/content/content-factory.ts';
import { learningDeliverySha256Hex } from '../../packages/domain/src/content/learning-delivery.ts';
import { assertReviewedStagingRuntime, grantBoundedFreePilotAccess } from '../access/free-pilot.ts';

const config = loadConfig(process.env);
assertReviewedStagingRuntime(
  config,
  'content_factory_demo_seed_forbidden_outside_reviewed_staging',
);
const demoPassword = process.env.CONTENT_FACTORY_DEMO_PASSWORD?.trim();
if (!demoPassword) {
  throw new Error('content_factory_demo_password_required');
}

const pool = createPgPool(config);
const sourceKey = 'ot_launch_01_demo_hashavas_aveidah';
const segments = [
  {
    start_ms: 0,
    end_ms: 12_000,
    text: 'The class reads a fictional Mishnah review about returning a lost object.',
  },
  {
    start_ms: 12_000,
    end_ms: 25_000,
    text: 'Students identify a unique mark as a sign the owner can describe.',
  },
  {
    start_ms: 25_000,
    end_ms: 39_000,
    text: 'The teacher asks why an ordinary color may not identify the owner.',
  },
  {
    start_ms: 39_000,
    end_ms: 52_000,
    text: 'The class compares an identifiable bundle with loose identical objects.',
  },
  {
    start_ms: 52_000,
    end_ms: 65_000,
    text: 'Students review that an announcement invites the owner to provide the sign.',
  },
  {
    start_ms: 65_000,
    end_ms: 78_000,
    text: 'The lesson closes by repeating that this is a classroom review, not a ruling.',
  },
];
const normalizedTranscript = segments.map((segment) => segment.text).join(' ');
const webvtt = `WEBVTT

00:00:00.000 --> 00:00:12.000
The class reads a fictional Mishnah review about returning a lost object.

00:00:12.000 --> 00:00:25.000
Students identify a unique mark as a sign the owner can describe.

00:00:25.000 --> 00:00:39.000
The teacher asks why an ordinary color may not identify the owner.

00:00:39.000 --> 00:00:52.000
The class compares an identifiable bundle with loose identical objects.

00:00:52.000 --> 00:01:05.000
Students review that an announcement invites the owner to provide the sign.

00:01:05.000 --> 00:01:18.000
The lesson closes by repeating that this is a classroom review, not a ruling.
`;

try {
  const actorUserKey = await createAccountUser({
    pool,
    config,
    email: 'ot-launch-01-admin@example.test',
    password: demoPassword,
    displayName: 'OT-LAUNCH-01 Demo Admin',
    role: 'owner',
  });
  const studentUserKey = await createAccountUser({
    pool,
    config,
    email: 'ot-launch-01-student@example.test',
    password: demoPassword,
    displayName: 'OT-LAUNCH-01 Demo Student',
    role: 'student',
  });
  await seedOtLaunchHousehold(studentUserKey);

  await ingestContentFactoryItem({
    pool,
    config,
    item: {
      sourceKey,
      sourceKind: 'local_drop',
      sourceRefDigest: learningDeliverySha256Hex('ot-launch-01-synthetic-private-source-ref'),
      sourceSha256: learningDeliverySha256Hex('ot-launch-01-synthetic-video-bytes'),
      displayName: 'ot-launch-01-approved-synthetic-demo.mp4',
      mimeType: 'video/mp4',
      byteLength: 1_048_576,
      originalDurationMs: 90_000,
      preparedDurationMs: 78_000,
      trimStartMs: 6_000,
      trimEndMs: 84_000,
      removedStartMs: 6_000,
      removedEndMs: 6_000,
      trimConfidence: 0.92,
      transcriptSegments: segments.map((segment, index) => ({
        segment_id: `ot_launch_01_demo_segment_${index + 1}`,
        ...segment,
      })),
      normalizedTranscript,
      transcriptSha256: learningDeliverySha256Hex(normalizedTranscript),
      webvtt,
      webvttSha256: learningDeliverySha256Hex(webvtt),
      transcriptionModel: 'synthetic-demo-no-provider',
      transcriptionLanguage: 'en',
      draft: {
        title: '[Demo] Hashavas Aveidah: Signs and Announcements',
        short_description:
          'An approved synthetic review lesson about identifying a lost object and the purpose of an announcement.',
        class_label: 'OT-LAUNCH-01 Mishnayos',
        class_date: '2026-07-22',
        topics: ['Lost objects', 'Identifying signs', 'Announcements'],
        mishnah_terms: ['Mishnah', 'Hashavas Aveidah', 'Siman'],
        review_questions: [
          'What kind of mark did the fictional class describe as useful identification?',
          'Why might an ordinary color be insufficient to identify the owner?',
          'What comparison did the class make between a bundle and loose objects?',
          'What information should the owner provide after an announcement?',
          'How did the lesson distinguish classroom review from an authoritative ruling?',
        ],
        key_takeaways: [
          'The fictional lesson used a unique mark as an example of identification.',
          'The class compared identifiable bundles with loose identical objects.',
          'The transcript explicitly labels the material as review rather than a ruling.',
        ],
        vocabulary: [
          {
            term: 'Siman',
            transcript_context: 'Students identify a unique mark as a sign the owner can describe.',
          },
          {
            term: 'Hashavas Aveidah',
            transcript_context: 'The class reviews the topic of returning a lost object.',
          },
        ],
        draft_only: true,
        authoritative_torah_interpretation: false,
      },
      providerVideoId: 'synthetic_demo_no_provider_resource',
      providerEmbedUrl: 'https://player.vimeo.com/video/synthetic_demo_no_provider_resource',
      providerTextTrackId: 'synthetic_demo_caption_track',
      vimeoPrivacy: 'private',
      captionsActive: true,
    },
  });
  await performContentFactoryAction({
    pool,
    config,
    sourceKey,
    actorUserKey,
    actorRole: 'owner',
    action: 'approve',
  });
  const published = await performContentFactoryAction({
    pool,
    config,
    sourceKey,
    actorUserKey,
    actorRole: 'owner',
    action: 'publish',
  });
  process.stdout.write(
    `${JSON.stringify({
      success: true,
      source_key: published.source_key,
      state: published.state,
      is_demo: published.is_demo,
      captions_active: published.vimeo.captions_active,
      raw_provider_url_present: false,
    })}\n`,
  );
} finally {
  await pool.end();
}

async function seedOtLaunchHousehold(studentUserKey: string) {
  const accessNow = new Date();
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status)
     VALUES ('ot_launch_01_household', $1, $2, 'OT-LAUNCH-01 Demo Household', 'active')
     ON CONFLICT (household_key) DO UPDATE SET display_name = EXCLUDED.display_name,
       status = 'active', updated_at = now()`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label,
        learner_status)
     VALUES ('ot_launch_01_student', $1, $2, 'ot_launch_01_household',
       'Ari — Demo Student', '6', 'active')
     ON CONFLICT (learner_key) DO UPDATE SET display_name = EXCLUDED.display_name,
       grade_label = EXCLUDED.grade_label, learner_status = 'active', updated_at = now()`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key,
        student_user_ref, status)
     VALUES ('ot_launch_01_student_access', $1, $2, 'ot_launch_01_household',
       'ot_launch_01_student', $3, 'active')
     ON CONFLICT (access_state_key) DO UPDATE SET student_user_ref = EXCLUDED.student_user_ref,
       status = 'active', updated_at = now()`,
    [config.accountKey, config.productKey, studentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key, link_state)
     VALUES ('ot_launch_01_student_link', $1, $2, 'ot_launch_01_household',
       'ot_launch_01_student', $3, 'active')
     ON CONFLICT (link_key) DO UPDATE SET user_key = EXCLUDED.user_key, link_state = 'active',
       suspended_at = NULL, disabled_at = NULL`,
    [config.accountKey, config.productKey, studentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_household_entitlements
       (entitlement_key, account_key, product_key, household_key, entitlement_state, source,
        policy_version)
     VALUES ('ot_launch_01_classroom_entitlement', $1, $2, 'ot_launch_01_household',
       'active', 'isolated_demo_seed', 'ot-launch-01-demo-v1')
     ON CONFLICT (entitlement_key) DO UPDATE SET entitlement_state = 'active',
       source = EXCLUDED.source, policy_version = EXCLUDED.policy_version, updated_at = now()`,
    [config.accountKey, config.productKey],
  );
  const access = await grantBoundedFreePilotAccess({
    pool,
    config,
    householdKey: 'ot_launch_01_household',
    actorKind: 'provisioner',
    idempotencyKey: `ot-launch-01-demo-free-pilot-${accessNow.getTime()}`,
    expiresAt: new Date(accessNow.getTime() + 90 * 24 * 60 * 60 * 1000),
    policyVersion: 'ot-launch-01-demo-access-v1',
    opaqueSourceReference: 'ot_launch_01_demo_free_pilot_v1',
    now: accessNow,
  });
  if (!access.projection.grants_access) {
    throw new Error('content_factory_demo_access_not_granted');
  }
  await pool.query(
    `WITH updated AS (
       UPDATE onetime.class_series
          SET title = 'OT-LAUNCH-01 Mishnayos', status = 'active', updated_at = now()
        WHERE account_key = $1 AND product_key = $2
          AND class_series_key = 'ot_launch_01_class'
       RETURNING 1
     )
     INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time)
     SELECT 'ot_launch_01_class', $1, $2, 'OT-LAUNCH-01 Mishnayos', 'Asia/Jerusalem',
       '19:00', '18:30'
      WHERE NOT EXISTS (SELECT 1 FROM updated)`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `WITH updated AS (
       UPDATE onetime.class_occurrences
          SET occurrence_state = 'scheduled', access_state = 'provider_unavailable',
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2
          AND occurrence_key = 'ot_launch_01_class_2026_07_22'
       RETURNING 1
     )
     INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date, starts_at,
        reminder_due_at, joinable_until, occurrence_state, access_state)
     SELECT 'ot_launch_01_class_2026_07_22', $1, $2, 'ot_launch_01_class', '2026-07-22',
       '2026-07-22T16:00:00.000Z', '2026-07-22T15:30:00.000Z',
       '2026-07-22T17:30:00.000Z', 'scheduled', 'provider_unavailable'
      WHERE NOT EXISTS (SELECT 1 FROM updated)`,
    [config.accountKey, config.productKey],
  );
}
