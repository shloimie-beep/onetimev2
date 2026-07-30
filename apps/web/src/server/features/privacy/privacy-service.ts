import type {
  ConsentEvent,
  ConsentMutationInput,
  DataRightsRequest,
  DataRightsRequestInput,
  PrivacyPersistenceScope,
  PrivacyActorContext,
  StudentConsentSubject,
} from '../../../../../../packages/contracts/src/privacy/index.ts';
import {
  appendConsentEvent,
  createDataRightsRequest,
  decideRecordedClassJoin,
  parentExportCategories,
} from '../../../../../../packages/domain/src/privacy/index.ts';

export type PrivacyRoute =
  | 'parent_privacy'
  | 'parent_data_rights'
  | 'self_student_privacy'
  | 'self_student_data_rights'
  | 'admin_privacy_review';

export interface PrivacyServiceRepository {
  listConsentEvents(studentId: string): Promise<readonly ConsentEvent[]>;
  appendConsentEvent(event: ConsentEvent): Promise<boolean>;
  createDataRightsRequest(request: DataRightsRequest): Promise<boolean>;
}

export function authorizePrivacyRoute(
  actor: PrivacyActorContext,
  route: PrivacyRoute,
  subject?: StudentConsentSubject,
): boolean {
  if (route === 'admin_privacy_review') return actor.role === 'admin';
  if (route === 'parent_privacy' || route === 'parent_data_rights') {
    return actor.role === 'parent' && actor.adult_id !== null && actor.household_id !== null;
  }
  return (
    actor.role === 'student' &&
    subject?.relationship === 'self' &&
    actor.student_id === subject.student_id &&
    actor.adult_id !== null &&
    actor.adult_id === subject.self_adult_id &&
    actor.adult_id === subject.owner_adult_id
  );
}

export function createPrivacyService(
  repository: PrivacyServiceRepository,
  trustedScope: PrivacyPersistenceScope,
) {
  return {
    async recordConsent(input: ConsentMutationInput) {
      const existing = await repository.listConsentEvents(input.subject.student_id);
      const result = appendConsentEvent(existing, input);
      if (result.disposition === 'appended') {
        const persisted = await repository.appendConsentEvent(result.event);
        if (!persisted) throw new Error('privacy_consent_write_conflict');
      }
      return result;
    },

    async recordedJoinDecision(input: {
      actor: PrivacyActorContext;
      subject: StudentConsentSubject;
      current_policy_versions: ConsentMutationInput['policy_versions'];
    }) {
      if (input.actor.role !== 'student' || input.actor.student_id !== input.subject.student_id) {
        return { allowed: false, safe_code: 'actor_mismatch' } as const;
      }
      const events = await repository.listConsentEvents(input.subject.student_id);
      return decideRecordedClassJoin({
        subject: input.subject,
        events,
        current_policy_versions: input.current_policy_versions,
      });
    },

    async createRightsRequest(input: Omit<DataRightsRequestInput, 'scope'>) {
      const request = createDataRightsRequest({ ...input, scope: trustedScope });
      const persisted = await repository.createDataRightsRequest(request);
      if (!persisted) throw new Error('privacy_request_write_conflict');
      return request;
    },

    parentExportDisclosure() {
      return parentExportCategories();
    },
  };
}
