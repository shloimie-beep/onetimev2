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
  utilityItems?: ShellNavItem[];
  title: string;
  description?: string;
  toolbar?: React.ReactNode;
  notice?: React.ReactNode;
  workspaceClassName?: string;
  children: React.ReactNode;
  onNavigate: (href: string) => void;
  onLogout?: (() => void) | undefined;
  sessionExpired?: boolean;
  onSignIn?: (() => void) | undefined;
  roleContext?:
    | {
        activeRole: 'admin' | 'parent';
        availableRoles: readonly ('admin' | 'parent')[];
        csrfToken: string;
      }
    | undefined;
};

export function AppShell({
  user,
  navItems,
  utilityItems = [],
  title,
  description,
  toolbar,
  notice,
  workspaceClassName,
  children,
  onNavigate,
  onLogout,
  sessionExpired = false,
  onSignIn,
  roleContext,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<'admin' | 'parent' | null>(null);
  const [roleSwitchMessage, setRoleSwitchMessage] = useState('');
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
    displayName: 'One Time',
    email: sessionExpired ? 'Sign in again to continue' : 'Preparing your workspace',
    roleLabel: sessionExpired ? 'Needs sign-in' : 'Secure workspace',
  };
  const currentItem = [...navItems, ...utilityItems].find((item) => item.current) ??
    navItems[0] ?? {
      href: '/app/dashboard',
      label: 'Dashboard',
    };
  const homeHref = navItems[0]?.href ?? '/app/dashboard';

  async function switchRole(requestedRole: 'admin' | 'parent') {
    if (!roleContext || requestedRole === roleContext.activeRole || switchingRole) return;
    setRoleSwitchMessage('');
    setSwitchingRole(requestedRole);
    try {
      const response = await fetch('/api/v2.1/account-context/role', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': roleContext.csrfToken,
        },
        body: JSON.stringify({ requested_role: requestedRole, csrf_token: roleContext.csrfToken }),
      });
      const payload = (await response.json()) as { return_to?: string; message?: string };
      if (!response.ok || !payload.return_to) {
        throw new Error(payload.message ?? 'Role switching is unavailable.');
      }
      window.location.assign(payload.return_to);
    } catch (error) {
      setSwitchingRole(null);
      setRoleSwitchMessage(roleSwitchFailureMessage(error));
    }
  }

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
          href={homeHref}
          subtitle={shellUser.roleLabel}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(homeHref);
          }}
        />
        {utilityItems.length > 0 && (
          <nav className="app-header-utilities" aria-label="Admin utilities">
            {utilityItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="button-secondary compact-action"
                aria-current={item.current ? 'page' : undefined}
                data-action-id={item.id === 'search' ? 'admin.search.open.button' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.href);
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <div className="app-context" aria-label="Current account">
          <span>{shellUser.roleLabel}</span>
        </div>
        {roleContext && roleContext.availableRoles.length > 1 && (
          <div className="app-role-switcher" role="group" aria-label="Switch account role">
            {roleContext.availableRoles.map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={roleContext.activeRole === role}
                disabled={switchingRole !== null || roleContext.activeRole === role}
                onClick={() => void switchRole(role)}
              >
                {switchingRole === role ? 'Switching…' : role === 'admin' ? 'Admin' : 'Parent'}
              </button>
            ))}
            {roleSwitchMessage && <p role="alert">{roleSwitchMessage}</p>}
          </div>
        )}
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
          <ShellNavigation items={navItems} label="One Time app" onNavigate={onNavigate} />
          {utilityItems.length > 0 && (
            <section className="shell-utility-section" aria-labelledby="desktop-utilities-title">
              <h2 id="desktop-utilities-title">Utilities</h2>
              <ShellNavigation
                items={utilityItems}
                label="One Time utilities"
                onNavigate={onNavigate}
              />
            </section>
          )}
        </aside>
        <div
          className={workspaceClassName ? `app-workspace ${workspaceClassName}` : 'app-workspace'}
        >
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
              label="One Time app"
              onNavigate={(href) => {
                closeDrawer(false);
                onNavigate(href);
              }}
            />
            {utilityItems.length > 0 && (
              <section className="shell-utility-section" aria-labelledby="drawer-utilities-title">
                <h2 id="drawer-utilities-title">Utilities</h2>
                <ShellNavigation
                  items={utilityItems}
                  label="One Time utilities"
                  onNavigate={(href) => {
                    closeDrawer(false);
                    onNavigate(href);
                  }}
                />
              </section>
            )}
          </Drawer>
        </>
      )}
    </div>
  );
}

export function roleSwitchFailureMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Role switching is unavailable. Please try again.';
}

function ShellNavigation({
  items,
  label,
  onNavigate,
}: {
  items: ShellNavItem[];
  label: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav className="shell-nav" aria-label={label}>
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
      <p>Protected contact details were cleared. Sign in again to continue.</p>
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
