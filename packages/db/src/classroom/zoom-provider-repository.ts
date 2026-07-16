import type { Queryable } from '../index.ts';
import type { ZoomRegistrantRecord } from '../../../domain/src/providers/zoom-rest.ts';
import type { ZoomWebhookAttendanceProjection } from '../../../domain/src/providers/zoom-webhook.ts';

export async function recordZoomRegistrantResolution(
  db: Queryable,
  input: {
    accountKey: string;
    productKey: string;
    householdKey: string;
    occurrenceKey: string;
    registrant: ZoomRegistrantRecord;
  },
) {
  await db.query(
    `INSERT INTO onetime.classroom_zoom_registrants
       (account_key, product_key, household_key, learner_key, occurrence_key,
        provider_meeting_ref_digest, provider_occurrence_id, provider_registrant_ref_digest,
        registrant_token_ref, join_url_digest)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (account_key, product_key, learner_key, occurrence_key)
     DO UPDATE SET provider_registrant_ref_digest = EXCLUDED.provider_registrant_ref_digest,
                   registrant_token_ref = EXCLUDED.registrant_token_ref,
                   join_url_digest = EXCLUDED.join_url_digest,
                   updated_at = now()`,
    [
      input.accountKey,
      input.productKey,
      input.householdKey,
      input.registrant.learner_key,
      input.occurrenceKey,
      input.registrant.meeting_id_digest,
      input.registrant.occurrence_id,
      input.registrant.registrant_id_digest,
      input.registrant.registrant_token_ref,
      input.registrant.join_url_digest,
    ],
  );
}

export async function recordZoomWebhookProjection(
  db: Queryable,
  input: {
    accountKey: string;
    productKey: string;
    projection: ZoomWebhookAttendanceProjection;
  },
) {
  const inserted = await db.query(
    `INSERT INTO onetime.classroom_zoom_webhook_events
       (event_key, account_key, product_key, event_type, meeting_id_digest,
        meeting_uuid_digest, provider_occurrence_id, provider_registrant_ref_digest,
        participant_user_ref_digest, attendance_state, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (account_key, product_key, event_key) DO NOTHING`,
    [
      input.projection.event_key,
      input.accountKey,
      input.productKey,
      input.projection.event_type,
      input.projection.meeting_id_digest,
      input.projection.meeting_uuid_digest,
      input.projection.occurrence_id,
      input.projection.registrant_id_digest,
      input.projection.participant_user_id_digest,
      input.projection.attendance_state,
      input.projection.occurred_at,
    ],
  );
  if ((inserted.rowCount ?? 0) < 1) return { duplicate: true };
  await db.query(
    `INSERT INTO onetime.classroom_zoom_attendance_projection
       (projection_key, account_key, product_key, meeting_uuid_digest,
        provider_occurrence_id, provider_registrant_ref_digest, attendance_state, last_event_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (account_key, product_key, meeting_uuid_digest, provider_occurrence_id,
                  provider_registrant_ref_digest)
     DO UPDATE SET attendance_state = EXCLUDED.attendance_state,
                   last_event_at = EXCLUDED.last_event_at,
                   updated_at = now()`,
    [
      input.projection.event_key.replace('zoom_webhook_event_', 'zoom_attendance_projection_'),
      input.accountKey,
      input.productKey,
      input.projection.meeting_uuid_digest,
      input.projection.occurrence_id,
      input.projection.registrant_id_digest,
      input.projection.attendance_state,
      input.projection.occurred_at,
    ],
  );
  return { duplicate: false };
}
