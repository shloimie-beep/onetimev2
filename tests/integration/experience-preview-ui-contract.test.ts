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

  it('shows Experience Preview and the integrated Live Console in Administrator navigation', () => {
    expect(crmSource).toContain("label: 'Experience Preview'");
    expect(crmSource).toContain("href: '/app/experience-preview'");
    expect(crmSource).toContain("label: 'Live Console'");
    expect(crmSource).toContain("href: '/app/live-console'");
    expect(crmSource).toContain('Preview Parent &amp; Student portals');
    expect(crmSource).toContain('dashboard.open_experience_preview.button');
    expect(crmSource).toContain('Open portal preview');
  });

  it('omits engineering diagnostics and dead provider cards from ordinary landing views', () => {
    expect(crmSource).not.toContain('DiagnosticsDisclosure');
    expect(crmSource).not.toContain('Technical action registry');
    expect(crmSource).toContain("section.id === 'support'");
    expect(crmSource).toMatch(/not mounted\|not available/i);
  });

  it('preserves button semantics and a dedicated read-only Student shell', () => {
    expect(previewSource).toContain('<ul className="experience-role-grid"');
    expect(previewSource).toContain('<li key={role.role_id}>');
    expect(previewSource).not.toContain('role="listitem"');
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
    expect(studentShellSource).toContain('inert');
    expect(studentShellSource).not.toContain("method: 'POST'");
    expect(previewCss).toContain('@media (max-width: 480px)');
    expect(previewCss).toMatch(/minmax\(min\(100%, 220px\), 1fr\)/);
  });
});
