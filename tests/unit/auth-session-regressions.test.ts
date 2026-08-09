import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('v2.1 protected-session regressions', () => {
  it('keeps 403 and CSRF failures scoped in CRM clients', () => {
    expect(read('apps/web/src/client/app/crm-api.ts')).toContain(
      'if (response.status === 401) throw new AuthExpiredError();',
    );
    expect(read('apps/web/src/client/app/crm/ot42-lazy-tabs.ts')).toContain(
      'if (response.status === 401) {',
    );
    const communications = read('apps/web/src/client/app/communications/CommunicationsFeature.tsx');
    expect(communications).toContain('error.status === 401');
    expect(communications).toContain("if (mapped.kind === 'unauthenticated')");
    const directory = read('apps/web/src/client/app/admin-directory/AdminDirectoryPanel.tsx');
    expect(directory).toContain("error.code === 'UNAUTHENTICATED'");
    expect(directory).not.toContain(
      "error.code === 'UNAUTHENTICATED' || error.code === 'CSRF_REQUIRED'",
    );
    expect(read('apps/web/src/client/app/admin/search/AdminGlobalSearch.tsx')).toContain(
      'constructor(public readonly status: 401 | 403)',
    );
    const crmEntry = read('apps/web/src/client/app/crm-entry.tsx');
    expect(crmEntry).toContain(
      'error instanceof AdminPrivateAuthorizationError && error.status === 401',
    );
  });

  it('commits a valid CRM session before the ancillary assignee request', () => {
    const crmEntry = read('apps/web/src/client/app/crm-entry.tsx');
    const sessionIndex = crmEntry.indexOf('setSession(json);');
    const assigneeIndex = crmEntry.indexOf('const assigneeJson = await getAssignees();');
    expect(sessionIndex).toBeGreaterThan(-1);
    expect(assigneeIndex).toBeGreaterThan(sessionIndex);
    expect(crmEntry).toContain('if (error instanceof AuthExpiredError) {');
  });

  it('keeps v2.1 resolver unavailable outcomes explicit at bounded server gates', () => {
    const app = read('apps/web/src/server/app.ts');
    expect(app).toContain("if (resolution.status === 'unavailable') return { unavailable: true };");
    expect(app).toContain('cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)');
    expect(read('apps/web/src/server/ops-routes.ts')).toContain('OPS_DIAGNOSTICS_UNAVAILABLE');
    expect(read('apps/web/src/server/features/contact-operations/router.ts')).toContain(
      'CONTACT_OPERATIONS_UNAVAILABLE',
    );
    expect(read('apps/web/src/server/features/admin-directory/router.ts')).toContain(
      'ADMIN_DIRECTORY_UNAVAILABLE',
    );
    expect(read('apps/web/src/server/features/signup/school/approved-school-router.ts')).toContain(
      'APPROVED_SCHOOLS_UNAVAILABLE',
    );
  });
});
