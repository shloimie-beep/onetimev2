import React from 'react';
import {
  disabledControlDescription,
  formatEnglishDate,
  type V21CalendarItem,
  type V21NavigationItem,
  type V21Role,
  type V21StateKind,
} from './v21.ts';

export function V21AppShell({
  role,
  title,
  navigation,
  onNavigate,
  children,
}: {
  role: V21Role;
  title: string;
  navigation: readonly V21NavigationItem[];
  onNavigate: (href: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`ot-v21 ot-v21--${role}`} lang="en">
      <a className="ot-v21__skip-link" href="#ot-v21-main">Skip to main content</a>
      <header className="ot-v21__header">
        <a href={navigation[0]?.href ?? '/'} onClick={(event) => { event.preventDefault(); onNavigate(navigation[0]?.href ?? '/'); }} className="ot-v21__brand">
          One Time
        </a>
        <span className="ot-v21__role">{role}</span>
      </header>
      <div className="ot-v21__layout">
        <V21Navigation items={navigation} onNavigate={onNavigate} />
        <main id="ot-v21-main" className="ot-v21__main" tabIndex={-1}>
          <h1>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}

export function V21Navigation({ items, onNavigate }: { items: readonly V21NavigationItem[]; onNavigate: (href: string) => void }) {
  return (
    <nav className="ot-v21__navigation" aria-label="Primary navigation">
      {items.map((item) => item.disabledReason ? (
        <span key={item.id} className="ot-v21__nav-item ot-v21__nav-item--disabled" aria-disabled="true" title={disabledControlDescription(item.disabledReason)}>
          {item.label}<small>{disabledControlDescription(item.disabledReason)}</small>
        </span>
      ) : (
        <a key={item.id} className="ot-v21__nav-item" href={item.href} aria-current={item.current ? 'page' : undefined} onClick={(event) => { event.preventDefault(); onNavigate(item.href); }}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function V21StatePanel({ kind, title, children, action }: { kind: V21StateKind; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const urgent = kind === 'error' || kind === 'denied' || kind === 'session-expired';
  return (
    <section className={`ot-v21__state ot-v21__state--${kind}`} role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'}>
      <h2>{title}</h2>
      <div>{children}</div>
      {action && <div className="ot-v21__state-action">{action}</div>}
    </section>
  );
}

export function V21CalendarAgenda({ items, selectedDate }: { items: readonly V21CalendarItem[]; selectedDate: string | Date }) {
  const dateLabel = formatEnglishDate(selectedDate);
  return (
    <section className="ot-v21__calendar" aria-labelledby="ot-v21-calendar-heading">
      <header><h2 id="ot-v21-calendar-heading">Calendar</h2><p aria-live="polite">{dateLabel}: {items.length} {items.length === 1 ? 'event' : 'events'}.</p></header>
      <ol aria-label={`Agenda for ${dateLabel}`}>
        {items.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{formatEnglishDate(item.startsAt, { month: 'short', weekday: undefined, year: undefined })}{item.detail ? ` — ${item.detail}` : ''}</span></li>)}
      </ol>
    </section>
  );
}
