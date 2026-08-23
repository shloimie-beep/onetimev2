import type { AppConfig } from '../../../config/src/index.ts';
import type {
  OwnerDashboard,
  OwnerDashboardHouseholdAccess,
  OwnerDashboardSection,
  OwnerDashboardSectionState,
  VisibleAction,
} from '../../../contracts/src/dashboard/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import type { AuthenticatedSession } from '../auth/service.ts';

type QueryCountRow = Record<string, unknown>;

export function ownerAdminVisibleActions(): VisibleAction[] {
  const readStates = {
    loading: 'Checking your workspace.',
    success: 'Workspace view is current.',
    error: 'This view could not be refreshed.',
    permission: 'This account cannot use that control.',
    offline: 'Reconnect before opening protected workspace data.',
  };
  const writeStates = {
    loading: 'Saving your change.',
    success: 'Change saved.',
    error: 'The change could not be saved.',
    permission: 'This account cannot use that control.',
    offline: 'Reconnect before changing workspace data.',
  };
  return [
    action('dashboard.view.route', 'Dashboard', 'route', '/app/dashboard', ['owner', 'admin'], {
      capability: 'dashboard:read',
      handler: ['GET', '/api/v1/dashboard/owner'],
      idempotency: [false, null],
      audit: ['local_read', 'dashboard_read'],
      states: readStates,
    }),
    action(
      'dashboard.refresh.button',
      'Refresh dashboard',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'dashboard:read',
        handler: ['GET', '/api/v1/dashboard/owner'],
        idempotency: [false, null],
        audit: ['local_read', 'dashboard_read'],
        states: readStates,
      },
    ),
    action(
      'dashboard.open_crm.button',
      'Open CRM',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'crm:contacts:read',
        handler: ['GET', '/api/v1/crm/contacts'],
        idempotency: [false, null],
        audit: ['local_read', 'crm_contacts_read'],
        states: readStates,
      },
    ),
    action(
      'dashboard.open_classes.button',
      'Open Classes',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'classes:read',
        handler: ['GET', '/api/v1/classes'],
        idempotency: [false, null],
        audit: ['local_read', 'classes_read'],
        states: readStates,
      },
    ),
    action(
      'dashboard.open_communications.button',
      'Open Communications',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'communications:read',
        handler: ['GET', '/api/v1/communications'],
        idempotency: [false, null],
        audit: ['local_read', 'communications_read'],
        states: readStates,
      },
    ),
    action(
      'dashboard.open_content.button',
      'Open Content Library',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'content:library:read',
        handler: ['GET', '/api/v1/content/library'],
        idempotency: [false, null],
        audit: ['local_read', 'content_library_read'],
        states: readStates,
      },
    ),
    action(
      'dashboard.open_billing.button',
      'Open household access',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'accounts:access:read',
        handler: ['GET', '/api/v1/dashboard/owner'],
        idempotency: [false, null],
        audit: ['local_read', 'account_access_status_read'],
        states: readStates,
      },
    ),
    action(
      'dashboard.open_rewards.button',
      'Open Learning Rewards',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'gamification:admin',
        handler: ['GET', '/api/v1/gamification/admin'],
        idempotency: [false, null],
        audit: ['local_read', 'gamification_admin_read'],
        states: readStates,
      },
    ),
    action(
      'crm.contacts.view.route',
      'CRM',
      'route',
      '/app/crm',
      ['owner', 'admin', 'crm_agent', 'viewer'],
      {
        capability: 'crm:contacts:read',
        handler: ['GET', '/api/v1/crm/contacts'],
        idempotency: [false, null],
        audit: ['local_read', 'crm_contacts_read'],
        states: readStates,
      },
    ),
    action(
      'crm.contacts.search.form',
      'Search CRM contacts',
      'form',
      '/app/crm',
      ['owner', 'admin', 'crm_agent', 'viewer'],
      {
        capability: 'crm:contacts:search',
        handler: ['POST', '/api/v1/crm/contacts/search'],
        idempotency: [false, null],
        audit: ['local_read', 'crm_contacts_search'],
        states: readStates,
      },
    ),
    action(
      'crm.contacts.open.button',
      'Open CRM contact',
      'button',
      '/app/crm/contacts/:contactId',
      ['owner', 'admin', 'crm_agent', 'viewer'],
      {
        capability: 'crm:contacts:read',
        handler: ['GET', '/api/v1/crm/contacts/:contactId'],
        idempotency: [false, null],
        audit: ['local_read', 'crm_contact_read'],
        states: readStates,
      },
    ),
    action(
      'crm.contacts.create.form',
      'Create CRM contact',
      'form',
      '/app/crm',
      ['owner', 'admin', 'crm_agent'],
      {
        capability: 'crm:contacts:create',
        handler: ['POST', '/api/v1/crm/contacts'],
        idempotency: [true, 'client-generated idempotency_key'],
        audit: ['domain_audit', 'crm_contact_created'],
        states: writeStates,
      },
    ),
    action(
      'crm.contacts.update.form',
      'Update CRM contact',
      'form',
      '/app/crm/contacts/:contactId',
      ['owner', 'admin', 'crm_agent'],
      {
        capability: 'crm:contacts:update',
        handler: ['PATCH', '/api/v1/crm/contacts/:contactId'],
        idempotency: [false, null],
        audit: ['domain_audit', 'crm_contact_updated'],
        states: writeStates,
      },
    ),
    action('classes.view.route', 'Classes', 'route', '/app/classes', ['owner', 'admin'], {
      capability: 'classes:read',
      handler: ['GET', '/api/v1/classes'],
      idempotency: [false, null],
      audit: ['local_read', 'classes_read'],
      states: readStates,
    }),
    action(
      'classes.refresh.button',
      'Refresh classes',
      'button',
      '/app/classes',
      ['owner', 'admin'],
      {
        capability: 'classes:read',
        handler: ['GET', '/api/v1/classes'],
        idempotency: [false, null],
        audit: ['local_read', 'classes_read'],
        states: readStates,
      },
    ),
    action(
      'classes.open_detail.button',
      'Open class details',
      'button',
      '/app/classes/:occurrenceKey',
      ['owner', 'admin'],
      {
        capability: 'classes:read',
        handler: ['GET', '/api/v1/classes/:occurrenceKey'],
        idempotency: [false, null],
        audit: ['local_read', 'class_detail_read'],
        states: readStates,
      },
    ),
    action(
      'classes.back_to_list.button',
      'Back to classes',
      'button',
      '/app/classes',
      ['owner', 'admin'],
      {
        capability: 'classes:read',
        handler: ['GET', '/api/v1/classes'],
        idempotency: [false, null],
        audit: ['local_read', 'classes_read'],
        states: readStates,
      },
    ),
    action(
      'content.library.view.route',
      'Content Library',
      'route',
      '/app/content',
      ['owner', 'admin'],
      {
        capability: 'content:library:read',
        handler: ['GET', '/api/v1/content/library'],
        idempotency: [false, null],
        audit: ['local_read', 'content_library_read'],
        states: readStates,
      },
    ),
    action(
      'content.library.refresh.button',
      'Refresh content',
      'button',
      '/app/content',
      ['owner', 'admin'],
      {
        capability: 'content:library:read',
        handler: ['GET', '/api/v1/content/library'],
        idempotency: [false, null],
        audit: ['local_read', 'content_library_read'],
        states: readStates,
      },
    ),
    action(
      'communications.view.route',
      'Communications',
      'route',
      '/app/communications',
      ['owner', 'admin'],
      {
        capability: 'communications:read',
        handler: ['GET', '/api/v1/communications'],
        idempotency: [false, null],
        audit: ['local_read', 'communications_read'],
        states: readStates,
      },
    ),
    action(
      'communications.filters.form',
      'Filter communications',
      'form',
      '/app/communications',
      ['owner', 'admin'],
      {
        capability: 'communications:read',
        handler: ['GET', '/api/v1/communications'],
        idempotency: [false, null],
        audit: ['local_read', 'communications_read'],
        states: readStates,
      },
    ),
    action(
      'billing.status.view.route',
      'Household access',
      'route',
      '/app/billing',
      ['owner', 'admin'],
      {
        capability: 'accounts:access:read',
        handler: ['GET', '/api/v1/dashboard/owner'],
        idempotency: [false, null],
        audit: ['local_read', 'account_access_status_read'],
        states: readStates,
      },
    ),
    action(
      'household.access.refresh.button',
      'Refresh household access',
      'button',
      '/app/billing',
      ['owner', 'admin'],
      {
        capability: 'accounts:access:read',
        handler: ['GET', '/api/v1/dashboard/owner'],
        idempotency: [false, null],
        audit: ['local_read', 'account_access_status_read'],
        states: readStates,
      },
    ),
    action('rewards.view.route', 'Learning Rewards', 'route', '/app/rewards', ['owner', 'admin'], {
      capability: 'gamification:admin',
      handler: ['GET', '/api/v1/gamification/admin'],
      idempotency: [false, null],
      audit: ['local_read', 'gamification_admin_read'],
      states: readStates,
    }),
    action(
      'rewards.refresh.button',
      'Refresh rewards',
      'button',
      '/app/rewards',
      ['owner', 'admin'],
      {
        capability: 'gamification:admin',
        handler: ['GET', '/api/v1/gamification/admin'],
        idempotency: [false, null],
        audit: ['local_read', 'gamification_admin_read'],
        states: readStates,
      },
    ),
    action(
      'auth.logout.button',
      'Logout',
      'button',
      '/app/dashboard',
      ['owner', 'admin', 'crm_agent', 'viewer', 'parent', 'student'],
      {
        capability: 'auth:session:revoke',
        handler: ['POST', '/api/v1/auth/logout'],
        idempotency: [false, null],
        audit: ['session', 'logout'],
        states: writeStates,
      },
    ),
  ];
}

