export {
  authorizePrivacyRoute,
  createPrivacyService,
  type PrivacyRoute,
  type PrivacyServiceRepository,
} from './privacy-service.ts';
export { createParentPrivacyRouter, PARENT_PRIVACY_POLICY_VERSIONS } from './parent-router.ts';
export {
  createStudentPrivacyRouter,
  STUDENT_PRIVACY_POLICY_VERSIONS,
  type SelfManagedStudentPrivacyPrincipal,
} from './student-router.ts';
export { createPostgresParentPrivacySubjectRepository } from './parent-subject-repository.ts';
