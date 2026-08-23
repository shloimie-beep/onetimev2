export type ParentPreferencesSnapshot = {
  household_id: string;
  time_zone: string;
  portal_class_reminders: boolean;
  email_class_reminders: boolean;
  whatsapp_class_reminders: false;
  whatsapp_available: false;
  parent_newsletter_consent: boolean;
  newsletter_consent_policy_version: string;
  newsletter_consent_recorded_at: string | null;
  active_student_count: number;
  revision: number;
  updated_at: string;
};

export type ParentPreferencesPrincipal = {
  adult_id: string;
  household_id: string;
};

export type ParentPreferencesScope = {
  account_key: string;
  product: 'one_time_mishnayos';
  runtime_tier: 'isolated_staging' | 'production';
  verification_environment_id:
    | 'ci'
    | 'provider_sandbox'
    | 'persistent_staging'
    | 'production_read_only'
    | 'production_operator_canary'
    | 'production_broad';
};

export type ParentPreferencesUpdate = {
  time_zone: string;
  portal_class_reminders: boolean;
  email_class_reminders: boolean;
  parent_newsletter_consent: boolean;
  expected_revision: number;
};

export class ParentPreferencesError extends Error {
  constructor(
    readonly code:
      | 'parent_preferences_missing'
      | 'parent_preferences_conflict'
      | 'parent_preferences_idempotency_conflict',
    message: string,
  ) {
    super(message);
    this.name = 'ParentPreferencesError';
  }
}

type SqlResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};
type SqlClient = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
};
export type ParentPreferencesSqlPool = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  connect(): Promise<SqlClient>;
};

