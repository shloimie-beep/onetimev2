import type {
  ClassReminderHouseholdCandidate,
  ClassReminderRoutingPlan,
  PlanClassReminderRoutingInput,
} from '../../../../contracts/src/communications/foundation/index.ts';
import {
  CLASS_REMINDER_APP_PATH,
  CLASS_REMINDER_LEAD_MS,
  CLASS_REMINDER_ROUTING_REQUEST_ID,
} from '../../../../contracts/src/communications/foundation/index.ts';
import { CommunicationFoundationError } from './errors.ts';
import { planCommunicationChannels } from './preference.ts';

export function planClassReminderRouting(
  input: PlanClassReminderRoutingInput,
): ClassReminderRoutingPlan {
  assertNonempty(input.occurrence_id);
  const occurrenceStartsAt = parseInstant(input.occurrence_starts_at);
  if (input.households.length === 0) {
    invalid();
  }

  const operationIds = new Set<string>();
  const householdIds = new Set<string>();
  for (const household of input.households) {
    assertCandidate(household, occurrenceStartsAt);
    if (operationIds.has(household.operation_id) || householdIds.has(household.household_id)) {
      invalid();
    }
    operationIds.add(household.operation_id);
    householdIds.add(household.household_id);
  }

  if (
    input.households.some((household) =>
      household.student_preparations.some(
        (student) =>
          student.registrant_state !== 'active' || student.protected_portal_state !== 'ready',
      ),
    )
  ) {
    return {
      disposition: 'partial_preparation',
      safe_reason: 'named_student_not_ready',
      intents: [],
      provider_calls: 0,
    };
  }

  return {
    disposition: 'ready',
    intents: [...input.households]
      .sort((left, right) => left.household_id.localeCompare(right.household_id))
      .map((household) => {
        const affectedStudentLabels = [...household.student_labels].sort();
        const planInput = {
          operation_id: household.operation_id,
          subject: {
            kind: 'adult',
            adult_id: household.account_owner_adult_id,
            household_id: household.household_id,
          },
          purpose: 'optional_reminder',
          reminder_preference: household.reminder_preference,
          marketing_permission: false,
          suppression: household.suppression,
        } as const;
        return {
          request_id: CLASS_REMINDER_ROUTING_REQUEST_ID,
          operation_id: household.operation_id,
          occurrence_id: input.occurrence_id,
          household_id: household.household_id,
          account_owner_adult_id: household.account_owner_adult_id,
          scheduled_for: household.scheduled_for,
          sender_key: 'office',
          plan_input: planInput,
          channel_plan: planCommunicationChannels(planInput),
          message: {
            kind: 'account_owner_class_reminder',
            affected_student_labels: affectedStudentLabels,
            app_path: CLASS_REMINDER_APP_PATH,
            contains_zoom_url: false,
            contains_launch_grant: false,
            contains_technical_alias: false,
            contains_student_authentication: false,
          },
          expected_version: household.expected_version,
          prepared_in_app_access: 'preserve_independent_of_email',
        };
      }),
    provider_calls: 0,
  };
}

function assertCandidate(household: ClassReminderHouseholdCandidate, occurrenceStartsAt: number) {
  assertNonempty(household.operation_id);
  assertNonempty(household.household_id);
  assertNonempty(household.account_owner_adult_id);
  if (
    household.app_path !== CLASS_REMINDER_APP_PATH ||
    household.expected_version < 0 ||
    !Number.isInteger(household.expected_version) ||
    household.suppression.adult_id !== household.account_owner_adult_id ||
    household.student_labels.length === 0 ||
    household.student_labels.length !== household.student_preparations.length
  ) {
    invalid();
  }
  const scheduledFor = parseInstant(household.scheduled_for);
  if (occurrenceStartsAt - scheduledFor !== CLASS_REMINDER_LEAD_MS) {
    invalid();
  }

  const namedLabels = [...household.student_labels].sort();
  const preparedLabels = household.student_preparations
    .map((student) => student.student_label)
    .sort();
  for (const label of [...namedLabels, ...preparedLabels]) assertNonempty(label);
  if (namedLabels.some((label, index) => label !== preparedLabels[index])) {
    invalid();
  }
}

function parseInstant(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) invalid();
  return parsed;
}

function assertNonempty(value: string) {
  if (value.trim().length === 0) invalid();
}

function invalid(): never {
  throw new CommunicationFoundationError('invalid_class_reminder_routing');
}
