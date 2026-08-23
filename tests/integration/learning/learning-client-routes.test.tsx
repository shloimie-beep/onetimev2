import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('P22 authenticated client-route registration', () => {
  it('wires Admin and Student shells without a Parent learning client', async () => {
    const [crmEntry, crmApi, adminLearning, portalEntry, portalApi] = await Promise.all([
      readFile('apps/web/src/client/app/crm-entry.tsx', 'utf8'),
      readFile('apps/web/src/client/app/crm-api.ts', 'utf8'),
      readFile('apps/web/src/client/app/admin/learning/AdminLearningWorkspace.tsx', 'utf8'),
      readFile('apps/web/src/client/app/portal-entry.tsx', 'utf8'),
      readFile('apps/web/src/client/app/portal-api.ts', 'utf8'),
    ]);
    expect(crmEntry).toContain('AdminLearningWorkspace');
    expect(crmEntry).toContain("['questions', 'rewards', 'attendance']");
    expect(crmEntry).toContain('getAdminAttendanceSnapshot');
    expect(crmEntry).toContain('transitionAdminQuestion(csrfToken, transition)');
    expect(crmApi).toContain(
      '/api/app/learning/questions/${encodeURIComponent(input.questionId)}/transitions',
    );
    expect(adminLearning).toContain('questionModerationOptions(question.state)');
    expect(adminLearning).toContain('expectedVersion: question.version');
    expect(portalEntry).toContain('StudentLearningOverview');
    expect(portalApi).toContain("'/api/app/learning/student-snapshot'");
    expect(portalApi).not.toMatch(/parent.*\/api\/app\/learning/iu);
  });
});
