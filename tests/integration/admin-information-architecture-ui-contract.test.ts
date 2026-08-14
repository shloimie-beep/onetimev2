import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OT-LAUNCH-01 Admin IA client contract', () => {
  const shell = readFileSync('apps/web/src/client/app/shell/AppShell.tsx', 'utf8');
  const crm = readFileSync('apps/web/src/client/app/crm-entry.tsx', 'utf8');
  const content = readFileSync(
    'apps/web/src/client/app/content-workspace/ContentWorkspace.tsx',
    'utf8',
  );
  const live = readFileSync('apps/web/src/client/app/live-entry.tsx', 'utf8');
  const portalEntry = readFileSync('apps/web/src/client/app/portal-entry.tsx', 'utf8');
  const portals = readFileSync('apps/web/src/client/features/portals/PortalFeatures.tsx', 'utf8');
  const classManagement = readFileSync(
    'apps/web/src/client/app/classes/ClassManagementWorkspace.tsx',
    'utf8',
  );

  it('separates operating areas from utility destinations', () => {
    expect(shell).toContain('label="One Time app"');
    expect(shell).toContain('label="One Time utilities"');
    expect(crm).toContain('adminPrimaryNav(adminCurrentArea, liveConsoleReady)');
    expect(crm).toContain('session?.capabilities?.operator_experience?.live_console === true');
    expect(crm).toContain('utilityItems={utilityItems}');
    expect(crm).toContain('className="dashboard-overview-list"');
    expect(crm).not.toContain("label: 'Operations'");
    expect(crm).not.toContain("href: '/app/operations'");
    expect(crm).not.toContain('dashboard.open_experience_preview.button');
    expect(crm).not.toContain("href: '/app/experience-preview'");
    expect(crm).not.toContain("href: '/app/launch-status'");
  });

  it('folds legacy content and classroom destinations into focused workspaces', () => {
    expect(content).toContain('tabs={CONTENT_SECTIONS}');
    expect(content).toContain('className="content-library-view"');
    expect(content).toContain('tabs={studioViews}');
    expect(content).toContain('Activity moved to item history');
    expect(crm).toContain('CLASSROOM_SECTIONS.filter');
    expect(crm).toContain("item.id !== 'live-console' || liveConsoleReady");
    expect(crm).toContain('!teachingOnly || teachingSections.includes(item.id)');
    expect(crm).toContain('className="classroom-occurrence-selector"');
    expect(crm).not.toContain('Open class details');
    for (const label of [
      'Create class',
      'Create occurrence',
      'Enroll learner',
      'Attach recording',
      'Revoke access',
      'Provision Zoom',
    ]) {
      expect(classManagement).toContain(label);
    }
    expect(classManagement).toContain('getClassZoomStatus');
    expect(classManagement).toContain('deleteSyntheticClassZoom');
  });

  it('keeps Live Console focused and preserves Stage and OBS under Advanced', () => {
    expect(live).toContain('tabs={liveConsoleSections}');
    expect(live).toContain('<summary>Advanced</summary>');
    expect(live).toContain('OBS Featured Student');
    expect(live).toContain('<h3 id="live-zoom-heading">Zoom</h3>');
  });

  it('keeps ordinary Zoom lifecycle controls occurrence-scoped', () => {
    expect(live).toContain('Refresh Status');
    expect(live).toContain('Open Secure One Time Classroom');
    expect(live).toContain('Choose and Provision a Class');
    expect(classManagement).toContain('Provision Zoom');
    expect(classManagement).toContain('Refresh Zoom status');
    expect(classManagement).toContain('Delete synthetic Zoom');
    expect(classManagement).toContain('window.confirm(');
    expect(live).not.toContain('Create Disposable Test Meeting');
    expect(live).not.toContain('Register One Operator-Owned Test Learner');
    expect(live).not.toContain('Delete This App-Created Test Meeting');
    expect(live).not.toMatch(/meeting[_-]?id.*(?:input|searchParams)/i);
  });

  it('lets AppShell own ordinary portal categories while detached previews stay explicit', () => {
    expect(portalEntry.match(/navigationMode="shell"/g)).toHaveLength(2);
    expect(portals).toContain("navigationMode = 'embedded'");
    expect(portals).toContain("navigationMode === 'embedded'");
    expect(portals).not.toContain('Open ${card.label}');
    expect(portals).not.toContain('Open ${item.label}');
  });
});