export function createPostgresParentPreferencesRepository(
  pool: ParentPreferencesSqlPool,
  scope: ParentPreferencesScope,
) {
  return {
    async load(principal: ParentPreferencesPrincipal) {
      const result = await readSnapshot(pool, principal, scope);
      if (!result) {
        throw new ParentPreferencesError(
          'parent_preferences_missing',
          'Parent preferences are unavailable for this household.',
        );
      }
      return result;
    },

    async update(input: {
      principal: ParentPreferencesPrincipal;
      command: ParentPreferencesUpdate;
      idempotency_key: string;
      canonical_request_hash: string;
      occurred_at: Date;
    }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const replay = await client.query<{
          canonical_request_hash: string;
          response_json: unknown;
        }>(
          `SELECT canonical_request_hash, response_json
             FROM onetime.v21_parent_preference_commands
            WHERE household_id = $1
              AND idempotency_key = $2`,
          [input.principal.household_id, input.idempotency_key],
        );
        const priorCommand = replay.rows[0];
        if (priorCommand) {
          if (priorCommand.canonical_request_hash !== input.canonical_request_hash) {
            throw new ParentPreferencesError(
              'parent_preferences_idempotency_conflict',
              'This preference request key was already used for different values.',
            );
          }
          await client.query('COMMIT');
          return priorCommand.response_json as ParentPreferencesSnapshot;
        }

        const household = await client.query(
          `SELECT household_id
             FROM onetime.v21_households
            WHERE household_id = $1
              AND owner_adult_id = $2
              AND classification = 'family'
              AND state = 'active'
              AND product_key = $3
              AND runtime_tier = $4
              AND verification_environment_id = $5
            FOR UPDATE`,
          [
            input.principal.household_id,
            input.principal.adult_id,
            scope.product,
            scope.runtime_tier,
            scope.verification_environment_id,
          ],
        );
        if (household.rowCount !== 1) {
          throw new ParentPreferencesError(
            'parent_preferences_missing',
            'Parent preferences are unavailable for this household.',
          );
        }

        const current = await readSnapshot(client, input.principal, scope);
        if (!current || current.revision !== input.command.expected_revision) {
          throw new ParentPreferencesError(
            'parent_preferences_conflict',
            'Parent preferences changed. Refresh and try again.',
          );
        }
        const newsletterRecordedAt = input.command.parent_newsletter_consent
          ? current.parent_newsletter_consent && current.newsletter_consent_recorded_at
            ? current.newsletter_consent_recorded_at
            : input.occurred_at.toISOString()
          : null;
        const updated = await client.query(
          `INSERT INTO onetime.v21_parent_preferences
             (household_id, owner_adult_id, time_zone, portal_class_reminders,
              email_class_reminders, whatsapp_class_reminders, parent_newsletter_consent,
              newsletter_consent_recorded_at, revision, product_key, runtime_tier,
              verification_environment_id, updated_by_adult_id, updated_at)
           VALUES ($1,$2,$3,$4,$5,false,$6,$7,$8,$9,$10,$11,$2,$12)
           ON CONFLICT (household_id) DO UPDATE
             SET owner_adult_id = EXCLUDED.owner_adult_id,
                 time_zone = EXCLUDED.time_zone,
                 portal_class_reminders = EXCLUDED.portal_class_reminders,
                 email_class_reminders = EXCLUDED.email_class_reminders,
                 whatsapp_class_reminders = false,
                 parent_newsletter_consent = EXCLUDED.parent_newsletter_consent,
                 newsletter_consent_recorded_at = EXCLUDED.newsletter_consent_recorded_at,
                 revision = EXCLUDED.revision,
                 updated_by_adult_id = EXCLUDED.updated_by_adult_id,
                 updated_at = EXCLUDED.updated_at
           WHERE onetime.v21_parent_preferences.revision = $13
           RETURNING household_id`,
          [
            input.principal.household_id,
            input.principal.adult_id,
            input.command.time_zone,
            input.command.portal_class_reminders,
            input.command.email_class_reminders,
            input.command.parent_newsletter_consent,
            newsletterRecordedAt,
            current.revision + 1,
            scope.product,
            scope.runtime_tier,
            scope.verification_environment_id,
            input.occurred_at,
            current.revision,
          ],
        );
        if (updated.rowCount !== 1) {
          throw new ParentPreferencesError(
            'parent_preferences_conflict',
            'Parent preferences changed. Refresh and try again.',
          );
        }

        await projectStudentReminderPreferences(client, input, scope);
        const next = await readSnapshot(client, input.principal, scope);
        if (!next) throw new Error('parent_preferences_projection_missing');
        await client.query(
          `INSERT INTO onetime.v21_parent_preference_commands
             (household_id, idempotency_key, canonical_request_hash, response_json, created_at)
           VALUES ($1,$2,$3,$4::jsonb,$5)`,
          [
            input.principal.household_id,
            input.idempotency_key,
            input.canonical_request_hash,
            JSON.stringify(next),
            input.occurred_at,
          ],
        );
        await client.query('COMMIT');
        return next;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

async function readSnapshot(
  db: Pick<ParentPreferencesSqlPool, 'query'>,
  principal: ParentPreferencesPrincipal,
  scope: ParentPreferencesScope,
): Promise<ParentPreferencesSnapshot | null> {
  const result = await db.query(
    `SELECT household.household_id,
            COALESCE(preferences.time_zone, signup.household_timezone, 'Asia/Jerusalem') AS time_zone,
            COALESCE(preferences.portal_class_reminders, false) AS portal_class_reminders,
            COALESCE(preferences.email_class_reminders, false) AS email_class_reminders,
            false AS whatsapp_class_reminders,
            COALESCE(preferences.parent_newsletter_consent, signup.parent_newsletter_consent, false)
              AS parent_newsletter_consent,
            COALESCE(preferences.newsletter_consent_policy_version,
              'parent-newsletter-v2.1-2026-08-05') AS newsletter_consent_policy_version,
            CASE
              WHEN preferences.household_id IS NOT NULL THEN preferences.newsletter_consent_recorded_at
              WHEN COALESCE(signup.parent_newsletter_consent, false) THEN signup.committed_at
              ELSE NULL
            END AS newsletter_consent_recorded_at,
            COALESCE(preferences.revision, 1) AS revision,
            COALESCE(preferences.updated_at, signup.committed_at, household.updated_at) AS updated_at,
            (SELECT count(*)::integer
               FROM onetime.v21_student_profiles AS student
              WHERE student.household_id = household.household_id
                AND student.product_key = household.product_key
                AND student.runtime_tier = household.runtime_tier
                AND student.verification_environment_id = household.verification_environment_id
                AND student.state = 'active') AS active_student_count
       FROM onetime.v21_households AS household
       LEFT JOIN onetime.v21_parent_preferences AS preferences
         ON preferences.household_id = household.household_id
        AND preferences.product_key = household.product_key
        AND preferences.runtime_tier = household.runtime_tier
        AND preferences.verification_environment_id = household.verification_environment_id
       LEFT JOIN LATERAL (
         SELECT request.household_timezone,
                request.parent_newsletter_consent,
                request.committed_at
           FROM onetime.family_signup_requests AS request
          WHERE request.household_id = household.household_id
            AND request.product = household.product_key
            AND request.runtime_tier = household.runtime_tier
            AND request.verification_environment_id = household.verification_environment_id
          ORDER BY request.committed_at DESC
          LIMIT 1
       ) AS signup ON true
      WHERE household.household_id = $1
        AND household.owner_adult_id = $2
        AND household.classification = 'family'
        AND household.state = 'active'
        AND household.product_key = $3
        AND household.runtime_tier = $4
        AND household.verification_environment_id = $5`,
    [
      principal.household_id,
      principal.adult_id,
      scope.product,
      scope.runtime_tier,
      scope.verification_environment_id,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    household_id: String(row.household_id),
    time_zone: String(row.time_zone),
    portal_class_reminders: row.portal_class_reminders === true,
    email_class_reminders: row.email_class_reminders === true,
    whatsapp_class_reminders: false,
    whatsapp_available: false,
    parent_newsletter_consent: row.parent_newsletter_consent === true,
    newsletter_consent_policy_version: String(row.newsletter_consent_policy_version),
    newsletter_consent_recorded_at: nullableIso(row.newsletter_consent_recorded_at),
    active_student_count: Number(row.active_student_count),
    revision: Number(row.revision),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

async function projectStudentReminderPreferences(
  client: SqlClient,
  input: {
    principal: ParentPreferencesPrincipal;
    command: ParentPreferencesUpdate;
    occurred_at: Date;
  },
  scope: ParentPreferencesScope,
) {
  for (const [channel, enabled] of [
    ['portal', input.command.portal_class_reminders],
    ['email', input.command.email_class_reminders],
    ['whatsapp', false],
  ] as const) {
    await client.query(
      `INSERT INTO onetime.classroom_reminder_preferences
         (preference_key, account_key, product_key, household_key, learner_key, channel,
          preference_state, suppression_state, updated_by_user_ref, updated_at, metadata)
       SELECT concat('v21-parent:', student.student_id, ':', $7),
              $3,
              $4,
              student.household_id,
              student.student_id,
              $7,
              $8,
              'active',
              $2,
              $9,
              jsonb_build_object('source', 'v21_parent_preferences', 'household_id', $1)
         FROM onetime.v21_student_profiles AS student
         JOIN onetime.portal_learners AS learner
           ON learner.learner_key = student.student_id
          AND learner.account_key = $3
          AND learner.product_key = $4
        WHERE student.household_id = $1
          AND student.product_key = $4
          AND student.runtime_tier = $5
          AND student.verification_environment_id = $6
          AND student.state = 'active'
       ON CONFLICT (account_key, product_key, learner_key, channel) DO UPDATE
         SET preference_state = EXCLUDED.preference_state,
             suppression_state = 'active',
             updated_by_user_ref = EXCLUDED.updated_by_user_ref,
             updated_at = EXCLUDED.updated_at,
             metadata = EXCLUDED.metadata`,
      [
        input.principal.household_id,
        input.principal.adult_id,
        scope.account_key,
        scope.product,
        scope.runtime_tier,
        scope.verification_environment_id,
        channel,
        enabled ? 'opted_in' : 'opted_out',
        input.occurred_at,
      ],
    );
  }
}

function nullableIso(value: unknown) {
  return value === null || value === undefined ? null : new Date(String(value)).toISOString();
}
