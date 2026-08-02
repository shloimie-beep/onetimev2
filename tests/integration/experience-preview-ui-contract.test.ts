import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OT-LAUNCH-01 operator-visible UI contract', () => {
  const crmSource = readFileSync('apps/web/src/client/app/crm-entry.tsx', 'utf8');
  const previewSource = readFileSync(
    'apps/web/src/client/app/experience-preview/ExperiencePreview.tsx',
    'utf8',
  );
  const studentShellSource = readFileSync(
    'apps/web/src/client/app/experience-preview/student-entry.tsx',
    'utf8',
  );
  const previewCss = readFileSync('apps/web/src/client/app/crm.css', 'utf8');
  const portalSource = readFileSync(
    'apps/web/src/client/features/portals/PortalFeatures.tsx',
    'utf8',
  );
  const previewProjection = readFileSync(
    'apps/web/src/server/features/experience-preview/router.ts',
    'utf8',
  );
  const appBuildSource = readFileSync('apps/web/vite.app.config.ts', 'utf8');
  const publicPagesBuildSource = readFileSync('scripts/build-public-pages.ts', 'utf8');

  it('keeps launch tools contextual and gates canonical operating areas by server capability', () => {
    expect(crmSource).toContain('adminPrimaryNav(adminCurrentArea, liveConsoleReady)');
    expect(crmSource).not.toContain("label: 'Experience Preview'");
    expect(crmSource).not.toContain("href: '/app/experience-preview'");
    expect(crmSource).not.toContain("label: 'Launch Status'");
    expect(crmSource).not.toContain('Preview Parent &amp; Student portals');
    expect(crmSource).not.toContain('dashboard.open_experience_preview.button');
    expect(crmSource).not.toContain('Open portal preview');
    expect(crmSource).toContain(
      'session?.capabilities?.operator_experience?.live_console === true',
    );
  });

  it('omits engineering diagnostics and dead provider cards from ordinary landing views', () => {
    expect(crmSource).not.toContain('DiagnosticsDisclosure');
    expect(crmSource).not.toContain('Technical action registry');
    expect(crmSource).toContain('className="dashboard-overview-list"');
    expect(crmSource).toMatch(/not mounted\|not available/i);
  });

  it('uses two selectors and one role section while preserving the detached Student shell', () => {
    expect(previewSource).toContain('className="experience-preview-selectors"');
    expect(previewSource).toContain('<span>Role</span>');
    expect(previewSource).toContain('<span>Section</span>');
    expect(previewSource).not.toContain('experience-role-grid');
    expect(previewSource).not.toContain('experience-safe-routes');
    expect(previewProjection).not.toContain("title: 'BNA Agent Actions'");
    expect(previewSource).not.toContain('window.open');
    expect(previewSource).toContain('rel="noopener noreferrer"');
    expect(previewSource).toContain('Prepare fictional Student session');
    expect(previewSource).toContain('Open fictional Student session');
    expect(studentShellSource).toContain("method: 'GET'");
    expect(studentShellSource).toContain('requireDetachedPreviewWindow();');
    expect(studentShellSource).toContain('window.opener = null;');
    expect(studentShellSource).not.toContain('/api/v1/auth/logout');
    expect(studentShellSource).not.toContain('AppShell');
    expect(studentShellSource).toContain('StudentPortalFeature');
    expect(studentShellSource).toContain('student_portal');
    expect(studentShellSource).toContain('readOnly');
    expect(studentShellSource).not.toContain('inert');
    expect(studentShellSource).not.toContain("method: 'POST'");
    expect(portalSource).toContain('data-read-only={readOnly}');
    expect(portalSource).toContain('disabled={readOnly}');
    expect(previewCss).toContain('.fictional-student-portal-preview {');
    expect(previewCss).toContain('@media (max-width: 480px)');
    expect(previewCss).toContain('.experience-preview-selectors');
  });

  it('does not emit retired preview Student assets in the ordinary production build', () => {
    expect(appBuildSource).not.toContain('experience-preview/student-entry.tsx');
    expect(appBuildSource).not.toContain("'experience-preview-student'");
    expect(publicPagesBuildSource).not.toContain('experience-preview-student.html');
    expect(publicPagesBuildSource).not.toContain("appEntry: 'experience-preview-student'");
  });
});
