import 'dotenv/config';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import {
  ingestContentFactoryItem,
  performContentFactoryAction,
} from '../../packages/domain/src/content/content-factory.ts';
import { learningDeliverySha256Hex } from '../../packages/domain/src/content/learning-delivery.ts';

const config = loadConfig(process.env);
if (config.deliveryEnvironment === 'production') {
  throw new Error('content_factory_demo_seed_forbidden_in_production');
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
  const actor = await pool.query(
    `SELECT user_key FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND role IN ('owner', 'admin')
        AND status = 'active'
      ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`,
    [config.accountKey, config.productKey],
  );
  const actorUserKey = String(actor.rows[0]?.user_key ?? '');
  if (!actorUserKey) throw new Error('content_factory_demo_seed_admin_required');

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
