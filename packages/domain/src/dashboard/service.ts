import type { AppConfig } from '../../../config/src/index.ts';
import type {
  OwnerDashboard,
  OwnerDashboardSection,
  OwnerDashboardSectionState,
  VisibleAction,
} from '../../../contracts/src/dashboard/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import type { AuthenticatedSession } from '../auth/service.ts';

type QueryCountRow = Record<string, unknown>;

export function ownerAdminVisibleActions(): VisibleAction[] {
  const readStates = {
    loading: 'Loading bounded data.',
    success: 'Data loaded.',
    error: 'The source could not be loaded.',
    permission: 'The signed-in role cannot use this action.',
    offline: 'Network unavailable; no cached protected data is used.',
  };
  const writeStates = {
    loading: 'Saving request.',
    success: 'Request completed.',
    error: 'The request could not be completed.',
    permission: 'The signed-in role cannot use this action.',
    offline: 'Network unavailable; retry before changing data.',
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
      'Open Billing status',
      'button',
      '/app/dashboard',
      ['owner', 'admin'],
      {
        capability: 'billing:status:read',
        handler: ['GET', '/api/v1/dashboard/owner'],
        idempotency: [false, null],
        audit: ['local_read', 'billing_status_read'],
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
      'Products/Billing status',
      'route',
      '/app/billing',
      ['owner', 'admin'],
      {
        capability: 'billing:status:read',
        handler: ['GET', '/api/v1/dashboard/owner'],
        idempotency: [false, null],
        audit: ['local_read', 'billing_status_read'],
        states: readStates,
      },
    ),
    action(
      'billing.status.refresh.button',
      'Refresh billing status',
      'button',
      '/app/billing',
      ['owner', 'admin'],
      {
        capability: 'billing:status:read',
        handler: ['GET', '/api/v1/dashboard/owner'],
        idempotency: [false, null],
        audit: ['local_read', 'billing_status_read'],
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
  const [newLeads, nextClass, communications, content, portalAccounts, billingReadiness] =
    await Promise.all([
      newLeadsSection(input.pool, input.config),
      nextClassSection(input.pool, input.config, now),
      communicationsSection(input.pool, input.config),
      contentReviewSection(input.pool, input.config),
      portalAccountSection(input.pool, input.config),
      billingSection(input.pool, input.config),
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
      billingReadiness,
      supportSection(),
    ],
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
  if (!row) return unavailable('new_leads', 'New leads', 'CRM contact source is unavailable.');
  const count = numberValue(row.count);
  return section({
    id: 'new_leads',
    label: 'New leads',
    state: count > 0 ? 'action_required' : 'ready',
    value: count,
    valueLabel: `${count} new`,
    detail:
      count > 0
        ? 'New CRM leads are waiting for review.'
        : 'CRM is connected and no new leads are waiting.',
    href: '/app/crm',
    capability: 'crm:contacts:read',
    updatedAt: isoOrNull(row.updated_at),
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
    return unavailable('next_class', 'Next class', 'Class occurrence source is unavailable.');
  }
  if (!row) {
    return section({
      id: 'next_class',
      label: 'Next class',
      state: 'needs_setup',
      value: null,
      valueLabel: 'Needs setup',
      detail: 'No upcoming class occurrence is recorded yet.',
      href: '/app/classes',
      capability: 'classes:read',
      updatedAt: null,
    });
  }
  const startsAt = isoOrNull(row.starts_at);
  const accessState = String(row.access_state ?? 'provider_unavailable');
  return section({
    id: 'next_class',
    label: 'Next class',
    state: accessState === 'ready' ? 'ready' : 'needs_setup',
    value: null,
    valueLabel: startsAt ? formatIsoLabel(startsAt) : 'Scheduled',
    detail: `${String(row.title ?? 'Class')} is ${String(
      row.occurrence_state ?? 'scheduled',
    )}; launch provider is ${readable(accessState)}.`,
    href: '/app/classes',
    capability: 'classes:read',
    updatedAt: startsAt,
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
      'Communications/delivery',
      'Outbox source is unavailable.',
    );
  }
  const pending = numberValue(row.pending_count);
  const total = numberValue(row.total_count);
  return section({
    id: 'communications_delivery',
    label: 'Communications/delivery',
    state: pending > 0 ? 'action_required' : 'ready',
    value: pending,
    valueLabel: `${pending} pending`,
    detail:
      total > 0
        ? `${total} local sink intent records are available for review.`
        : 'Outbox sink is connected and has no local intents yet.',
    href: '/app/communications',
    capability: 'communications:read',
    updatedAt: isoOrNull(row.updated_at),
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
    return unavailable('content_review', 'Content review', 'Content library is unavailable.');
  const total = numberValue(row.total_count);
  const review = numberValue(row.review_count);
  const published = numberValue(row.published_count);
  return section({
    id: 'content_review',
    label: 'Content review',
    state: review > 0 ? 'action_required' : total > 0 ? 'ready' : 'needs_setup',
    value: review,
    valueLabel: `${review} review needed`,
    detail:
      total > 0
        ? `${published} published library items; ${review} need review.`
        : 'No content outcome has been admitted yet.',
    href: '/app/content',
    capability: 'content:library:read',
    updatedAt: isoOrNull(row.updated_at),
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
      'Portal/account setup',
      'Portal account source is unavailable.',
    );
  }
  const households = numberValue(row.household_count);
  const learners = numberValue(row.learner_count);
  const setup = numberValue(row.setup_count);
  const pendingDelivery = numberValue(row.pending_delivery_count);
  const needsSetup = households === 0 || learners === 0;
  return section({
    id: 'portal_account_setup',
    label: 'Portal/account setup',
    state: needsSetup
      ? 'needs_setup'
      : setup > 0 || pendingDelivery > 0
        ? 'action_required'
        : 'ready',
    value: setup + pendingDelivery,
    valueLabel: `${setup + pendingDelivery} setup items`,
    detail:
      households === 0
        ? 'No active portal households are configured.'
        : `${households} households and ${learners} learners; ${setup} student access records need setup or reset.`,
    href: null,
    capability: 'accounts:lifecycle:read',
    updatedAt: null,
  });
}

async function billingSection(pool: DbPool, config: AppConfig): Promise<OwnerDashboardSection> {
  const row = await optionalCountRow(
    pool,
    `SELECT
        (SELECT count(*)::int FROM onetime.billing_offer_prices
          WHERE account_key = $1 AND product_key = $2 AND archived_at IS NULL) AS price_count,
        (SELECT count(*)::int FROM onetime.billing_subscription_projections
          WHERE account_key = $1 AND product_key = $2
            AND status IN ('trialing', 'active', 'past_due', 'manual_review')) AS subscription_count,
        (SELECT max(updated_at) FROM onetime.billing_subscription_projections
          WHERE account_key = $1 AND product_key = $2) AS updated_at`,
    [config.accountKey, config.productKey],
  );
  if (!row) {
    return unavailable(
      'billing_readiness',
      'Products/Billing status',
      'Billing projection source is unavailable.',
    );
  }
  const prices = numberValue(row.price_count);
  const subscriptions = numberValue(row.subscription_count);
  return section({
    id: 'billing_readiness',
    label: 'Products/Billing status',
    state: prices > 0 ? 'ready' : 'needs_setup',
    value: subscriptions,
    valueLabel: prices > 0 ? `${subscriptions} subscriptions` : 'Needs setup',
    detail:
      prices > 0
        ? 'Synthetic billing status projections are readable; payment transport remains disabled.'
        : 'No synthetic billing price is configured for this product.',
    href: '/app/billing',
    capability: 'billing:status:read',
    updatedAt: isoOrNull(row.updated_at),
  });
}

function supportSection(): OwnerDashboardSection {
  return section({
    id: 'support',
    label: 'Support',
    state: 'unavailable',
    value: null,
    valueLabel: 'Unavailable',
    detail: 'No owner/admin support source is mounted in this build.',
    href: null,
    capability: 'support:read',
    updatedAt: null,
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
  href: string | null;
  capability: string;
  updatedAt: string | null;
}): OwnerDashboardSection {
  return {
    id: input.id,
    label: input.label,
    state: input.state,
    value: input.value,
    value_label: input.valueLabel,
    detail: input.detail,
    href: input.href,
    capability: input.capability,
    updated_at: input.updatedAt,
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
    state: 'unavailable',
    value: null,
    valueLabel: 'Unavailable',
    detail,
    href: null,
    capability: `${id}:read`,
    updatedAt: null,
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

function formatIsoLabel(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function readable(value: string) {
  return value.replaceAll('_', ' ');
}