export async function buildOwnerDashboard(input: {
  pool: DbPool;
  config: AppConfig;
  session: AuthenticatedSession;
  now?: Date;
}): Promise<OwnerDashboard> {
  const now = input.now ?? new Date();
  const [
    newLeads,
    nextClass,
    communications,
    content,
    portalAccounts,
    currentAccess,
    householdAccess,
  ] = await Promise.all([
    newLeadsSection(input.pool, input.config),
    nextClassSection(input.pool, input.config, now),
    communicationsSection(input.pool, input.config),
    contentReviewSection(input.pool, input.config),
    portalAccountSection(input.pool, input.config),
    currentAccessSection(input.pool, input.config),
    currentHouseholdAccess(input.pool, input.config, now),
  ]);
  return {
    generated_at: now.toISOString(),
    account_key: input.config.accountKey,
    product_key: input.config.productKey,
    actor: {
      user_key: input.session.user.user_key,
      role: input.session.user.role,
      display_name: input.session.user.display_name,
    },
    sections: [
      newLeads,
      nextClass,
      communications,
      content,
      portalAccounts,
      currentAccess,
      supportSection(),
    ],
    household_access: householdAccess,
  };
}

async function newLeadsSection(pool: DbPool, config: AppConfig): Promise<OwnerDashboardSection> {
  const row = await optionalCountRow(
    pool,
    `SELECT count(*)::int AS count, max(updated_at) AS updated_at
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND lead_status = 'new'
        AND archived_at IS NULL`,
    [config.accountKey, config.productKey],
  );
  if (!row)
    return unavailable('new_leads', 'New leads', 'CRM contact source is temporarily unavailable.');
  const count = numberValue(row.count);
  return section({
    id: 'new_leads',
    label: 'New leads',
    state: count > 0 ? 'action_needed' : 'ready',
    value: count,
    valueLabel: count > 0 ? `${count} new lead${count === 1 ? '' : 's'}` : 'Ready',
    detail:
      count > 0
        ? 'New family or school inquiries are waiting for review.'
        : 'CRM is ready and no new leads are waiting.',
    nextAction: count > 0 ? 'Open CRM and review the newest inquiries.' : null,
    trendLabel: 'Updated by lead and contact activity.',
    href: '/app/crm',
    capability: 'crm:contacts:read',
    updatedAt: isoOrNull(row.updated_at),
    diagnostics: {
      source: 'contacts',
      stateCode: count > 0 ? 'lead_status:new' : 'lead_status:none_new',
      detail: 'Counts active contacts with lead_status new in this account/product.',
    },
  });
}

