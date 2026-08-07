import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkflowReadbackView } from '../../../apps/web/src/client/app/communications/WorkflowReadbackFeature.tsx';
import { createWorkflowReadbackReader } from '../../../apps/web/src/server/communications/workflow-readback.ts';

describe('WorkflowReadbackView', () => {
  it('renders the exact app contract and pending external lane without mutation controls', () => {
    const data = createWorkflowReadbackReader({ resultArtifactPresent: () => false }).find('OT-01');
    if (!data) throw new Error('Expected OT-01 workflow fixture.');

    const html = renderToStaticMarkup(React.createElement(WorkflowReadbackView, { data }));

    expect(html).toContain('OT-01 Family Account Confirmation');
    expect(html).toContain('Final browser readback pending');
    expect(html).toContain('Provider actions are not available here');
    expect(html).toContain('Student contacts and live charges are prohibited');
    expect(html).toContain('GHL-UI-COMPLETE-LAUNCH-20260805.result.json');
    expect(html).not.toMatch(/<button|Start workflow|Pause workflow|Delete workflow/u);
    expect(html).not.toMatch(/href="https?:\/\//u);
  });
});
