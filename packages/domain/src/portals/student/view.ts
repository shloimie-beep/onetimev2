import {
  STUDENT_PORTAL_CONTRACT_VERSION,
  type StudentPortalBootstrap,
  type StudentPortalPrincipal,
  type StudentSelfRecord,
  type StudentTodaySnapshot,
} from '../../../../contracts/src/portals/student/index.ts';
import { assertStudentSelfRecord } from './isolation.ts';
import { studentNavigation } from './navigation.ts';

export function buildStudentPortalBootstrap(input: {
  principal: StudentPortalPrincipal;
  profile: StudentSelfRecord;
  today: StudentTodaySnapshot;
}): StudentPortalBootstrap {
  const profile = assertStudentSelfRecord(input.principal, input.profile);
  return {
    contractVersion: STUDENT_PORTAL_CONTRACT_VERSION,
    profile: {
      studentId: profile.studentId,
      actualName: profile.actualName,
      displayName: profile.displayName?.trim() || profile.actualName,
      username: profile.username,
      relationship: profile.relationship,
    },
    today: input.today,
    account: {
      username: profile.username,
      credentialManagedBy: 'parent_or_admin',
      canChangePassword: false,
      canViewCurrentPassword: false,
      credentialHelp:
        'Ask your account owner or One Time support if you need help with your username or password.',
      canLogout: true,
    },
    navigation: studentNavigation(input.principal),
    preferredTimeZone: input.principal.preferredTimeZone,
  };
}