async function nextClassSection(
  pool: DbPool,
  config: AppConfig,
  now: Date,
): Promise<OwnerDashboardSection> {
  const row = await optionalFirstRow(
    pool,
    `SELECT occurrences.occurrence_key, occurrences.starts_at, occurrences.access_state,
            occurrences.occurrence_state, series.title
       FROM onetime.class_occurrences AS occurrences
       JOIN onetime.class_series AS series
         ON series.account_key = occurrences.account_key
        AND series.product_key = occurrences.product_key
        AND series.class_series_key = occurrences.class_series_key
      WHERE occurrences.account_key = $1
        AND occurrences.product_key = $2
        AND occurrences.starts_at >= $3
        AND occurrences.occurrence_state <> 'cancelled'
      ORDER BY occurrences.starts_at ASC, occurrences.occurrence_key ASC
      LIMIT 1`,
    [config.accountKey, config.productKey, now],
  );
  if (row === undefined) {
    return unavailable(
      'next_class',
      'Upcoming class',
      'Class schedule is temporarily unavailable.',
    );
  }
  if (!row) {
    return section({
      id: 'next_class',
      label: 'Upcoming class',
      state: 'action_needed',
      value: null,
      valueLabel: 'Action needed',
      detail: 'No upcoming class is scheduled yet.',
      nextAction: 'Create or import the next class schedule before learners need it.',
      trendLabel: null,
      href: '/app/classes',
      capability: 'classes:read',
      updatedAt: null,
      diagnostics: {
        source: 'class_occurrences',
        stateCode: 'missing_upcoming_occurrence',
        detail: 'No non-cancelled future class occurrence matched the account/product.',
      },
    });
  }
  const startsAt = isoOrNull(row.starts_at);
  const accessState = String(row.access_state ?? 'provider_unavailable');
  const accessProduct = accessState === 'ready' ? 'ready' : 'action_needed';
  return section({
    id: 'next_class',
    label: 'Upcoming class',
    state: accessProduct,
    value: null,
    valueLabel: startsAt ? formatIsoLabel(startsAt) : 'Scheduled',
    detail:
      accessState === 'ready'
        ? `${String(row.title ?? 'Class')} is scheduled and protected access is ready.`
        : `${String(row.title ?? 'Class')} is scheduled. Review protected access in Classroom or Live Console before the session starts.`,
    nextAction:
      accessState === 'ready'
        ? 'Open the class detail before the session starts.'
        : 'Review protected classroom access before learner launch.',
    trendLabel: 'Next scheduled class.',
    href: '/app/classes',
    capability: 'classes:read',
    updatedAt: startsAt,
    diagnostics: {
      source: 'class_occurrences',
      stateCode: `access_state:${accessState}`,
      detail: `occurrence_state:${String(row.occurrence_state ?? 'scheduled')}`,
    },
  });
}

