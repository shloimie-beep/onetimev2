import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import {
  ADMIN_QUICK_ACTIONS,
  ADMIN_OPERATIONAL_VIEWS,
  type AdminDashboardSnapshot,
  type AdminOperationsReadRepository,
  type AdminOperationsScope,
  type AdminProviderHealth,
  type AdminSearchKind,
  type AdminSearchPage,
  type AdminSearchRequest,
  type AdminSearchResult,
  type AdminTargetAuthorization,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';

type Row = Record<string, unknown>;

export class PostgresAdminOperationsRepository implements AdminOperationsReadRepository {
  constructor(
    private readonly pool: DbPool,
    private readonly config: Pick<AppConfig, 'accountKey' | 'productKey'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async readDashboard(scope: AdminOperationsScope): Promise<AdminDashboardSnapshot> {
    const observedNow = this.now();
    const windowStartedAt = new Date(observedNow.getTime() - 24 * 60 * 60 * 1000);
    const params = [this.config.accountKey, this.config.productKey];
    const [occurrences, attention, content, people, activity, providers, queue] = await Promise.all(
      [
        this.pool.query(
          `SELECT occurrences.occurrence_key, occurrences.class_series_key,
                series.title, occurrences.starts_at, occurrences.occurrence_state,
                occurrences.access_state
           FROM onetime.class_occurrences AS occurrences
           JOIN onetime.class_series AS series
             ON series.account_key = occurrences.account_key
            AND series.product_key = occurrences.product_key
            AND series.class_series_key = occurrences.class_series_key
          WHERE occurrences.account_key = $1
            AND occurrences.product_key = $2
            AND occurrences.occurrence_state NOT IN ('completed', 'cancelled')
            AND occurrences.joinable_until >= now()
          ORDER BY occurrences.starts_at ASC, occurrences.occurrence_key ASC
          LIMIT 2`,
          params,
        ),
        this.pool.query(
          `SELECT
           (SELECT count(*)::int
              FROM onetime.account_access_projections
             WHERE account_key = $1 AND product_key = $2
               AND state IN ('pending', 'suspended', 'revoked', 'manual_review'))
             AS access_or_billing,
           (SELECT count(*)::int
              FROM onetime.class_occurrences
             WHERE account_key = $1 AND product_key = $2
               AND occurrence_state NOT IN ('completed', 'cancelled')
               AND joinable_until >= now()
               AND access_state <> 'ready')
             AS zoom_readiness,
           (SELECT count(*)::int
              FROM onetime.content_items
             WHERE account_key = $1 AND product_key = $2
               AND lifecycle_state = 'failed')
             AS content_failures,
           (SELECT count(*)::int
              FROM onetime.portal_student_questions
             WHERE account_key = $1 AND product_key = $2
               AND question_status IN ('submitted', 'in_review'))
             AS unanswered_questions,
           (SELECT count(*)::int
              FROM onetime.support_status_projection
             WHERE account_key = $1 AND product_key = $2
               AND status NOT IN ('resolved', 'closed', 'rejected')
               AND delivery_state IN ('delivery_delayed', 'dead_letter'))
             AS urgent_tickets`,
          params,
        ),
        this.pool.query(
          `SELECT
           count(*) FILTER (WHERE lifecycle_state = 'received')::int AS received,
           count(*) FILTER (WHERE lifecycle_state IN ('transcribing', 'processing'))::int
             AS processing,
           count(*) FILTER (WHERE lifecycle_state = 'review_needed')::int AS needs_review,
           count(*) FILTER (
             WHERE lifecycle_state = 'published' AND published_at IS NULL
           )::int AS publishing,
           count(*) FILTER (WHERE lifecycle_state = 'failed')::int AS failed
           FROM onetime.content_items
          WHERE account_key = $1 AND product_key = $2`,
          params,
        ),
        this.pool.query(
          `SELECT
           (SELECT count(*)::int FROM onetime.portal_households
             WHERE account_key = $1 AND product_key = $2 AND status = 'active')
             AS active_households,
           (SELECT count(*)::int FROM onetime.portal_learners
             WHERE account_key = $1 AND product_key = $2 AND learner_status = 'active')
             AS active_students,
           (SELECT count(*)::int FROM onetime.class_attendance_marks
             WHERE account_key = $1 AND product_key = $2)
             AS attendance_recorded,
           (SELECT count(*)::int FROM onetime.portal_reward_events
             WHERE account_key = $1 AND product_key = $2)
             AS badges_awarded`,
          params,
        ),
        this.pool.query(
          `SELECT
           (SELECT count(*)::int FROM onetime.outbox_events
             WHERE account_key = $1 AND product_key = $2
               AND created_at >= $3::timestamptz AND created_at <= $4::timestamptz)
             AS communications,
           (SELECT count(*)::int FROM onetime.audit_events
             WHERE account_key = $1 AND product_key = $2
               AND created_at >= $3::timestamptz AND created_at <= $4::timestamptz)
             AS audit_events,
           greatest(
             (SELECT max(created_at) FROM onetime.outbox_events
               WHERE account_key = $1 AND product_key = $2
                 AND created_at >= $3::timestamptz AND created_at <= $4::timestamptz),
             (SELECT max(created_at) FROM onetime.audit_events
               WHERE account_key = $1 AND product_key = $2
                 AND created_at >= $3::timestamptz AND created_at <= $4::timestamptz)
           ) AS last_activity_at`,
          [...params, windowStartedAt.toISOString(), observedNow.toISOString()],
        ),
        this.pool.query(
          `SELECT DISTINCT ON (readiness.provider)
                readiness.provider, readiness.environment, readiness.readiness_state,
                readiness.observed_at,
                to_jsonb(readiness)->>'runtime_tier' AS runtime_tier,
                to_jsonb(readiness)->>'verification_environment_id'
                  AS verification_environment_id
           FROM onetime.provider_readiness_snapshots AS readiness
          WHERE readiness.account_key = $1
            AND readiness.product_key = $2
            AND readiness.environment = $3
            AND to_jsonb(readiness)->>'runtime_tier' = $4
            AND to_jsonb(readiness)->>'verification_environment_id' = $5
          ORDER BY readiness.provider, readiness.observed_at DESC`,
          [
            ...params,
            providerEnvironment(scope.verificationEnvironmentId),
            scope.runtimeTier,
            scope.verificationEnvironmentId,
          ],
        ),
        this.pool.query(
          `SELECT
           count(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS queue_depth,
           min(created_at) FILTER (WHERE status IN ('pending', 'processing')) AS oldest_queued_at,
           count(*) FILTER (WHERE status IN ('dead_lettered', 'dead_letter'))::int
             AS dead_letter_count
           FROM onetime.outbox_events
          WHERE account_key = $1 AND product_key = $2`,
          params,
        ),
      ],
    );
    const attentionRow = first(attention.rows);
    const contentRow = first(content.rows);
    const peopleRow = first(people.rows);
    const activityRow = first(activity.rows);
    const queueRow = first(queue.rows);
    const queueDepth = count(queueRow.queue_depth);
    const deadLetterCount = count(queueRow.dead_letter_count);
    const oldestQueuedAt =
      queueRow.oldest_queued_at === null || queueRow.oldest_queued_at === undefined
        ? null
        : new Date(String(queueRow.oldest_queued_at));
    if (oldestQueuedAt && Number.isNaN(oldestQueuedAt.getTime())) {
      throw new Error('Persistent queue timestamp is invalid.');
    }
    const unavailable = {
      state: 'unavailable' as const,
      observedAt: observedNow.toISOString(),
      reason: 'not_reported' as const,
    };
    return {
      source: 'persistent_store',
      authorization: 'runtime_admin',
      generatedAt: observedNow.toISOString(),
      nowAndNext: occurrences.rows.map((row) => ({
        ...scope,
        source: 'persistent_store',
        occurrenceId: text(row.occurrence_key),
        classId: text(row.class_series_key),
        title: text(row.title),
        startsAt: iso(row.starts_at),
        state: text(row.occurrence_state),
        readiness: text(row.access_state),
        liveConsoleDestination: {
          route: '/app/live/:occurrenceId',
          targetId: text(row.occurrence_key),
        },
      })),
      needsAttention: {
        ...scope,
        source: 'persistent_store',
        accessOrBilling: count(attentionRow.access_or_billing),
        zoomReadiness: count(attentionRow.zoom_readiness),
        contentFailures: count(attentionRow.content_failures),
        unansweredQuestions: count(attentionRow.unanswered_questions),
        urgentTickets: count(attentionRow.urgent_tickets),
      },
      contentPipeline: {
        ...scope,
        source: 'persistent_store',
        received: count(contentRow.received),
        processing: count(contentRow.processing),
        needsReview: count(contentRow.needs_review),
        publishing: count(contentRow.publishing),
        failed: count(contentRow.failed),
      },
      peopleAndLearning: {
        ...scope,
        source: 'persistent_store',
        activeHouseholds: count(peopleRow.active_households),
        activeStudents: count(peopleRow.active_students),
        attendanceRecorded: count(peopleRow.attendance_recorded),
        badgesAwarded: count(peopleRow.badges_awarded),
      },
      recentActivity: {
        ...scope,
        source: 'persistent_store',
        windowStartedAt: windowStartedAt.toISOString(),
        windowEndedAt: observedNow.toISOString(),
        communications: count(activityRow.communications),
        auditEvents: count(activityRow.audit_events),
        lastActivityAt:
          activityRow.last_activity_at === null || activityRow.last_activity_at === undefined
            ? null
            : iso(activityRow.last_activity_at),
      },
      providerHealth: providers.rows.map((row): AdminProviderHealth => ({
        ...scope,
        source: 'persistent_store',
        provider: text(row.provider),
        state: providerState(row.readiness_state),
        observedAt: iso(row.observed_at),
        sourceEnvironment: providerSourceEnvironment(row.environment),
        observedRuntimeTier: providerRuntimeTier(row.runtime_tier),
        observedVerificationEnvironmentId: providerVerificationEnvironment(
          row.verification_environment_id,
        ),
      })),
      operationalViews: ADMIN_OPERATIONAL_VIEWS,
      quickActions: ADMIN_QUICK_ACTIONS,
      operations: {
        ...scope,
        source: 'persistent_store',
        releaseSource: unavailable,
        webWorkerAgreement: unavailable,
        databaseMigrations: unavailable,
        queueHealth: {
          state: 'available',
          observedAt: observedNow.toISOString(),
          summary: 'Persistent delivery outbox queue readback',
          depth: queueDepth,
          oldestAgeSeconds: oldestQueuedAt
            ? Math.max(0, Math.floor((observedNow.getTime() - oldestQueuedAt.getTime()) / 1000))
            : null,
          deadLetterCount,
        },
        providerDetail:
          providers.rows.length > 0
            ? {
                state: 'available',
                observedAt: observedNow.toISOString(),
                summary: 'Environment-scoped provider readiness readback',
              }
            : unavailable,
        backupRestore: unavailable,
        recentRedactedFailures: unavailable,
      },
    };
  }

  async search(scope: AdminOperationsScope, request: AdminSearchRequest): Promise<AdminSearchPage> {
    const offset = decodeCursor(request.cursor);
    const kindPlaceholders = request.kinds.map((_, index) => `$${index + 4}`).join(', ');
    const limitParameter = request.kinds.length + 4;
    const offsetParameter = request.kinds.length + 5;
    const result = await this.pool.query(
      `WITH authorized_results AS (
         SELECT 'adult'::text AS kind, contact_key AS target_id,
                display_name AS label,
                contact_key AS metadata,
                lead_status AS status,
                CASE
                  WHEN lower(contact_key) = lower($3) THEN 'safe_id'
                  WHEN lower(email_normalized) = lower($3) THEN 'normalized_email'
                  WHEN lower(coalesce(phone_normalized, '')) = lower($3) THEN 'normalized_phone'
                  ELSE 'name'
                END AS matched_by,
                CASE WHEN lower(contact_key) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.contacts
          WHERE account_key = $1 AND product_key = $2
            AND (
              lower(contact_key) = lower($3)
              OR strpos(lower(display_name), lower($3)) > 0
              OR strpos(lower(email_normalized), lower($3)) > 0
              OR strpos(lower(coalesce(phone_normalized, '')), lower($3)) > 0
            )
         UNION ALL
         SELECT 'household'::text AS kind, household_key AS target_id,
                display_name AS label, household_key AS metadata, status AS status,
                CASE WHEN lower(household_key) = lower($3) THEN 'safe_id' ELSE 'name' END AS matched_by,
                CASE WHEN lower(household_key) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.portal_households
          WHERE account_key = $1 AND product_key = $2
            AND (lower(household_key) = lower($3) OR strpos(lower(display_name), lower($3)) > 0)
         UNION ALL
         SELECT 'student'::text AS kind, learner_key AS target_id,
                display_name AS label, household_key AS metadata, learner_status AS status,
                CASE WHEN lower(learner_key) = lower($3) THEN 'safe_id' ELSE 'name' END AS matched_by,
                CASE WHEN lower(learner_key) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.portal_learners
          WHERE account_key = $1 AND product_key = $2
            AND (lower(learner_key) = lower($3) OR strpos(lower(display_name), lower($3)) > 0)
         UNION ALL
         SELECT 'class'::text AS kind, class_series_key AS target_id,
                title AS label, timezone AS metadata, status AS status,
                CASE WHEN lower(class_series_key) = lower($3) THEN 'safe_id' ELSE 'title' END AS matched_by,
                CASE WHEN lower(class_series_key) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.class_series
          WHERE account_key = $1 AND product_key = $2
            AND (lower(class_series_key) = lower($3) OR strpos(lower(title), lower($3)) > 0)
         UNION ALL
         SELECT 'occurrence'::text AS kind, occurrences.occurrence_key AS target_id,
                series.title AS label, occurrences.occurrence_key AS metadata,
                occurrences.occurrence_state AS status,
                'safe_id' AS matched_by,
                CASE WHEN lower(occurrences.occurrence_key) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.class_occurrences AS occurrences
           JOIN onetime.class_series AS series
             ON series.account_key = occurrences.account_key
            AND series.product_key = occurrences.product_key
            AND series.class_series_key = occurrences.class_series_key
          WHERE occurrences.account_key = $1 AND occurrences.product_key = $2
            AND (
              lower(occurrences.occurrence_key) = lower($3)
              OR strpos(lower(series.title), lower($3)) > 0
            )
         UNION ALL
         SELECT 'content'::text AS kind, content_item_key AS target_id,
                title AS label, item_type AS metadata, lifecycle_state AS status,
                CASE
                  WHEN lower(content_item_key) = lower($3) THEN 'safe_id'
                  WHEN strpos(lower(title), lower($3)) > 0 THEN 'title'
                  ELSE 'approved_metadata'
                END AS matched_by,
                CASE WHEN lower(content_item_key) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.content_items
          WHERE account_key = $1 AND product_key = $2
            AND lifecycle_state = 'published'
            AND retention_state = 'active'
            AND (
              lower(content_item_key) = lower($3)
              OR strpos(lower(title), lower($3)) > 0
              OR strpos(lower(coalesce(metadata->>'topic', '')), lower($3)) > 0
              OR strpos(lower(coalesce(metadata->>'mishnah_reference', '')), lower($3)) > 0
              OR strpos(lower(coalesce(metadata->>'class_title', '')), lower($3)) > 0
            )
         UNION ALL
         SELECT 'question'::text AS kind, questions.question_key AS target_id,
                learners.display_name AS label,
                coalesce(questions.class_key, 'No class') AS metadata,
                questions.question_status AS status,
                'safe_id' AS matched_by,
                CASE WHEN lower(questions.question_key) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.portal_student_questions AS questions
           JOIN onetime.portal_learners AS learners
             ON learners.account_key = questions.account_key
            AND learners.product_key = questions.product_key
            AND learners.learner_key = questions.learner_key
          WHERE questions.account_key = $1 AND questions.product_key = $2
            AND (
              lower(questions.question_key) = lower($3)
              OR strpos(lower(learners.display_name), lower($3)) > 0
            )
         UNION ALL
         SELECT 'ticket'::text AS kind, tickets.ticket_id AS target_id,
                tickets.subject AS label,
                tickets.category AS metadata, tickets.status AS status,
                CASE WHEN lower(tickets.ticket_id) = lower($3)
                   THEN 'safe_id' ELSE 'title' END AS matched_by,
                CASE WHEN lower(tickets.ticket_id) = lower($3) THEN 0 ELSE 1 END AS match_rank
           FROM onetime.support_tickets_v21 AS tickets
          WHERE tickets.product = $2
            AND (
              lower(tickets.ticket_id) = lower($3)
              OR strpos(lower(tickets.subject), lower($3)) > 0
              OR strpos(lower(tickets.category), lower($3)) > 0
            )
       )
       SELECT kind, target_id, label, metadata, status, matched_by
         FROM authorized_results
        WHERE kind IN (${kindPlaceholders})
        ORDER BY match_rank, kind, label, target_id
        LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
      [
        this.config.accountKey,
        this.config.productKey,
        request.query,
        ...request.kinds,
        request.pageSize + 1,
        offset,
      ],
    );
    const hasMore = result.rows.length > request.pageSize;
    const rows = result.rows.slice(0, request.pageSize);
    return {
      source: 'persistent_store',
      authorization: 'runtime_admin',
      queryInUrl: false,
      analyticsAllowed: false,
      results: rows.map((row) => searchRow(scope, row)),
      nextCursor: hasMore ? encodeCursor(offset + request.pageSize) : null,
    };
  }

  async resolveTarget(
    _scope: AdminOperationsScope,
    request: { kind: AdminSearchKind; targetId: string },
  ): Promise<AdminTargetAuthorization> {
    const lookups: Record<AdminSearchKind, string> = {
      adult:
        'SELECT lead_status AS lifecycle FROM onetime.contacts WHERE account_key = $1 AND product_key = $2 AND contact_key = $3',
      household:
        'SELECT status AS lifecycle FROM onetime.portal_households WHERE account_key = $1 AND product_key = $2 AND household_key = $3',
      student:
        'SELECT learner_status AS lifecycle FROM onetime.portal_learners WHERE account_key = $1 AND product_key = $2 AND learner_key = $3',
      class:
        'SELECT status AS lifecycle FROM onetime.class_series WHERE account_key = $1 AND product_key = $2 AND class_series_key = $3',
      occurrence:
        'SELECT occurrence_state AS lifecycle FROM onetime.class_occurrences WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3',
      content:
        "SELECT CASE WHEN lifecycle_state = 'published' AND retention_state = 'active' THEN 'active' ELSE lifecycle_state END AS lifecycle FROM onetime.content_items WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3",
      question:
        'SELECT question_status AS lifecycle FROM onetime.portal_student_questions WHERE account_key = $1 AND product_key = $2 AND question_key = $3',
      ticket:
        'SELECT status AS lifecycle FROM onetime.support_tickets_v21 WHERE product = $2 AND ticket_id = $3',
    };
    const result = await this.pool.query(lookups[request.kind], [
      this.config.accountKey,
      this.config.productKey,
      request.targetId,
    ]);
    const row = result.rows[0];
    if (!row) return { state: 'missing' };
    const lifecycle = text(row.lifecycle).toLowerCase();
    if (['archived', 'purged', 'superseded', 'cancelled'].includes(lifecycle)) {
      return { state: 'archived' };
    }
    if (['revoked', 'disabled', 'suspended'].includes(lifecycle)) {
      return { state: 'revoked' };
    }
    if (request.kind === 'content' && lifecycle !== 'active') return { state: 'revoked' };
    return { state: 'authorized', kind: request.kind, targetId: request.targetId };
  }
}

function searchRow(scope: AdminOperationsScope, row: Row): AdminSearchResult {
  const kind = searchKind(row.kind);
  const targetId = text(row.target_id);
  const routes = {
    adult: '/app/contacts/:contactId',
    household: '/app/households/:householdId',
    student: '/app/students/:studentId',
    class: '/app/classroom/classes/:classId',
    occurrence: '/app/classroom/occurrences/:occurrenceId',
    content: '/app/content/:contentId',
    question: '/app/classroom/questions',
    ticket: '/app/tickets/:ticketId',
  } as const;
  return {
    ...scope,
    source: 'persistent_store',
    kind,
    targetId,
    label: text(row.label),
    distinguishingMetadata: text(row.metadata),
    status: text(row.status),
    matchedBy: matchedBy(row.matched_by),
    destination: { route: routes[kind], targetId },
  } as AdminSearchResult;
}

function first(rows: readonly Row[]): Row {
  const row = rows[0];
  if (!row) throw new Error('Persistent aggregate query returned no row.');
  return row;
}

function text(value: unknown): string {
  return String(value ?? '');
}

function count(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Persistent aggregate count is invalid.');
  }
  return parsed;
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error('Persistent timestamp is invalid.');
  return date.toISOString();
}

function providerState(value: unknown): AdminProviderHealth['state'] {
  const state = String(value);
  if (
    state === 'not_configured' ||
    state === 'configured' ||
    state === 'authenticated' ||
    state === 'canary_verified' ||
    state === 'live' ||
    state === 'unavailable'
  ) {
    return state;
  }
  throw new Error('Persistent provider readiness state is invalid.');
}

function searchKind(value: unknown): AdminSearchKind {
  const kind = String(value);
  if (
    kind === 'adult' ||
    kind === 'household' ||
    kind === 'student' ||
    kind === 'class' ||
    kind === 'occurrence' ||
    kind === 'content' ||
    kind === 'question' ||
    kind === 'ticket'
  ) {
    return kind;
  }
  throw new Error('Persistent search entity kind is invalid.');
}

function matchedBy(value: unknown): AdminSearchResult['matchedBy'] {
  const match = String(value);
  if (
    match === 'safe_id' ||
    match === 'name' ||
    match === 'normalized_email' ||
    match === 'normalized_phone' ||
    match === 'title' ||
    match === 'approved_metadata'
  ) {
    return match;
  }
  throw new Error('Persistent search match reason is invalid.');
}

function providerEnvironment(
  environment: AdminOperationsScope['verificationEnvironmentId'],
): 'test' | 'staging' | 'production' {
  if (environment === 'ci') return 'test';
  if (environment === 'provider_sandbox' || environment === 'persistent_staging') return 'staging';
  return 'production';
}

function providerSourceEnvironment(value: unknown): AdminProviderHealth['sourceEnvironment'] {
  const environment = String(value);
  if (
    environment === 'fixture' ||
    environment === 'test' ||
    environment === 'staging' ||
    environment === 'production'
  ) {
    return environment;
  }
  throw new Error('Persistent provider environment is invalid.');
}

function providerRuntimeTier(value: unknown): AdminProviderHealth['observedRuntimeTier'] {
  const runtimeTier = String(value);
  if (runtimeTier === 'isolated_staging' || runtimeTier === 'production') return runtimeTier;
  throw new Error('Persistent provider runtime tier provenance is invalid.');
}

function providerVerificationEnvironment(
  value: unknown,
): AdminProviderHealth['observedVerificationEnvironmentId'] {
  const environment = String(value);
  if (
    environment === 'ci' ||
    environment === 'provider_sandbox' ||
    environment === 'persistent_staging' ||
    environment === 'production_read_only' ||
    environment === 'production_operator_canary' ||
    environment === 'production_broad'
  ) {
    return environment;
  }
  throw new Error('Persistent provider verification-environment provenance is invalid.');
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | null): number {
  if (cursor === null) return 0;
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!/^(0|[1-9][0-9]{0,8})$/u.test(decoded)) throw new Error('Search cursor is invalid.');
  const offset = Number(decoded);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Search cursor is invalid.');
  return offset;
}
