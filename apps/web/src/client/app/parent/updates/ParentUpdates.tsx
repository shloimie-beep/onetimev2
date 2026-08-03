import React from 'react';
import type {
  ParentSupportEntry,
  ParentUpdate,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';

export function ParentUpdates({
  updates,
  support,
}: {
  updates: readonly ParentUpdate[];
  support: ParentSupportEntry;
}) {
  return (
    <section aria-labelledby="parent-updates-heading">
      <h2 id="parent-updates-heading">Updates</h2>
      {updates.length === 0 ? (
        <p role="status">No current notices, newsletters, or reminders.</p>
      ) : (
        <ol>
          {updates.map((update) => (
            <li key={update.update_id}>
              <article>
                <p>{update.kind}</p>
                <h3>{update.title}</h3>
                <p>{update.summary}</p>
                <time dateTime={update.published_at}>{update.published_at.slice(0, 10)}</time>
              </article>
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="parent-support-heading">
        <h3 id="parent-support-heading">Support</h3>
        <p>{support.description}</p>
        <a href={support.href}>{support.label}</a>
      </section>
    </section>
  );
}