async function communicationsSection(
  pool: DbPool,
  config: AppConfig,
): Promise<OwnerDashboardSection> {
  const row = await optionalCountRow(
    pool,
    `SELECT count(*)::int AS total_count,
            sum(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END)::int AS pending_count,
            max(created_at) AS updated_at
       FROM onetime.outbox_events
      WHERE account_key = $1
        AND product_key = $2
        AND transport_mode = 'sink'`,
    [config.accountKey, config.productKey],
  );
  if (!row) {
    return unavailable(
      'communications_delivery',
      'Communication attention',
      'Communication status is temporarily unavailable.',
    );
  }
  const pending = numberValue(row.pending_count);
  const total = numberValue(row.total_count);
  return section({
    id: 'communications_delivery',
    label: 'Communication attention',
    state: pending > 0 ? 'action_needed' : total > 0 ? 'ready' : 'no_data_yet',
    value: pending,
    valueLabel: pending > 0 ? `${pending} need attention` : total > 0 ? 'Ready' : 'No data yet',
    detail:
      total > 0
        ? `${total} communication records are available for review.`
        : 'No local communication history is available yet.',
    nextAction:
      pending > 0
        ? 'Open Communications and review pending drafts or follow-up items.'
        : total > 0
          ? null
          : 'Connect or import communication history when the approved source is ready.',
    trendLabel: total > 0 ? 'Local communication records only.' : null,
    href: '/app/communications',
    capability: 'communications:read',
    updatedAt: isoOrNull(row.updated_at),
    diagnostics: {
      source: 'outbox_events',
      stateCode: `pending:${pending};total:${total};transport:sink`,
      detail: 'Counts sink-mode delivery records only; no provider send is implied.',
    },
  });
}

