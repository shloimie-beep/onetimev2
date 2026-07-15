import React, { useEffect, useRef, useState } from 'react';
import { Button, Drawer, Footer, Header, Logo, Toolbar } from '@onetime/brand-system/react';

export type ShellUser = {
  displayName: string;
  email: string;
  roleLabel: string;
};

export type ShellNavItem = {
  id: string;
  label: string;
  href: string;
  current: boolean;
};

type AppShellProps = {
  user: ShellUser | null;
  navItems: ShellNavItem[];
  title: string;
  description?: string;
  toolbar?: React.ReactNode;
  notice?: React.ReactNode;
  children: React.ReactNode;
  onNavigate: (href: string) => void;
  onLogout?: (() => void) | undefined;
  sessionExpired?: boolean;
  onSignIn?: (() => void) | undefined;
};

export function AppShell({
  user,
  navItems,
  title,
  description,
  toolbar,
  notice,
  children,
  onNavigate,
  onLogout,
  sessionExpired = false,
  onSignIn,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  function openDrawer() {
    setDrawerOpen(true);
  }

  function closeDrawer(restoreFocus = true) {
    setDrawerOpen(false);
    if (restoreFocus) window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = getFocusable(drawer);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const shellUser = user ?? {
    displayName: 'Signed out',
    email: 'Session expired',
    roleLabel: sessionExpired ? 'Session expired' : 'Checking session',
  };
  const currentItem = navItems.find((item) => item.current) ??
    navItems[0] ?? {
      href: '/app/crm',
      label: 'CRM',
    };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-main">
        Skip to main content
      </a>
      <Header>
        <a
          className="mobile-current-link"
          href={currentItem.href}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(currentItem.href);
          }}
        >
          {currentItem.label}
        </a>
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-button shell-menu-button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="app-navigation-drawer"
          onClick={openDrawer}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <Logo
          subtitle={shellUser.roleLabel}
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/app/crm');
          }}
        />
        <div className="app-context" aria-label="Current account">
          <span>{shellUser.roleLabel}</span>
        </div>
        <div className="app-user" aria-label="Signed-in user">
          <strong>{shellUser.displayName}</strong>
          <span>{shellUser.email}</span>
        </div>
        {sessionExpired ? (
          <Button type="button" className="button-primary compact-action" onClick={onSignIn}>
            Sign in
          </Button>
        ) : (
          <Button type="button" className="button-secondary compact-action" onClick={onLogout}>
            Logout
          </Button>
        )}
      </Header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label="Primary navigation">
          <ShellNavigation items={navItems} onNavigate={onNavigate} />
        </aside>
        <div className="app-workspace">
          <section className="page-header" aria-labelledby="page-title">
            <div>
              <p className="breadcrumb">One Time</p>
              <h1 id="page-title" tabIndex={-1}>
                {title}
              </h1>
              {description && <p>{description}</p>}
            </div>
          </section>
          {toolbar && (
            <Toolbar aria-label={`${title} toolbar`} data-shell-toolbar>
              {toolbar}
            </Toolbar>
          )}
          {notice}
          <main id="app-main" className="app-main" tabIndex={-1}>
            {sessionExpired ? <SessionExpiredState onSignIn={onSignIn} /> : children}
          </main>
          <Footer>
            <span>One Time Mishnayos</span>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </Footer>
        </div>
      </div>

      {drawerOpen && (
        <>
          <div className="drawer-overlay" aria-hidden="true" onMouseDown={() => closeDrawer()} />
          <Drawer
            ref={drawerRef}
            id="app-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="navigation-drawer-title"
          >
            <div className="drawer-header">
              <h2 id="navigation-drawer-title">One Time navigation</h2>
              <button
                ref={closeButtonRef}
                type="button"
                className="icon-button drawer-close"
                aria-label="Close navigation"
                onClick={() => closeDrawer()}
              >
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </button>
            </div>
            <ShellNavigation
              items={navItems}
              onNavigate={(href) => {
                closeDrawer(false);
                onNavigate(href);
              }}
            />
          </Drawer>
        </>
      )}
    </div>
  );
}

function ShellNavigation({
  items,
  onNavigate,
}: {
  items: ShellNavItem[];
  onNavigate: (href: string) => void;
}) {
  return (
    <nav className="shell-nav" aria-label="One Time app">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          aria-current={item.current ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(item.href);
          }}
        >
          <span aria-hidden="true" className="nav-indicator" />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

function SessionExpiredState({ onSignIn }: { onSignIn?: (() => void) | undefined }) {
  return (
    <section className="state-panel session-expired-state" aria-labelledby="session-expired-title">
      <h2 id="session-expired-title">Session expired</h2>
      <p>Protected CRM details were cleared. Sign in again to continue.</p>
      <Button type="button" variant="primary" onClick={onSignIn}>
        Sign in
      </Button>
    </section>
  );
}

function getFocusable(container: HTMLElement) {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !element.hasAttribute('hidden');
  });
}
