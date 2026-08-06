import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { resolveCurrentClientRoute } from '../../../apps/web/src/client/app/router/registry.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createAccountUser } from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let parentUserKey: string;
let studentUserKey: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  distDir = await mkdtemp(path.join(tmpdir(), 'ot71-portals-'));
  await writePortalShells(distDir);
  parentUserKey = await createAccountUser({
    pool,
    config,
    email: 'parent@example.test',
    password: 'ParentPass!234',
    displayName: 'Parent User',
    role: 'parent',
  });
  studentUserKey = await createAccountUser({
    pool,
    config,
    email: 'student@example.test',
    password: 'StudentPass!234',
    displayName: 'Student User',
    role: 'student',
  });
  await createAccountUser({
    pool,
    config,
    email: 'admin@example.test',
    password: 'AdminPass!234',
    displayName: 'Admin User',
    role: 'admin',
  });
  await seedV21AdminIdentity();
  await seedPortalRecords();
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('OT-71 mounted parent and student portals', () => {
  it('resolves exact locked Parent routes without a generic prefix fallback', () => {
    expect(resolveCurrentClientRoute('/app/parent', 'parent')?.routeId).toBe('RT-PAR-001');
    expect(resolveCurrentClientRoute('/app/parent/students', 'parent')?.routeId).toBe('RT-PAR-002');
    expect(resolveCurrentClientRoute('/app/parent/students/new', 'parent')?.routeId).toBe(
      'RT-PAR-003',
    );
    expect(resolveCurrentClientRoute('/app/parent/students/student-1', 'parent')?.routeId).toBe(
      'RT-PAR-004',
    );
    expect(resolveCurrentClientRoute('/app/parent/not-locked', 'parent')).toBeNull();
  });

  it('does not admit the generic member support route as a role-specific post-login destination', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const parent = await postLogin(
        server.baseUrl,
        'parent@example.test',
        'ParentPass!234',
        '/app/support',
      );
      expect(parent.status).toBe(200);
      expect(parent.json.return_to).toBe('/app/parent');

      const student = await postLogin(
        server.baseUrl,
        'student@example.test',
        'StudentPass!234',
        '/app/support',
      );
      expect(student.status).toBe(200);
      expect(student.json.return_to).toBe('/app/student');

      const canonicalStudent = await postLogin(
        server.baseUrl,
        'student@example.test',
        'StudentPass!234',
        '/app/student/support',
      );
      expect(canonicalStudent.status).toBe(200);
      expect(canonicalStudent.json.return_to).toBe('/app/student/support');

      const admin = await postLogin(
        server.baseUrl,
        'admin@example.test',
        'AdminPass!234',
        '/app/support',
      );
      expect(admin.status).toBe(200);
      expect(admin.json.return_to).toBe('/app/dashboard');
    } finally {
      await server.close();
    }
  });

  it('mounts the public School inquiry and keeps unconfigured Parent Student policy fail closed', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const unavailableParent = await fetch(`${server.baseUrl}/api/app/parent/household`);
      expect(unavailableParent.status).toBe(503);
      expect(unavailableParent.headers.get('cache-control')).toContain('no-store');
      await expect(unavailableParent.json()).resolves.toEqual({
        success: false,
        code: 'PARENT_HOUSEHOLD_UNAVAILABLE',
        message: 'Parent access is temporarily unavailable.',
      });

      const school = await fetch(`${server.baseUrl}/api/v2.1/signup/school-inquiry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          school_name: 'Portal mount School',
          contact_first_name: 'School',
          contact_last_name: 'Administrator',
          email: 'portal-mount-school@example.test',
        }),
      });
      expect(school.status, await school.clone().text()).toBe(201);
      await expect(school.json()).resolves.toMatchObject({
        success: true,
        code: 'SCHOOL_INQUIRY_ACCEPTED',
        provider_effects_completed_inline: 0,
        product_accounts_created: 0,
        households_created: 0,
        student_accounts_created: 0,
        subscriptions_created: 0,
        access_grants_created: 0,
        nurture_workflow_intent_ids: [],
      });
    } finally {
      await server.close();
    }
  });

  it('keeps member support lead-only and role-bounds the canonical Admin classroom', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const publicSupportAlias = await fetch(`${server.baseUrl}/support`, { redirect: 'manual' });
      expect(publicSupportAlias.status).toBe(302);
      expect(publicSupportAlias.headers.get('location')).toBe('/app/support');
      expect(publicSupportAlias.headers.get('cache-control')).toContain('no-store');
      expect(publicSupportAlias.headers.get('x-robots-tag')).toContain('noindex');

      const publicSupport = await fetch(`${server.baseUrl}/app/support`, { redirect: 'manual' });
      expect(publicSupport.status).toBe(200);
      expect(publicSupport.headers.get('cache-control')).toContain('no-store');
      expect(publicSupport.headers.get('x-robots-tag')).toContain('noindex');
      expect(await publicSupport.text()).toContain('Sign in for learning support');

      const anonymousClassroom = await fetch(`${server.baseUrl}/app/classroom`, {
        redirect: 'manual',
      });
      expect(anonymousClassroom.status).toBe(302);
      expect(anonymousClassroom.headers.get('location')).toBe(
        '/login?return_to=%2Fapp%2Fclassroom',
      );

      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const studentClassroom = await fetch(`${server.baseUrl}/app/classroom`, {
        headers: { cookie: student.cookies },
      });
      expect(studentClassroom.status).toBe(403);
      expect(studentClassroom.headers.get('cache-control')).toContain('no-store');
      expect(studentClassroom.headers.get('referrer-policy')).toBe('no-referrer');

      const parent = await loginAs(server.baseUrl, 'parent@example.test', 'ParentPass!234');
      expect(
        (
          await fetch(`${server.baseUrl}/app/classroom`, {
            headers: { cookie: parent.cookies },
          })
        ).status,
      ).toBe(403);

      const admin = await loginAs(server.baseUrl, 'admin@example.test', 'AdminPass!234');
      expect(
        (
          await fetch(`${server.baseUrl}/app/classroom`, {
            headers: { cookie: admin.cookies },
          })
        ).status,
      ).toBe(200);
    } finally {
      await server.close();
    }
  });

  it('keeps a resolved v2.1 Parent session authenticated while returning denial semantics', async () => {
    const v21AdultSessionRuntime = {
      resolveCookieHeader: async () => ({
        status: 'resolved',
        context: { session: { activeRole: 'parent' } },
      }),
    } as never;
    const server = await listenForTest(
      createApp({ config, pool, distDir, v21AdultSessionRuntime }),
    );
    const cookie = '__Host-onetime-session=resolved-v21-parent';
    try {
      for (const requestPath of ['/access-denied', '/app/contacts']) {
        const denied = await fetch(`${server.baseUrl}${requestPath}`, {
          headers: { cookie },
          redirect: 'manual',
        });
        expect(denied.status, requestPath).toBe(403);
        expect(denied.headers.get('cache-control'), requestPath).toContain('no-store');
        expect(denied.headers.getSetCookie().join(';'), requestPath).not.toContain(
          '__Host-onetime-session=;',
        );
      }
      const roleDeniedStudentQuestions = await fetch(`${server.baseUrl}/app/student/questions`, {
        headers: { cookie },
        redirect: 'manual',
      });
      expect(roleDeniedStudentQuestions.status).toBe(403);
      expect(roleDeniedStudentQuestions.headers.get('cache-control')).toContain('no-store');
      expect(roleDeniedStudentQuestions.headers.getSetCookie().join(';')).not.toContain(
        '__Host-onetime-session=;',
      );
    } finally {
      await server.close();
    }
  });

  it('mounts dual-role selection and rotates one v2.1 session between Admin and Parent', async () => {
    const contextFor = (activeRole: 'admin' | 'parent') => ({
      adultId: 'adult_dual_role',
      normalizedEmail: 'dual-role@example.test',
      ownerDisplayName: 'Dual Role Adult',
      ownedHouseholdCount: 1,
      memberships: ['admin', 'parent'] as const,
      session: {
        sessionId: `session_${activeRole}`,
        product: 'one_time_mishnayos',
        runtimeTier: 'isolated_staging',
        verificationEnvironmentId: 'ci',
        humanAccountId: 'account_dual_role',
        activeRole,
        activeHouseholdId: activeRole === 'parent' ? 'household_dual_role' : null,
        securityVersion: 1,
        version: 1,
        idleExpiresAt: '2026-08-04T12:00:00.000Z',
        absoluteExpiresAt: '2026-08-04T18:00:00.000Z',
        revokedAt: null,
        revocationReason: null,
        createdAt: '2026-08-04T10:00:00.000Z',
        updatedAt: '2026-08-04T10:00:00.000Z',
      },
      household:
        activeRole === 'parent'
          ? {
              householdId: 'household_dual_role',
              displayName: 'Dual Role Family',
              classification: 'family',
              accessState: 'free',
              ownerRelationship: 'account_owner',
            }
          : null,
    });
    const v21AdultSessionRuntime = {
      resolveCookieHeader: async ({ cookie_header: cookieHeader }: { cookie_header?: string }) => ({
        status: 'resolved',
        context: contextFor(cookieHeader?.includes('parent-v21') ? 'parent' : 'admin'),
      }),
      switchRoleCookieHeader: async ({
        requested_role: requestedRole,
      }: {
        requested_role: 'admin' | 'parent';
      }) => ({
        switched: true,
        browser_session_token:
          requestedRole === 'parent' ? 'parent-v21-rotated' : 'admin-v21-rotated',
        csrf_token: `c1.${'a'.repeat(43)}.${'b'.repeat(43)}`,
        expires_at: '2026-08-04T12:00:00.000Z',
        active_role: requestedRole,
        memberships: ['admin', 'parent'] as const,
      }),
    } as never;
    const server = await listenForTest(
      createApp({
        config,
        pool,
        distDir,
        v21AdultSessionRuntime,
        clock: () => new Date('2026-08-04T10:00:00.000Z'),
      }),
    );
    const adminCookie = '__Host-onetime-session=admin-v21';
    try {
      const selector = await fetch(`${server.baseUrl}/select-role`, {
        headers: { cookie: adminCookie },
        redirect: 'manual',
      });
      expect(selector.status).toBe(200);
      expect(selector.headers.get('cache-control')).toContain('no-store');
      expect(selector.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      const selectorHtml = await selector.text();
      expect(selectorHtml).toContain('<meta name="robots" content="noindex, nofollow">');
      expect(selectorHtml).toContain('Continue as Admin');
      expect(selectorHtml).toContain('Continue as Parent');

      const adminDashboard = await fetch(`${server.baseUrl}/app/dashboard`, {
        headers: { cookie: adminCookie },
      });
      expect(adminDashboard.status).toBe(200);
      expect(await adminDashboard.text()).toContain('crm-root');

      const switchToParent = await fetch(`${server.baseUrl}/api/v2.1/account-context/role`, {
        method: 'POST',
        headers: {
          cookie: adminCookie,
          origin: config.publicBaseUrl,
          'content-type': 'application/json',
          'x-csrf-token': `c1.${'a'.repeat(43)}.${'b'.repeat(43)}`,
        },
        body: JSON.stringify({ requested_role: 'parent' }),
      });
      expect(switchToParent.status).toBe(200);
      await expect(switchToParent.json()).resolves.toMatchObject({
        active_role: 'parent',
        available_roles: ['admin', 'parent'],
        return_to: '/app/parent',
      });
      const parentCookie = switchToParent.headers
        .getSetCookie()
        .find(
          (value) =>
            value.startsWith('__Host-onetime-session=parent-v21-rotated') &&
            !value.includes('Max-Age=0'),
        )
        ?.split(';')[0];
      expect(parentCookie).toBe('__Host-onetime-session=parent-v21-rotated');

      const parentOverview = await fetch(`${server.baseUrl}/app/parent`, {
        headers: { cookie: parentCookie! },
      });
      expect(parentOverview.status).toBe(200);
      expect(await parentOverview.text()).toContain('portal-root');
      const parentStudentManagement = await fetch(`${server.baseUrl}/app/parent/students`, {
        headers: { cookie: parentCookie! },
      });
      expect(parentStudentManagement.status).toBe(200);
      expect(
        (
          await fetch(`${server.baseUrl}/app/dashboard`, {
            headers: { cookie: parentCookie! },
          })
        ).status,
      ).toBe(403);

      const switchBackToAdmin = await fetch(`${server.baseUrl}/api/v2.1/account-context/role`, {
        method: 'POST',
        headers: {
          cookie: parentCookie!,
          origin: config.publicBaseUrl,
          'content-type': 'application/json',
          'x-csrf-token': `c1.${'a'.repeat(43)}.${'b'.repeat(43)}`,
        },
        body: JSON.stringify({ requested_role: 'admin' }),
      });
      expect(switchBackToAdmin.status).toBe(200);
      await expect(switchBackToAdmin.json()).resolves.toMatchObject({
        active_role: 'admin',
        return_to: '/app/dashboard',
      });
      const rotatedAdminCookie = switchBackToAdmin.headers
        .getSetCookie()
        .find(
          (value) =>
            value.startsWith('__Host-onetime-session=admin-v21-rotated') &&
            !value.includes('Max-Age=0'),
        )
        ?.split(';')[0];
      expect(rotatedAdminCookie).toBe('__Host-onetime-session=admin-v21-rotated');
      expect(
        (
          await fetch(`${server.baseUrl}/app/dashboard`, {
            headers: { cookie: rotatedAdminCookie! },
          })
        ).status,
      ).toBe(200);
    } finally {
      await server.close();
    }
  });

  it('mounts owned-household selection and rotates the Parent session without cross-household disclosure', async () => {
    const csrfToken = `c1.${'a'.repeat(43)}.${'b'.repeat(43)}`;
    const households = [
      {
        householdId: 'household_one',
        displayName: 'First Family',
        classification: 'family',
        accessState: 'free',
        ownerRelationship: 'account_owner',
      },
      {
        householdId: 'household_two',
        displayName: 'Second <Family>',
        classification: 'family',
        accessState: 'active',
        ownerRelationship: 'account_owner',
      },
    ] as const;
    const v21AdultSessionRuntime = {
      householdContextCookieHeader: async () => ({
        status: 'resolved',
        households,
        active_household_id: 'household_one',
        csrf_token: csrfToken,
        expires_at: '2026-08-04T12:00:00.000Z',
      }),
      switchHouseholdCookieHeader: async ({
        selected_household_id: selectedHouseholdId,
      }: {
        selected_household_id: string;
      }) => {
        const household = households.find(
          (candidate) => candidate.householdId === selectedHouseholdId,
        );
        return household
          ? {
              switched: true,
              browser_session_token: 'parent-household-rotated',
              csrf_token: csrfToken,
              expires_at: '2026-08-04T12:00:00.000Z',
              active_household: household,
            }
          : { switched: false, reason: 'invalid_household' };
      },
    } as never;
    const server = await listenForTest(
      createApp({
        config,
        pool,
        distDir,
        v21AdultSessionRuntime,
        clock: () => new Date('2026-08-04T10:00:00.000Z'),
      }),
    );
    const parentCookie = '__Host-onetime-session=parent-household-one';
    try {
      const selector = await fetch(`${server.baseUrl}/select-household`, {
        headers: { cookie: parentCookie },
        redirect: 'manual',
      });
      expect(selector.status).toBe(200);
      expect(selector.headers.get('cache-control')).toContain('no-store');
      expect(selector.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      const selectorHtml = await selector.text();
      expect(selectorHtml).toContain('First Family');
      expect(selectorHtml).toContain('Second &lt;Family&gt;');
      expect(selectorHtml).not.toContain('Second <Family>');

      const listed = await fetch(`${server.baseUrl}/api/v2.1/account-context/households`, {
        headers: { cookie: parentCookie },
      });
      expect(listed.status).toBe(200);
      await expect(listed.json()).resolves.toMatchObject({
        active_household_id: 'household_one',
        households,
        csrf_token: csrfToken,
      });

      const denied = await fetch(`${server.baseUrl}/api/v2.1/account-context/household`, {
        method: 'POST',
        headers: {
          cookie: parentCookie,
          origin: config.publicBaseUrl,
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ selected_household_id: 'household_not_owned' }),
      });
      expect(denied.status).toBe(403);
      await expect(denied.json()).resolves.toMatchObject({
        success: false,
        code: 'FORBIDDEN',
        message: 'That household is not available for this account.',
      });
      expect(denied.headers.getSetCookie()).toHaveLength(0);

      const switched = await fetch(`${server.baseUrl}/api/v2.1/account-context/household`, {
        method: 'POST',
        headers: {
          cookie: parentCookie,
          origin: config.publicBaseUrl,
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ selected_household_id: 'household_two' }),
      });
      expect(switched.status).toBe(200);
      await expect(switched.json()).resolves.toMatchObject({
        active_role: 'parent',
        active_household: { householdId: 'household_two' },
        return_to: '/app/parent',
      });
      expect(
        switched.headers
          .getSetCookie()
          .some((value) => value.startsWith('__Host-onetime-session=parent-household-rotated')),
      ).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('denies Student self-password mutation without changing the credential', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const denied = await fetch(`${server.baseUrl}/api/v1/auth/password`, {
        method: 'POST',
        headers: {
          cookie: student.cookies,
          'content-type': 'application/json',
          'x-csrf-token': student.json.csrf_token,
        },
        body: JSON.stringify({
          current_password: 'StudentPass!234',
          new_password: 'StudentChanged!234',
        }),
      });
      expect(denied.status).toBe(403);
      await expect(denied.json()).resolves.toMatchObject({
        success: false,
        code: 'STUDENT_PASSWORD_ADULT_MANAGED',
      });
      expect(
        (await postLogin(server.baseUrl, 'student@example.test', 'StudentPass!234')).status,
      ).toBe(200);
      expect(
        (await postLogin(server.baseUrl, 'student@example.test', 'StudentChanged!234')).status,
      ).toBe(401);
    } finally {
      await server.close();
    }
  });

  it('mounts the ready Parent overview, children, and APIs behind authentication', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const anonymousShell = await fetch(`${server.baseUrl}/app/parent`, { redirect: 'manual' });
      expect(anonymousShell.status).toBe(302);
      expect(anonymousShell.headers.get('location')).toContain('return_to=%2Fapp%2Fparent');
      const anonymousStudents = await fetch(`${server.baseUrl}/app/parent/students`, {
        redirect: 'manual',
      });
      expect(anonymousStudents.status).toBe(302);
      expect(anonymousStudents.headers.get('location')).toContain(
        'return_to=%2Fapp%2Fparent%2Fstudents',
      );

      const parent = await loginAs(server.baseUrl, 'parent@example.test', 'ParentPass!234');
      const parentRoot = await fetch(`${server.baseUrl}/app/parent`, {
        headers: { cookie: parent.cookies },
      });
      expect(parentRoot.status).toBe(200);
      expect(parentRoot.headers.get('cache-control')).toContain('no-store');
      expect(await parentRoot.text()).toContain('portal-root');
      const parentShell = await fetch(`${server.baseUrl}/app/parent/students`, {
        headers: { cookie: parent.cookies },
      });
      expect(parentShell.status).toBe(200);
      expect(parentShell.headers.get('cache-control')).toContain('no-store');
      expect(await parentShell.text()).toContain('portal-root');

      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: parent.cookies },
      });
      expect(dashboard.status).toBe(200);
      const dashboardJson = await dashboard.json();
      expect(dashboardJson.data.household.household_key).toBe('household_alpha');
      expect(JSON.stringify(dashboardJson)).toContain('learner_alpha');
      expect(JSON.stringify(dashboardJson)).toContain('learner_setup');
      expect(JSON.stringify(dashboardJson)).not.toContain('learner_beta');
      expect(JSON.stringify(dashboardJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);

      await pool.query(
        `DELETE FROM onetime.portal_student_access_state
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = 'learner_setup'`,
        [config.accountKey, config.productKey],
      );

      const crossHousehold = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_beta/dashboard`,
        { headers: { cookie: parent.cookies } },
      );
      expect(crossHousehold.status).toBe(404);

      const setup = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_setup/student-access/setup`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({
            idempotency_key: 'portal-student-setup-001',
            username: 'setup_learner',
            password: 'Mishnah12345',
            display_name: 'Setup Learner',
          }),
        },
      );
      const setupText = await setup.text();
      expect(setup.status, setupText).toBe(200);
      expect(setupText).not.toContain('token_for_local_proof');
      expect(setupText).not.toContain('Mishnah12345');
      expect(JSON.parse(setupText)).toMatchObject({
        success: true,
        data: {
          learner_key: 'learner_setup',
          status: 'active',
          username_display: 'setup_learner',
          credential_status: 'parent_managed',
        },
      });
      const repairedAccessRows = await pool.query(
        `SELECT status, last_operation_type, username_display, credential_status,
                password_hash_ref
           FROM onetime.portal_student_access_state
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = 'learner_setup'`,
        [config.accountKey, config.productKey],
      );
      expect(repairedAccessRows.rows[0]).toMatchObject({
        status: 'active',
        last_operation_type: 'setup',
        username_display: 'setup_learner',
        credential_status: 'parent_managed',
      });
      expect(String(repairedAccessRows.rows[0].password_hash_ref)).toMatch(/^scrypt:v1:/);
      expect(String(repairedAccessRows.rows[0].password_hash_ref)).not.toContain('Mishnah12345');

      const tokenRows = await pool.query(
        `SELECT token_hash, metadata
           FROM onetime.account_lifecycle_tokens
          WHERE token_type = 'student_setup'
            AND learner_key = 'learner_setup'`,
      );
      expect(tokenRows.rows).toHaveLength(0);
      expect(JSON.stringify(tokenRows.rows)).not.toContain('token_for_local_proof');

      const setupStudent = await loginAs(server.baseUrl, 'setup_learner', 'Mishnah12345');
      expect(setupStudent.json.user.role).toBe('student');
      const setupStudentDashboard = await fetch(
        `${server.baseUrl}/api/v1/portals/student/dashboard`,
        {
          headers: { cookie: setupStudent.cookies },
        },
      );
      expect(setupStudentDashboard.status).toBe(200);
      expect((await setupStudentDashboard.json()).data.learner.learner_key).toBe('learner_setup');

      const reset = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_setup/student-access/reset`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({
            idempotency_key: 'portal-student-reset-username-001',
          }),
        },
      );
      const resetText = await reset.text();
      expect(reset.status, resetText).toBe(200);
      expect(JSON.parse(resetText)).toMatchObject({
        success: true,
        data: {
          learner_key: 'learner_setup',
          status: 'reset_requested',
          username_display: 'setup_learner',
          credential_status: 'reset_required',
          last_operation_type: 'reset',
        },
      });

      const existingStudentSession = await fetch(
        `${server.baseUrl}/api/v1/portals/student/dashboard`,
        {
          headers: { cookie: setupStudent.cookies },
        },
      );
      expect(existingStudentSession.status).toBe(401);

      const oldStudentPassword = await postLogin(server.baseUrl, 'setup_learner', 'Mishnah12345');
      expect(oldStudentPassword.status).toBe(401);
      expect(oldStudentPassword.json).toMatchObject({
        success: false,
        code: 'INVALID_CREDENTIALS',
      });

      const resetStudent = await postLogin(server.baseUrl, 'setup_learner', 'Mishnah54321');
      expect(resetStudent.status).toBe(401);
      expect(resetStudent.json).toMatchObject({
        success: false,
        code: 'INVALID_CREDENTIALS',
      });

      const resetTokens = await pool.query(
        `SELECT token_hash, consumed_at
           FROM onetime.account_lifecycle_tokens
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = 'learner_setup'
            AND token_type = 'student_reset'`,
        [config.accountKey, config.productKey],
      );
      expect(resetTokens.rows).toHaveLength(1);
      expect(String(resetTokens.rows[0]?.token_hash)).toMatch(/^[a-f0-9]{64}$/);
      expect(resetTokens.rows[0]?.consumed_at).toBeNull();
      expect(JSON.stringify(resetTokens.rows)).not.toContain('Mishnah54321');

      const admin = await loginAs(server.baseUrl, 'admin@example.test', 'AdminPass!234');
      const denied = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: admin.cookies },
      });
      expect(denied.status).toBe(403);
      const approvedSchoolRead = await fetch(
        `${server.baseUrl}/api/v2.1/admin/approved-schools/missing-school`,
        { headers: { cookie: admin.cookies } },
      );
      expect(approvedSchoolRead.status).toBe(404);
      await expect(approvedSchoolRead.json()).resolves.toMatchObject({
        success: false,
        code: 'APPROVED_SCHOOL_NOT_FOUND',
      });
    } finally {
      await server.close();
    }
  });

  it('mounts student portal as one server-resolved learner and expires after parent suspend', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      expect(dashboard.status).toBe(200);
      const dashboardJson = await dashboard.json();
      expect(dashboardJson.data.learner.learner_key).toBe('learner_alpha');
      expect(JSON.stringify(dashboardJson)).not.toContain('learner_sibling');
      expect(JSON.stringify(dashboardJson)).not.toContain('learner_beta');
      expect(JSON.stringify(dashboardJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);

      const missingCsrf = await fetch(
        `${server.baseUrl}/api/v1/portals/student/classes/class_week_001/launch`,
        {
          method: 'POST',
          headers: { cookie: student.cookies },
        },
      );
      expect(missingCsrf.status).toBe(403);

      const launch = await fetch(
        `${server.baseUrl}/api/v1/portals/student/classes/class_week_001/launch`,
        {
          method: 'POST',
          headers: { cookie: student.cookies, 'x-csrf-token': student.json.csrf_token },
        },
      );
      expect(launch.status).toBe(200);
      const launchJson = await launch.json();
      expect(launchJson).toMatchObject({
        success: true,
        data: { kind: 'class_launch', launch_token_ref: 'class_access_denied' },
      });
      expect(JSON.stringify(launchJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);

      const parent = await loginAs(server.baseUrl, 'parent@example.test', 'ParentPass!234');
      const revoke = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_alpha/student-access/revoke_sessions`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({ idempotency_key: 'portal-student-revoke-sessions-001' }),
        },
      );
      const revokeText = await revoke.text();
      expect(revoke.status, revokeText).toBe(200);
      expect(JSON.parse(revokeText)).toMatchObject({
        success: true,
        data: {
          learner_key: 'learner_alpha',
          status: 'active',
          last_operation_type: 'revoke_sessions',
        },
      });
      const revokedSession = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      expect(revokedSession.status).toBe(401);

      const studentAfterRevoke = await loginAs(
        server.baseUrl,
        'student@example.test',
        'StudentPass!234',
      );
      const suspend = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_alpha/student-access/suspend`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({ idempotency_key: 'portal-student-suspend-001' }),
        },
      );
      expect(suspend.status).toBe(200);
      const expired = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: studentAfterRevoke.cookies },
      });
      expect(expired.status).toBe(401);
      const suspendedLogin = await postLogin(
        server.baseUrl,
        'student@example.test',
        'StudentPass!234',
      );
      expect(suspendedLogin.status).toBe(401);
      expect(suspendedLogin.json).toMatchObject({
        success: false,
        code: 'INVALID_CREDENTIALS',
      });
      expect(String(suspendedLogin.json.message)).toContain('access was revoked');
    } finally {
      await server.close();
    }
  });
});