async function contentReviewSection(
  pool: DbPool,
  config: AppConfig,
): Promise<OwnerDashboardSection> {
  const row = await optionalCountRow(
    pool,
    `SELECT count(*)::int AS total_count,
            sum(CASE WHEN lifecycle_state = 'review_needed' THEN 1 ELSE 0 END)::int AS review_count,
            sum(CASE WHEN lifecycle_state = 'published' THEN 1 ELSE 0 END)::int AS published_count,
            max(updated_at) AS updated_at
       FROM onetime.content_items
      WHERE account_key = $1
        AND product_key = $2
        AND retention_state = 'active'`,
    [config.accountKey, config.productKey],
  );
  if (!row)
    return unavailable(
      'content_review',
      'Content processing',
      'Content status is temporarily unavailable.',
    );
  const total = numberValue(row.total_count);
  const review = numberValue(row.review_count);
  const published = numberValue(row.published_count);
  return section({
    id: 'content_review',
    label: 'Content processing',
    state: review > 0 ? 'action_needed' : total > 0 ? 'ready' : 'no_data_yet',
    value: review,
    valueLabel:
      review > 0 ? `${review} need review` : total > 0 ? `${published} published` : 'No data yet',
    detail:
      total > 0
        ? `${published} library items are published; ${review} need review.`
        : 'No class recordings or review sheets have been admitted yet.',
    nextAction:
      review > 0
        ? 'Open Content and review the waiting item.'
        : total > 0
          ? null
          : 'Configure content intake or admit the first class item.',
    trendLabel: total > 0 ? `${total} active content items` : null,
    href: '/app/content',
    capability: 'content:library:read',
    updatedAt: isoOrNull(row.updated_at),
    diagnostics: {
      source: 'content_items',
      stateCode: `review:${review};published:${published};total:${total}`,
      detail: 'Counts active content items and lifecycle review state.',
    },
  });
}

