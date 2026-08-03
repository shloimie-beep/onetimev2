import React, {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react';
import { brandAssetPaths } from './tokens.ts';

export * from './react-v21.tsx';

type PrimitiveProps = {
  className?: string;
  children?: React.ReactNode;
};

export function Logo({
  href = '/app/crm',
  label = 'One Time',
  subtitle,
  onClick,
  className = 'app-brand',
}: {
  href?: string;
  label?: string;
  subtitle?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  className?: string;
}) {
  return (
    <a className={className} href={href} onClick={onClick} data-ot-primitive="Logo">
      <img src={brandAssetPaths.logo} width="40" height="40" alt="" aria-hidden />
      <span>
        <strong>{label}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </a>
  );
}

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
}) {
  const variantClass =
    variant === 'primary'
      ? 'button-primary'
      : variant === 'text'
        ? 'text-button'
        : variant === 'danger'
          ? 'button-secondary ot-button-danger'
          : 'button-secondary';
  return <button className={className ?? variantClass} data-ot-primitive="Button" {...props} />;
}

export function Link({
  className = 'text-button',
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={className} data-ot-primitive="Link" {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input data-ot-primitive="Input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select data-ot-primitive="Select" {...props} />;
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" data-ot-primitive="Checkbox" {...props} />;
}

export function Alert({
  tone = 'info',
  className,
  children,
}: PrimitiveProps & { tone?: 'info' | 'success' | 'error' }) {
  return (
    <p
      className={className ?? `notice-banner ${tone === 'error' ? 'error' : tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      data-ot-primitive="Alert"
    >
      {children}
    </p>
  );
}

export function Badge({ className = 'semantic-chip source', children }: PrimitiveProps) {
  return (
    <span className={className} data-ot-primitive="Badge">
      {children}
    </span>
  );
}

export function Card({ className = 'dashboard-card', children }: PrimitiveProps) {
  return (
    <article className={className} data-ot-primitive="Card">
      {children}
    </article>
  );
}

export function ListCardRow({ className = 'contact-card', children }: PrimitiveProps) {
  return (
    <div className={className} data-ot-primitive="ListCardRow">
      {children}
    </div>
  );
}

export function Table({ className = 'contact-table', children }: PrimitiveProps) {
  return (
    <table className={className} data-ot-primitive="Table">
      {children}
    </table>
  );
}

export const Drawer = React.forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Drawer(
  { className = 'navigation-drawer', children, ...props },
  ref,
) {
  return (
    <aside ref={ref} className={className} data-ot-primitive="Drawer" {...props}>
      {children}
    </aside>
  );
});

export function Dialog({ className = 'navigation-drawer', children }: PrimitiveProps) {
  return (
    <section className={className} role="dialog" aria-modal="true" data-ot-primitive="Dialog">
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="state-panel empty" data-ot-primitive="EmptyState">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <section
      className="state-panel"
      role="status"
      aria-label={label}
      data-ot-primitive="LoadingState"
    >
      <p>{label}</p>
    </section>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="state-panel error" role="alert" data-ot-primitive="ErrorState">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}

export function FilterStrip({ className = 'toolbar-filters', children }: PrimitiveProps) {
  return (
    <div className={className} data-ot-primitive="FilterStrip">
      {children}
    </div>
  );
}

export function Footer({ children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <footer className="app-footer" data-ot-primitive="Footer" {...props}>
      {children}
    </footer>
  );
}

export function Header({
  className = 'app-header',
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <header className={className} data-ot-primitive="Header" {...props}>
      {children}
    </header>
  );
}

export function Toolbar({
  className = 'page-toolbar',
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section className={className} data-ot-primitive="Toolbar" {...props}>
      {children}
    </section>
  );
}

export function SectionTabs({
  tabs,
  currentId,
  label = 'Section',
  className = 'ot-section-tabs',
  onSelect,
}: {
  tabs: Array<{ id: string; label: string; href?: string; disabled?: boolean }>;
  currentId: string;
  label?: string;
  className?: string;
  onSelect?: (tab: { id: string; label: string; href?: string; disabled?: boolean }) => void;
}) {
  return (
    <nav className={className} aria-label={label} data-ot-primitive="SectionTabs">
      {tabs.map((tab) =>
        tab.href && !tab.disabled ? (
          <a
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === currentId ? 'page' : undefined}
            onClick={(event) => {
              if (!onSelect) return;
              event.preventDefault();
              onSelect(tab);
            }}
          >
            {tab.label}
          </a>
        ) : (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            aria-pressed={tab.id === currentId}
            onClick={() => onSelect?.(tab)}
          >
            {tab.label}
          </button>
        ),
      )}
    </nav>
  );
}

export function MetricTile({
  label,
  value,
  trend,
  className = 'ot-metric-tile',
}: {
  label: string;
  value: string | number;
  trend?: string;
  className?: string;
}) {
  return (
    <article className={className} data-ot-primitive="MetricTile">
      <span>{label}</span>
      <strong>{value}</strong>
      {trend && <small>{trend}</small>}
    </article>
  );
}

export function StatusChip({
  tone = 'neutral',
  children,
}: PrimitiveProps & { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return (
    <span className={`ot-status-chip tone-${tone}`} data-ot-primitive="StatusChip">
      {children}
    </span>
  );
}

export function MobileCard({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <article className="ot-mobile-card" data-ot-primitive="MobileCard">
      <header>
        <div>
          <strong>{title}</strong>
          {meta && <span>{meta}</span>}
        </div>
        {action}
      </header>
      {children}
    </article>
  );
}

export function StatePanel({
  kind = 'empty',
  title,
  body,
  action,
}: {
  kind?: 'empty' | 'loading' | 'error' | 'denied' | 'offline' | 'session-expired';
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const liveRole = kind === 'error' || kind === 'denied' ? 'alert' : 'status';
  return (
    <section
      className={`state-panel ot-state-${kind}`}
      role={liveRole}
      data-ot-primitive="StatePanel"
    >
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  );
}

export function ToastBanner({
  tone = 'info',
  children,
}: PrimitiveProps & { tone?: 'info' | 'success' | 'error' | 'warning' }) {
  return (
    <div
      className={`ot-toast-banner tone-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      data-ot-primitive="ToastBanner"
    >
      {children}
    </div>
  );
}

export function MediaFrame({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="ot-media-frame" data-ot-primitive="MediaFrame">
      <div>{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function ActivityTimeline({
  items,
}: {
  items: Array<{ id: string; title: string; meta: string; body?: string }>;
}) {
  return (
    <ol className="ot-activity-timeline" data-ot-primitive="ActivityTimeline">
      {items.map((item) => (
        <li key={item.id}>
          <span aria-hidden="true" />
          <div>
            <strong>{item.title}</strong>
            <small>{item.meta}</small>
            {item.body && <p>{item.body}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
