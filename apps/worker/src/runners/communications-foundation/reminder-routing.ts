import type {
  CommunicationFoundationRepository,
  PlanClassReminderRoutingInput,
  ReminderPreference,
} from '../../../../../packages/contracts/src/communications/foundation/index.ts';
import { planClassReminderRouting } from '../../../../../packages/domain/src/communications/foundation/index.ts';
import {
  runEmailFirstCommunication,
  type CommunicationEmailPort,
  type CommunicationSuppressionReadPort,
  type EmailFirstCommunicationResult,
} from './runner.ts';

export interface RunClassReminderRoutingInput {
  routing: PlanClassReminderRoutingInput;
  repository: CommunicationFoundationRepository;
  preference: ClassReminderPreferenceReadPort;
  suppression: CommunicationSuppressionReadPort;
  email: CommunicationEmailPort;
}

export interface ClassReminderPreferenceReadPort {
  readCurrent(adult_id: string): Promise<ReminderPreference>;
}

export type ClassReminderHouseholdRunResult = {
  operation_id: string;
  household_id: string;
  result: EmailFirstCommunicationResult;
};

export type ClassReminderRoutingRunResult =
  | {
      state: 'partial_preparation';
      safe_reason: 'named_student_not_ready';
      household_results: readonly [];
      email_provider_calls: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'routed' | 'retry_pending';
      household_results: readonly ClassReminderHouseholdRunResult[];
      email_provider_calls: number;
      whatsapp_provider_calls: 0;
      prepared_in_app_access: 'preserved';
      email_failure_visible: boolean;
    };

export async function runClassReminderRouting(
  input: RunClassReminderRoutingInput,
): Promise<ClassReminderRoutingRunResult> {
  const routingPlan = planClassReminderRouting(input.routing);
  if (routingPlan.disposition === 'partial_preparation') {
    return {
      state: 'partial_preparation',
      safe_reason: routingPlan.safe_reason,
      household_results: [],
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }

  const householdResults: ClassReminderHouseholdRunResult[] = [];
  for (const intent of routingPlan.intents) {
    const currentPreference = await input.preference.readCurrent(intent.account_owner_adult_id);
    const result = await runEmailFirstCommunication({
      plan_input: {
        ...intent.plan_input,
        reminder_preference: currentPreference,
      },
      sender_key: intent.sender_key,
      expected_version: intent.expected_version,
      repository: input.repository,
      suppression: input.suppression,
      email: input.email,
      safe_message: intent.message,
    });
    householdResults.push({
      operation_id: intent.operation_id,
      household_id: intent.household_id,
      result,
    });
  }

  const emailFailureVisible = householdResults.some(
    ({ result }) => result.state === 'retry_pending',
  );
  return {
    state: emailFailureVisible ? 'retry_pending' : 'routed',
    household_results: householdResults,
    email_provider_calls: householdResults.reduce<number>(
      (count, { result }) => count + result.email_provider_calls,
      0,
    ),
    whatsapp_provider_calls: 0,
    prepared_in_app_access: 'preserved',
    email_failure_visible: emailFailureVisible,
  };
}
