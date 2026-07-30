import React from 'react';
import type { StudentPortalBootstrap } from '../../../../../../../packages/contracts/src/portals/student/index.ts';
import { V21AppShell } from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import './student-shell.css';

export function StudentShell({
  bootstrap,
  currentPath,
  onNavigate,
  children,
}: {
  bootstrap: StudentPortalBootstrap;
  currentPath: string;
  onNavigate: (href: string) => void;
  children: React.ReactNode;
}) {
  const navigation = bootstrap.navigation.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    current: item.href === currentPath,
  }));
  const bottomItems = bootstrap.navigation.filter((item) =>
    ['today', 'calendar', 'library', 'questions'].includes(item.id),
  );
  const account = bootstrap.navigation.find((item) => item.id === 'account');

  return (
    <V21AppShell
      role="student"
      title={navigation.find((item) => item.current)?.label ?? 'Student'}
      navigation={navigation}
      onNavigate={onNavigate}
    >
      <p className="ot-student-shell__timezone">
        Times shown in <strong>{bootstrap.preferredTimeZone}</strong>.
      </p>
      {children}
      <nav className="ot-student-shell__bottom-nav" aria-label="Student shortcuts">
        {bottomItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            aria-current={item.href === currentPath ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(item.href);
            }}
          >
            {item.label}
          </a>
        ))}
        {account && (
          <a
            href={account.href}
            aria-current={account.href === currentPath ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(account.href);
            }}
          >
            More
          </a>
        )}
      </nav>
    </V21AppShell>
  );
}
