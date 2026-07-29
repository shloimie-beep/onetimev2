import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudentSupportCenter } from './StudentSupportCenter.tsx';

describe('P24 Student support center', () => {
  it('renders separate private technical and Rabbi question flows without GHL fields', () => {
    const html = renderToStaticMarkup(
      <StudentSupportCenter
        technicalTickets={[]}
        rabbiQuestions={[]}
        onNavigate={() => undefined}
        idempotencyKeyFor={(kind) => `${kind}:request-one`}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('Technical support');
    expect(html).toContain('Ask Rabbi Eli');
    expect(html).toContain('Submit technical request');
    expect(html).toContain('Submit Rabbi question');
    expect(html).toContain('Parents cannot read a Student conversation');
    expect(html).not.toContain('GHL');
    expect(html).not.toContain('Telegram');
  });
});