async function portalAccountSection(
  pool: DbPool,
  config: AppConfig,
): Promise<OwnerDashboardSection> {
  const row = await optionalCountRow(
    pool,
    `SELECT
        (SELECT count(*)::int FROM onetime.portal_households
          WHERE account_key = $1 AND product_key = $2 AND status = 'active') AS household_count,
        (SELECT count(*)::int FROM onetime.portal_learners
          WHERE account_key = $1 AND product_key = $2 AND learner_status = 'active') AS learner_count,
        (SELECT count(*)::int FROM onetime.portal_student_access_state
          WHERE account_key = $1 AND product_key = $2
            AND status IN ('not_configured', 'setup_requested', 'reset_requested')) AS setup_count,
        (SELECT count(*)::int FROM onetime.account_lifecycle_delivery_intents
          WHERE account_key = $1 AND product_key = $2 AND delivery_state = 'sink_queued') AS pending_delivery_count`,
    [config.accountKey, config.productKey],
  );
  if (!row) {
    return unavailable(
      'portal_account_setup',
      'Current members',
      'Member account status is temporarily unavailable.',
    );
  }
  const households = numberValue(row.household_count);
  const learners = numberValue(row.learner_count);
  const setup = numberValue(row.setup_count);
  const pendingDelivery = numberValue(row.pending_delivery_count);
  const needsSetup = households === 0 || learners === 0;
  return section({
    id: 'portal_account_setup',
    label: 'Current members',
    state: needsSetup
      ? 'no_data_yet'
      : setup > 0 || pendingDelivery > 0
        ? 'action_needed'
        : 'ready',
    value: setup + pendingDelivery,
    valueLabel:
      households === 0
        ? 'No data yet'
        : `${households} household${households === 1 ? '' : 's'}, ${learners} learner${
            learners === 1 ? '' : 's'
          }`,
    detail:
      households === 0
        ? 'No active member households are available yet.'
        : `${setup} learner access record${setup === 1 ? '' : 's'} need setup or reset; ${pendingDelivery} account email${pendingDelivery === 1 ? '' : 's'} are queued.`,
    nextAction:
      households === 0
        ? 'Seed the Portal Test Lab or import approved members.'
        : setup > 0 || pendingDelivery > 0
          ? 'Open member access setup before inviting families.'
          : null,
    trendLabel: learners > 0 ? 'Active portal records.' : null,
    href: null,
    capability: 'accounts:lifecycle:read',
    updatedAt: null,
    diagnostics: {
      source: 'portal_households/portal_learners/portal_student_access_state',
      stateCode: `households:${households};learners:${learners};setup:${setup};queued:${pendingDelivery}`,
      detail: 'Counts active household, learner, student setup, and lifecycle email rows.',
    },
  });
}

async function currentAccessSection(
  pool: DbPool,
  config: AppConfig,
): Promise<OwnerDashboardSection> {
  const row = await optionalCountRow(
    pool,
    `SELECT
        sum(CASE
          WHEN state IN ('active', 'grace', 'scheduled_end')
            AND effective_at <= now()
            AND (expires_at IS NULL OR expires_at > now())
          THEN 1 ELSE 0
        END)::int AS active_count,
        sum(CASE WHEN source_kind = 'free_pilot' THEN 1 ELSE 0 END)::int AS free_pilot_count,
        sum(CASE WHEN state IN ('manual_review', 'suspended') THEN 1 ELSE 0 END)::int AS review_count,
        count(*)::int AS projection_count,
        max(updated_at) AS updated_at
       FROM onetime.account_access_projections
      WHERE account_key = $1
        AND product_key = $2`,
    [config.accountKey, config.productKey],
  );
  if (!row) {
    return unavailable(
      'billing_readiness',
      'Household access',
      'Current household access is temporarily unavailable.',
    );
  }
  const active = numberValue(row.active_count);
  const freePilots = numberValue(row.free_pilot_count);
  const needsReview = numberValue(row.review_count);
  const projections = numberValue(row.projection_count);
  return section({
    id: 'billing_readiness',
    label: 'Household access',
    state:
      active > 0
        ? needsReview > 0
          ? 'action_needed'
          : 'ready'
        : projections > 0
          ? 'action_needed'
          : 'no_data_yet',
    value: active,
    valueLabel: `${active} household${active === 1 ? '' : 's'} with access`,
    detail:
      projections > 0
        ? `GHL owns payment history; One Time stores ${projections} current household access projection${projections === 1 ? '' : 's'}.`
        : 'GHL owns payment history; One Time has no current household access projection yet.',
    nextAction:
      projections === 0
        ? 'Grant a reviewed free pilot or ingest an approved GHL current-access state.'
        : needsReview > 0
          ? 'Review non-active household access states in GHL and reproject the result.'
          : null,
    trendLabel:
      freePilots > 0 ? `${freePilots} complimentary pilot${freePilots === 1 ? '' : 's'}` : null,
    href: '/app/billing',
    capability: 'accounts:access:read',
    updatedAt: isoOrNull(row.updated_at),
    diagnostics: {
      source: 'account_access_projections',
      stateCode: `active:${active};pilots:${freePilots};review:${needsReview};total:${projections}`,
      detail: 'Current access only; GHL remains the payment-history system of record.',
    },
  });
}

