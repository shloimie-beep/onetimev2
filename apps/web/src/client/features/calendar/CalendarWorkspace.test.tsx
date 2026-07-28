import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarQueryResult } from '../../../../../../packages/contracts/src/calendar/index.ts';
import { CalendarWorkspace } from './CalendarWorkspace.tsx';

function result(role: CalendarQueryResult['role'], view: CalendarQueryResult['view']) {
  return {
    contractVersion: '2.1.0',
    role,
    view,
    displayTimeZone: 'America/New_York',
    events: [
      {
        id: 'class:2026-03-22',
        title: 'One Time Live Class',
        localClassDate: '2026-03-22',
        displayLocalDate: '2026-03-22',
        startsAt: '2026-03-22T17:00:00.000Z',
        endsAt: '2026-03-22T18:00:00.000Z',
        status: 'scheduled',
        dateLabel: 'Sun, Mar 22, 2026',
        timeLabel: '1:00 PM',
        timeZoneLabel: 'America/New_York (EDT)',
        offsetLabel: 'GMT-4',
        recordingAvailable: false,
        ...(role === 'student'
          ? { join: { state: 'available' as const, action: 'open_live_class' as const } }
          : {}),
      },
    ],
  } satisfies CalendarQueryResult;
}

function render(role: CalendarQueryResult['role'], view: CalendarQueryResult['view']) {
  return renderToStaticMarkup(
    <CalendarWorkspace
      result={result(role, view)}
      selectedDate="2026-03-22"
      todayDate="2026-03-22"
      onSelectDate={vi.fn()}
      onChangeView={vi.fn()}
      onNavigatePeriod={vi.fn()}
      onJoin={vi.fn()}
    />,
  );
}

describe('P15 responsive calendar composition', () => {
  it('renders the Admin month grid with equal keyboard-operable date cells and agenda', () => {
    const markup = render('admin', 'month');
    expect(markup).toContain('role="grid"');
    expect(markup.match(/role="gridcell"/g)).toHaveLength(42);
    expect(markup).toContain('aria-current="date"');
    expect(markup).toContain('Agenda for Mar 22');
    expect(markup).toContain('America/New_York (EDT), GMT-4');
    for (const view of ['Month', 'Week', 'Day', 'Agenda']) {
      expect(markup).toContain(`>${view}</button>`);
    }
  });

  it('keeps live Join absent from Parent output and exposes only the safe Student action', () => {
    expect(render('parent', 'month')).not.toContain('Join live class');
    const student = render('student', 'today');
    expect(student).toContain('Join live class');
    expect(student).not.toMatch(/zoom|meeting id|provider url/i);
  });
});