async function seedV21AdminIdentity() {
  const now = new Date('2026-07-31T12:00:00.000Z');
  await pool.query(
    `INSERT INTO onetime.v21_adult_identities
       (adult_id, normalized_email, display_name, state, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('adult_portal_admin', 'admin@example.test', 'Admin User', 'active', 1,
             'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_accounts
       (human_account_id, adult_id, state, security_version, version, product_key,
        runtime_tier, verification_environment_id, created_at, updated_at)
     VALUES ('human_portal_admin', 'adult_portal_admin', 'active', 1, 1,
             'one_time_mishnayos', 'isolated_staging', 'ci', $1, $1)`,
    [now],
  );
  await pool.query(
    `INSERT INTO onetime.v21_human_account_role_memberships
       (human_account_id, role, granted_at, granted_reason, product_key,
        runtime_tier, verification_environment_id)
     VALUES ('human_portal_admin', 'admin', $1, 'I36 central registration proof',
             'one_time_mishnayos', 'isolated_staging', 'ci')`,
    [now],
  );
}

async function seedPortalRecords() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES
       ('household_alpha', $1, $2, 'Alpha Family'),
       ('household_beta', $1, $2, 'Beta Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES
       ('relationship_alpha', $1, $2, 'household_alpha', $3, 'Parent', 'primary_guardian')`,
    [config.accountKey, config.productKey, parentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.contacts
       (contact_key, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, reminder_preference, source)
     VALUES
       ('portal_parent_contact', $1, $2, 'Parent User', 'family',
        'Alpha Family', 'Jerusalem', 'Asia/Jerusalem',
        'parent@example.test', 'none', 'test')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.adult_household_contact_links
       (link_key, account_key, product_key, contact_key, household_key, guardian_user_ref,
        highlevel_location_id, sync_state)
     VALUES
       ('portal_parent_adult_link', $1, $2, 'portal_parent_contact', 'household_alpha', $3,
        $4, 'sync_pending')`,
    [config.accountKey, config.productKey, parentUserKey, config.highLevelLocationId],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label)
     VALUES
       ('learner_alpha', $1, $2, 'household_alpha', 'Alpha Learner', '6'),
       ('learner_setup', $1, $2, 'household_alpha', 'Setup Learner', '5'),
       ('learner_sibling', $1, $2, 'household_alpha', 'Sibling Learner', '4'),
       ('learner_beta', $1, $2, 'household_beta', 'Beta Learner', '7')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref,
        status)
     VALUES
       ('access_alpha', $1, $2, 'household_alpha', 'learner_alpha', $3, 'active'),
       ('access_setup', $1, $2, 'household_alpha', 'learner_setup', NULL, 'not_configured'),
       ('access_sibling', $1, $2, 'household_alpha', 'learner_sibling', NULL, 'not_configured'),
       ('access_beta', $1, $2, 'household_beta', 'learner_beta', NULL, 'not_configured')`,
    [config.accountKey, config.productKey, studentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key)
     VALUES ('link_alpha_student', $1, $2, 'household_alpha', 'learner_alpha', $3)`,
    [config.accountKey, config.productKey, studentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES (
       'portal_access_alpha',
       $1,
       $2,
       'household_alpha',
       'active',
       'free_pilot',
       '2026-07-15T12:00:00.000Z',
       '2027-07-15T12:00:00.000Z',
       'portal_free_pilot_alpha',
       1,
       '2026-07-15T12:00:01.000Z',
       $3,
       'portal-current-access-v1',
       'portal_access_event_alpha'
     )`,
    [config.accountKey, config.productKey, 'a'.repeat(64)],
  );
}

async function writePortalShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await mkdir(path.join(targetDir, 'assets'), { recursive: true });
  await writeFile(path.join(targetDir, 'app', 'parent.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'student.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'crm.html'), '<div id="crm-root"></div>');
  await writeFile(path.join(targetDir, '404.html'), '<h1>Not found</h1>');
  await writeFile(path.join(targetDir, 'assets', 'app-crm.css'), '');
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function loginAs(baseUrl: string, identifier: string, password: string) {
  const login = await postLogin(baseUrl, identifier, password);
  expect(login.status, JSON.stringify(login.json)).toBe(200);
  return {
    cookies: login.cookies,
    json: login.json as { csrf_token: string; user: { role: string } },
  };
}

async function postLogin(baseUrl: string, identifier: string, password: string, returnTo?: string) {
  const csrf = await getLoginCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({
      identifier,
      password,
      csrf_token: csrf.token,
      ...(returnTo ? { return_to: returnTo } : {}),
    }),
  });
  const text = await response.text();
  return {
    status: response.status,
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: JSON.parse(text) as Record<string, unknown>,
  };
}

async function getLoginCsrf(baseUrl: string) {
  const page = await fetch(`${baseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}