async function currentHouseholdAccess(
  pool: DbPool,
  config: AppConfig,
  now: Date,
): Promise<OwnerDashboardHouseholdAccess[]> {
  const rows = await optionalRows(
    pool,
    `SELECT households.household_key,
            households.display_name AS household_label,
            households.status AS household_status,
            access.state,
            access.source_kind,
            access.effective_at,
            access.expires_at,
            access.revocation_reason,
            coalesce(access.updated_at, households.updated_at) AS updated_at
       FROM onetime.portal_households AS households
       LEFT JOIN onetime.account_access_projections AS access
         ON access.account_key = households.account_key
        AND access.product_key = households.product_key
        AND access.household_key = households.household_key
      WHERE households.account_key = $1
        AND households.product_key = $2
      ORDER BY CASE households.status WHEN 'active' THEN 0 ELSE 1 END,
               lower(households.display_name),
               households.household_key`,
    [config.accountKey, config.productKey],
  );
  if (!rows) return [];
  return rows.map((row) => {
    const state = accessState(row.state);
    const sourceKind = accessSourceKind(row.source_kind);
    const effectiveAt = isoOrNull(row.effective_at);
    const expiresAt = isoOrNull(row.expires_at);
    return {
      household_key: String(row.household_key),
      household_label: String(row.household_label),
      household_status: row.household_status === 'archived' ? 'archived' : 'active',
      state,
      source_kind: sourceKind,
      source_label: accessSourceLabel(sourceKind),
      grants_access:
        row.household_status === 'active' &&
        ['active', 'grace', 'scheduled_end'].includes(state) &&
        effectiveAt !== null &&
        new Date(effectiveAt).getTime() <= now.getTime() &&
        (expiresAt === null || new Date(expiresAt).getTime() > now.getTime()),
      effective_at: effectiveAt,
      expires_at: expiresAt,
      review_or_revocation_reason:
        typeof row.revocation_reason === 'string' && row.revocation_reason.trim()
          ? row.revocation_reason.trim()
          : null,
      updated_at: isoOrNull(row.updated_at),
    };
  });
}

function accessState(value: unknown): OwnerDashboardHouseholdAccess['state'] {
  if (
    value === 'active' ||
    value === 'grace' ||
    value === 'scheduled_end' ||
    value === 'suspended' ||
    value === 'revoked' ||
    value === 'manual_review'
  ) {
    return value;
  }
  return 'pending';
}

function accessSourceKind(value: unknown): OwnerDashboardHouseholdAccess['source_kind'] {
  if (
    value === 'free_pilot' ||
    value === 'highlevel_payment_state' ||
    value === 'admin_override' ||
    value === 'legacy_preview'
  ) {
    return value;
  }
  return null;
}

function accessSourceLabel(
  value: OwnerDashboardHouseholdAccess['source_kind'],
): OwnerDashboardHouseholdAccess['source_label'] {
  if (value === 'free_pilot') return 'Complimentary pilot';
  if (value === 'highlevel_payment_state') return 'GHL current access';
  if (value === 'admin_override') return 'Administrator override';
  if (value === 'legacy_preview') return 'Legacy staging preview';
  return 'No access projection';
}

