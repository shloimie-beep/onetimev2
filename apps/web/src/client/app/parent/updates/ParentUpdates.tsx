import React from 'react';
import type {
  ParentSupportEntry,
  ParentUpdate,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';
import type { ParentWelcomeVideoSlot } from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import type { ParentHouseholdApi } from '../household/api.ts';
import { ParentWelcomeVideo } from '../welcome/index.ts';

export function ParentUpdates({
  updates,
  support,
  featuredWelcomeVideo = null,
  csrfToken = null,
  api,
}: {
  updates: readonly ParentUpdate[];
  support: ParentSupportEntry;
  featuredWelcomeVideo?: ParentWelcomeVideoSlot | null;
  csrfToken?: string | null;
  api?: ParentHouseholdApi;
}) {
  return (
    <section aria-labelledby="parent-updates-heading">
      <h2 id="parent-updates-heading">Updates</h2>
      <ParentWelcomeVideo
        slot={featuredWelcomeVideo}
        csrfToken={csrfToken}
        placement="updates"
        {...(api ? { api } : {})}
      />
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
