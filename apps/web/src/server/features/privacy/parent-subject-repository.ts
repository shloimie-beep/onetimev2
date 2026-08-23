import type { StudentConsentSubject } from '../../../../../../packages/contracts/src/privacy/index.ts';

type SqlResult<Row = Record<string, unknown>> = { rows: Row[] };
export type ParentPrivacySqlPool = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
};

export type ParentPrivacySubject = StudentConsentSubject & {
  display_name: string;
  state: 'active' | 'archived';
};

export function createPostgresParentPrivacySubjectRepository(
  pool: ParentPrivacySqlPool,
  scope: {
    product: 'one_time_mishnayos';
    runtime_tier: 'isolated_staging' | 'production';
    verification_environment_id: string;
  },
) {
  return {
    async list(input: { household_id: string; owner_adult_id: string }) {
      const result = await pool.query(
        `SELECT student.student_id,
                student.household_id,
                student.relationship,
                student.owner_adult_id,
                student.self_adult_id,
                COALESCE(NULLIF(student.display_name, ''), student.actual_name) AS display_name,
                student.state
           FROM onetime.v21_student_profiles AS student
           JOIN onetime.v21_households AS household
             ON household.household_id = student.household_id
            AND household.product_key = student.product_key
            AND household.runtime_tier = student.runtime_tier
            AND household.verification_environment_id = student.verification_environment_id
          WHERE household.household_id = $1
            AND household.owner_adult_id = $2
            AND household.classification = 'family'
            AND household.state = 'active'
            AND household.product_key = $3
            AND household.runtime_tier = $4
            AND household.verification_environment_id = $5
          ORDER BY CASE student.state WHEN 'active' THEN 0 ELSE 1 END,
                   student.created_at,
                   student.student_id`,
        [
          input.household_id,
          input.owner_adult_id,
          scope.product,
          scope.runtime_tier,
          scope.verification_environment_id,
        ],
      );
      return result.rows.map((row): ParentPrivacySubject => ({
        student_id: String(row.student_id),
        household_id: String(row.household_id),
        relationship: String(row.relationship) as ParentPrivacySubject['relationship'],
        owner_adult_id: String(row.owner_adult_id),
        self_adult_id: row.self_adult_id === null ? null : String(row.self_adult_id),
        display_name: String(row.display_name),
        state: String(row.state) as ParentPrivacySubject['state'],
      }));
    },
  };
}
