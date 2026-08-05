import React from 'react';
import type { ProtectedActionDescriptor, UpcomingClassSummary } from '@onetime/contracts';

export function StudentCalendar({
  classes,
  onLaunch,
}: {
  classes: readonly UpcomingClassSummary[];
  onLaunch: (action: ProtectedActionDescriptor) => void;
}) {
  return (
    <section className="ot-portal-feature" aria-labelledby="student-calendar-heading">
      <div className="ot-panel">
        <p className="ot-eyebrow">Student schedule</p>
        <h2 id="student-calendar-heading">Calendar</h2>
        {classes.length === 0 ? (
          <p>No upcoming classes.</p>
        ) : (
          <ol className="ot-card-grid" aria-label="Upcoming classes">
            {classes.map((item) => (
              <li className="ot-card" key={item.class_key}>
                <h3>{item.title}</h3>
                <p>{item.starts_at ? formatClassTime(item.starts_at) : 'Time not available'}</p>
                <p>{readable(item.status)}</p>
                {item.launch_action ? (
                  <button
                    type="button"
                    className="ot-button ot-button-primary"
                    onClick={() => {
                      if (item.launch_action) onLaunch(item.launch_action);
                    }}
                  >
                    {item.launch_action.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function formatClassTime(instant: string) {
  const value = new Date(instant);
  if (!Number.isFinite(value.getTime())) return 'Time not available';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(value);
}

function readable(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/u, (letter) => letter.toUpperCase());
}
