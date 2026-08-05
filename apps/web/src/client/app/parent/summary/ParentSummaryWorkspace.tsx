import React, { useEffect, useMemo, useState } from 'react';
import type { ParentSummarySnapshot } from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';
import { createParentHouseholdApi, type ParentHouseholdApi } from '../household/api.ts';
import { ParentProgressSummary } from '../progress/index.ts';
import { ParentSchedule } from '../schedule/index.ts';
import { ParentUpdates } from '../updates/index.ts';

export type ParentSummaryView =
  | { kind: 'calendar' }
  | { kind: 'progress'; student_id?: string }
  | { kind: 'updates'; newsletterOnly?: boolean };

export function ParentSummaryWorkspace({
  view,
  api: suppliedApi,
}: {
  view: ParentSummaryView;
  api?: ParentHouseholdApi;
}) {
  const api = useMemo(() => suppliedApi ?? createParentHouseholdApi(), [suppliedApi]);
  const [snapshot, setSnapshot] = useState<ParentSummarySnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .loadSummary()
      .then(({ snapshot: next }) => {
        if (active) setSnapshot(next);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Parent summary unavailable.');
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (!snapshot) {
    return (
      <section aria-live="polite">
        <h1>Parent summary</h1>
        <p>{error || 'Loading Parent summary...'}</p>
      </section>
    );
  }
  if (view.kind === 'calendar') {
    return <ParentSchedule entries={snapshot.schedule} students={snapshot.students} />;
  }
  if (view.kind === 'progress') {
    const studentIds = view.student_id ? new Set([view.student_id]) : null;
    return (
      <ParentProgressSummary
        progress={
          studentIds
            ? snapshot.progress.filter(({ student_id }) => studentIds.has(student_id))
            : snapshot.progress
        }
        students={
          studentIds
            ? snapshot.students.filter(({ student_id }) => studentIds.has(student_id))
            : snapshot.students
        }
      />
    );
  }
  return (
    <ParentUpdates
      updates={
        view.newsletterOnly
          ? snapshot.updates.filter(({ kind }) => kind === 'newsletter')
          : snapshot.updates
      }
      support={snapshot.support}
    />
  );
}
