import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('P22 authenticated client-route registration', () => {
  it('wires Admin and Student shells without a Parent learning client', async () => {
    const [crmEntry, portalEntry, portalApi] = await Promise.all([
      readFile('apps/web/src/client/app/crm-entry.tsx', 'utf8'),
      readFile('apps/web/src/client/app/portal-entry.tsx', 'utf8'),
      readFile('apps/web/src/client/app/portal-api.ts', 'utf8'),
    ]);
    expect(crmEntry).toContain('AdminLearningWorkspace');
    expect(crmEntry).toContain("['questions', 'rewards', 'attendance']");
    expect(crmEntry).toContain('getAdminAttendanceSnapshot');
    expect(portalEntry).toContain('StudentLearningOverview');
    expect(portalApi).toContain("'/api/app/learning/student-snapshot'");
    expect(portalApi).not.toMatch(/parent.*\/api\/app\/learning/iu);
  });
});
