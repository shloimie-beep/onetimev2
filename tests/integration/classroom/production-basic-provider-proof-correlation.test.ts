import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createProductionBasicHostLifecycleStore,
  productionBasicDigest,
  type ProductionBasicVerifiedZoomLifecycleEvent,
} from '../../../apps/web/src/server/features/classroom/production-basic/host-lifecycle-repository.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

const scope = { account_key: 'account-one', product_key: 'one-time' };
const meetingRefDigest = productionBasicDigest(
  'production-basic-meeting-v1',
  'production-basic-recurring-meeting',
);
const occurrenceStart = new Date('2026-08-12T16:00:00.000Z');
const browserLiveAt = new Date('2026-08-12T16:01:00.000Z');

let pool: DbPool;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  await seedCanonicalOccurrence(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('Production Basic provider-proof correlation', () => {
  it('correlates ended-before-started delivery when both precede browser lifecycle creation', async () => {
    const store = createProductionBasicHostLifecycleStore(pool);
    const ended = providerEvent('meeting_ended', 'instance-before-browser', 'ended-first', 30);
    const started = providerEvent(
      'meeting_started',
      'instance-before-browser',
      'started-second',
      0,
    );

    expect(
      (await store.recordVerifiedProviderEvent({ scope, event: ended })).cleanupTarget,
    ).toBeNull();
    expect(
      (await store.recordVerifiedProviderEvent({ scope, event: started })).cleanupTarget,
    ).toBeNull();

    await expect(
      store.createLive({
        scope,
        meetingRefDigest,
        actorUserRef: 'admin-user',
        sessionRef: 'v21-session-one',
        now: browserLiveAt,
      }),
    ).resolves.toMatchObject({ state: 'provider_ended' });

    await expect(lifecycleRow(pool)).resolves.toMatchObject({
      lifecycle_state: 'provider_ended',
      provider_meeting_instance_digest: productionBasicDigest(
        'zoom-meeting-instance-v1',
        'instance-before-browser',
      ),
    });
  });

  it('does not end a lifecycle from a different instance of the recurring meeting', async () => {
    const store = createProductionBasicHostLifecycleStore(pool);
    const live = await store.createLive({
      scope,
      meetingRefDigest,
      actorUserRef: 'admin-user',
      sessionRef: 'legacy-session-one',
      now: browserLiveAt,
    });
    expect(live?.state).toBe('live');

    await store.recordVerifiedProviderEvent({
      scope,
      event: providerEvent('meeting_started', 'bound-instance', 'bound-start', 0),
    });
    await store.recordVerifiedProviderEvent({
      scope,
      event: providerEvent('meeting_ended', 'wrong-instance', 'wrong-end', 30),
    });
    await expect(lifecycleRow(pool)).resolves.toMatchObject({ lifecycle_state: 'live' });

    await store.recordVerifiedProviderEvent({
      scope,
      event: providerEvent('meeting_ended', 'bound-instance', 'bound-end', 31),
    });
    await expect(lifecycleRow(pool)).resolves.toMatchObject({ lifecycle_state: 'provider_ended' });
  });

  it('keeps the first exact instance binding when a second instance starts', async () => {
    const store = createProductionBasicHostLifecycleStore(pool);
    await store.createLive({
      scope,
      meetingRefDigest,
      actorUserRef: 'rabbi-user',
      sessionRef: 'v21-session-rabbi',
      now: new Date('2026-08-12T15:59:00.000Z'),
    });

    await store.recordVerifiedProviderEvent({
      scope,
      event: providerEvent('meeting_started', 'first-instance', 'first-start', 0),
    });
    await store.recordVerifiedProviderEvent({
      scope,
      event: providerEvent('meeting_started', 'second-instance', 'second-start', 2),
    });

    const row = await lifecycleRow(pool);
    expect(row).toMatchObject({
      lifecycle_state: 'live',
      provider_meeting_instance_digest: productionBasicDigest(
        'zoom-meeting-instance-v1',
        'first-instance',
      ),
    });
    expect(JSON.stringify(row)).not.toContain('first-instance');
    expect(JSON.stringify(row)).not.toContain('second-instance');
  });

  it('does not correlate an instance outside the occurrence start-time window', async () => {
    const store = createProductionBasicHostLifecycleStore(pool);
    await store.createLive({
      scope,
      meetingRefDigest,
      actorUserRef: 'admin-user',
      sessionRef: 'v21-session-window',
      now: browserLiveAt,
    });
    const outsideWindow = providerEvent(
      'meeting_started',
      'outside-window-instance',
      'outside-window-start',
      0,
    );
    outsideWindow.meetingStartedAt = new Date('2026-08-12T20:00:00.000Z');
    outsideWindow.providerEventAt = outsideWindow.meetingStartedAt;
    outsideWindow.receivedAt = new Date('2026-08-12T20:00:01.000Z');

    await store.recordVerifiedProviderEvent({ scope, event: outsideWindow });

    await expect(lifecycleRow(pool)).resolves.toMatchObject({
      lifecycle_state: 'live',
      provider_meeting_instance_digest: null,
    });
    const event = await pool.query<{ occurrence_key: string | null }>(
      `SELECT occurrence_key
         FROM onetime.production_basic_zoom_lifecycle_events
        WHERE provider_event_key_digest = $1`,
      [outsideWindow.providerEventKeyDigest],
    );
    expect(event.rows[0]?.occurrence_key).toBeNull();
  });

  it('denies an exact-session lifecycle after its bounded expiry', async () => {
    const store = createProductionBasicHostLifecycleStore(pool);
    const live = await store.createLive({
      scope,
      meetingRefDigest,
      actorUserRef: 'admin-expiring',
      sessionRef: 'v21-session-expiring',
      now: browserLiveAt,
    });

    await expect(
      store.read({
        scope,
        meetingRefDigest,
        actorUserRef: 'admin-expiring',
        sessionRef: 'v21-session-expiring',
        context: live!.context!,
        now: new Date(browserLiveAt.getTime() + 2 * 60 * 60_000 + 1),
      }),
    ).resolves.toBeNull();
  });

  it('admits only one exact session when two same-user sessions race lifecycle creation', async () => {
    const store = createProductionBasicHostLifecycleStore(pool);
    const [first, second] = await Promise.all([
      store.createLive({
        scope,
        meetingRefDigest,
        actorUserRef: 'admin-racing',
        sessionRef: 'racing-session-one',
        now: browserLiveAt,
      }),
      store.createLive({
        scope,
        meetingRefDigest,
        actorUserRef: 'admin-racing',
        sessionRef: 'racing-session-two',
        now: browserLiveAt,
      }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    const winner = first ? 'racing-session-one' : 'racing-session-two';
    const loser = first ? 'racing-session-two' : 'racing-session-one';
    await expect(
      store.read({
        scope,
        meetingRefDigest,
        actorUserRef: 'admin-racing',
        sessionRef: winner,
        context: (first ?? second)!.context!,
        now: browserLiveAt,
      }),
    ).resolves.toMatchObject({ state: 'live' });
    await expect(
      store.read({
        scope,
        meetingRefDigest,
        actorUserRef: 'admin-racing',
        sessionRef: loser,
        context: (first ?? second)!.context!,
        now: browserLiveAt,
      }),
    ).resolves.toBeNull();
  });
});

function providerEvent(
  eventType: ProductionBasicVerifiedZoomLifecycleEvent['eventType'],
  instance: string,
  eventKey: string,
  minuteOffset: number,
): ProductionBasicVerifiedZoomLifecycleEvent {
  const providerEventAt = new Date(occurrenceStart.getTime() + minuteOffset * 60_000);
  return {
    providerEventKeyDigest: productionBasicDigest('zoom-provider-event-v1', eventKey),
    providerAccountRefDigest: productionBasicDigest('zoom-account-v1', 'zoom-account'),
    providerHostRefDigest: productionBasicDigest('zoom-host-v1', 'zoom-host'),
    meetingRefDigest,
    meetingInstanceDigest: productionBasicDigest('zoom-meeting-instance-v1', instance),
    eventType,
    providerEventAt,
    meetingStartedAt: occurrenceStart,
    meetingEndedAt: eventType === 'meeting_ended' ? providerEventAt : null,
    receivedAt: new Date(providerEventAt.getTime() + 1_000),
  };
}

async function seedCanonicalOccurrence(db: DbPool) {
  await db.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status, series_state, is_canonical, recurrence_weekdays,
        recurrence_starts_on, duration_minutes, embedded_classroom_required, recording_enabled)
     VALUES ('production-basic-canonical', $1, $2, 'Canonical Class',
             'Asia/Jerusalem', '19:00', '18:30', 'active', 'active', true,
             ARRAY[1,2,3,4,5]::smallint[], DATE '2026-08-12', 60, true, false)`,
    [scope.account_key, scope.product_key],
  );
  await db.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, join_opens_at,
        join_closes_at, scheduled_ends_at)
     VALUES ('production-basic-current', $1, $2, 'production-basic-canonical',
             DATE '2026-08-12', $3, '2026-08-12T15:30:00.000Z',
             '2026-08-12T17:15:00.000Z', 'scheduled', '2026-08-12T15:50:00.000Z',
             '2026-08-12T17:15:00.000Z', '2026-08-12T17:00:00.000Z')`,
    [scope.account_key, scope.product_key, occurrenceStart],
  );
}

async function lifecycleRow(db: DbPool) {
  const result = await db.query<{
    lifecycle_state: string;
    provider_meeting_instance_digest: string | null;
  }>(
    `SELECT lifecycle_state, provider_meeting_instance_digest
       FROM onetime.production_basic_host_lifecycles
      WHERE account_key = $1 AND product_key = $2`,
    [scope.account_key, scope.product_key],
  );
  return result.rows[0];
}