function supportSection(): OwnerDashboardSection {
  return section({
    id: 'support',
    label: 'Support',
    state: 'temporarily_unavailable',
    value: null,
    valueLabel: 'Temporarily unavailable',
    detail: 'Owner support summaries are not mounted in this dashboard yet.',
    nextAction: 'Open Support for subscriber ticket tools.',
    trendLabel: null,
    href: null,
    capability: 'support:read',
    updatedAt: null,
    diagnostics: {
      source: 'support',
      stateCode: 'support_dashboard_source_unmounted',
      detail: 'Support routes exist separately; dashboard aggregation is not mounted.',
    },
  });
}

async function optionalCountRow(pool: DbPool, sql: string, values: unknown[]) {
  const rows = await optionalRows(pool, sql, values);
  if (!rows) return null;
  return rows[0] ?? {};
}

async function optionalFirstRow(pool: DbPool, sql: string, values: unknown[]) {
  const rows = await optionalRows(pool, sql, values);
  if (!rows) return undefined;
  return rows[0] ?? null;
}

async function optionalRows(pool: DbPool, sql: string, values: unknown[]) {
  try {
    return (await pool.query(sql, values)).rows as QueryCountRow[];
  } catch {
    return null;
  }
}

function section(input: {
  id: OwnerDashboardSection['id'];
  label: string;
  state: OwnerDashboardSectionState;
  value: number | null;
  valueLabel: string;
  detail: string;
  nextAction: string | null;
  trendLabel: string | null;
  href: string | null;
  capability: string;
  updatedAt: string | null;
  diagnostics: {
    source: string;
    stateCode: string;
    detail: string;
  };
}): OwnerDashboardSection {
  return {
    id: input.id,
    label: input.label,
    state: input.state,
    value: input.value,
    value_label: input.valueLabel,
    detail: input.detail,
    next_action: input.nextAction,
    trend_label: input.trendLabel,
    href: input.href,
    capability: input.capability,
    updated_at: input.updatedAt,
    diagnostics: {
      source: input.diagnostics.source,
      state_code: input.diagnostics.stateCode,
      detail: input.diagnostics.detail,
      checked_at: input.updatedAt,
    },
  };
}

function unavailable(
  id: OwnerDashboardSection['id'],
  label: string,
  detail: string,
): OwnerDashboardSection {
  return section({
    id,
    label,
    state: 'temporarily_unavailable',
    value: null,
    valueLabel: 'Temporarily unavailable',
    detail,
    nextAction: 'Try again shortly or open Diagnostics if the issue persists.',
    trendLabel: null,
    href: null,
    capability: `${id}:read`,
    updatedAt: null,
    diagnostics: {
      source: id,
      stateCode: 'query_unavailable',
      detail: 'The dashboard query failed without exposing database or provider details.',
    },
  });
}

function action(
  actionId: string,
  label: string,
  surface: VisibleAction['surface'],
  route: string,
  roles: VisibleAction['roles'],
  input: {
    capability: string;
    handler: [VisibleAction['handler']['method'], string];
    idempotency: [boolean, string | null];
    audit: [VisibleAction['audit']['mode'], string];
    states: VisibleAction['states'];
  },
): VisibleAction {
  return {
    action_id: actionId,
    label,
    surface,
    route,
    roles,
    capability: input.capability,
    handler: {
      method: input.handler[0],
      path: input.handler[1],
    },
    idempotency: {
      required: input.idempotency[0],
      key_source: input.idempotency[1],
    },
    audit: {
      mode: input.audit[0],
      event: input.audit[1],
    },
    states: input.states,
  };
}

function numberValue(value: unknown) {
  if (Array.isArray(value)) return numberValue(value[0]);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function isoOrNull(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return new Date(value).toISOString();
  return null;
}

export function formatIsoLabel(value: string) {
  const formatted = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
  return `${formatted} Israel time`;
}
