import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SupportAdminView } from '../../../../../../../packages/contracts/src/support/v21.ts';
import { AdminSupportWorkspace } from './AdminSupportWorkspace.tsx';

const ticket: SupportAdminView = {
  ticketId: 'ots_ticket_one',
  product: 'one_time_mishnayos',
  kind: 'technical_support',
  category: 'technical',
  requesterId: 'student_actor_one',
  requesterRole: 'student',
  requesterHouseholdId: 'household_one',
  requesterStudentId: 'student_one',
  subject: 'Cannot open the class page',
  status: 'open',
  assigneeAdminId: null,
  ghlConversationId: null,
  messages: [],
  audit: [
    {
      eventId: 'audit_one',
      action: 'created',
      actorId: 'student_actor_one',
      at: '2026-07-29T13:10:00.000Z',
      fromStatus: null,
      toStatus: 'open',
    },
  ],
  version: 1,
  createdAt: '2026-07-29T13:10:00.000Z',
  updatedAt: '2026-07-29T13:10:00.000Z',
};

describe('P24 Admin support workspace', () => {
  it('renders list, assignment, status, in-app reply, and audit operations', () => {
    const html = renderToStaticMarkup(
      <AdminSupportWorkspace
        tickets={[ticket]}
        onNavigate={() => undefined}
        onAssign={() => undefined}
        onStatus={() => undefined}
        onReply={() => undefined}
      />,
    );
    expect(html).toContain('Support operations');
    expect(html).toContain('Assign Admin');
    expect(html).toContain('Waiting on requester');
    expect(html).toContain('Send in-app reply');
    expect(html).toContain('Audit history (1)');
    expect(html).toContain('One Time remains the source of truth');
  });
});
