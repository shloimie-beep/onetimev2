import type {
  ClassSeriesRecord,
  ClassSeriesState,
} from '../../../../../../../../packages/contracts/src/classes/core/index.ts';

const ACTIONS: Readonly<Record<ClassSeriesState, readonly ClassSeriesState[]>> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: ['draft'],
};

const CONSEQUENCE: Readonly<Record<ClassSeriesState, string>> = {
  draft: 'Restores to review only. Nothing is published or sent.',
  active: 'Publishes future classes and starts governed enrollment, provider, and reminder work.',
  paused: 'Stops new future work. An already-live class keeps its own lifecycle.',
  archived: 'Stops future visibility and provisioning while retaining class history.',
};

export function ClassSeriesWorkspace(props: {
  series: readonly ClassSeriesRecord[];
  busySeriesId?: string;
  onTransition: (series: ClassSeriesRecord, next: ClassSeriesState) => void;
}) {
  return (
    <section aria-labelledby="class-series-heading">
      <header>
        <p>Classroom</p>
        <h1 id="class-series-heading">Class series</h1>
        <p>Create safely in draft, then publish with an explicit Admin action.</p>
      </header>
      <div role="list" aria-label="Class series">
        {props.series.map((series) => (
          <article key={series.id} role="listitem" aria-busy={props.busySeriesId === series.id}>
            <h2>{series.title}</h2>
            <p>
              <strong>{series.state}</strong> · {series.timeZone} at {series.localStartTime} ·{' '}
              {series.durationMinutes} minutes
            </p>
            {series.canonical ? (
              <p>The canonical Sunday–Thursday class is always active and cannot be opted out.</p>
            ) : (
              <div aria-label={`Actions for ${series.title}`}>
                {ACTIONS[series.state].map((next) => (
                  <button
                    key={next}
                    type="button"
                    disabled={props.busySeriesId === series.id}
                    aria-describedby={`${series.id}-${next}-consequence`}
                    onClick={() => props.onTransition(series, next)}
                  >
                    {label(next)}
                  </button>
                ))}
                {ACTIONS[series.state].map((next) => (
                  <p key={`${next}-help`} id={`${series.id}-${next}-consequence`}>
                    {label(next)}: {CONSEQUENCE[next]}
                  </p>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function label(state: ClassSeriesState) {
  if (state === 'active') return 'Activate / publish';
  if (state === 'paused') return 'Pause';
  if (state === 'archived') return 'Archive';
  return 'Restore to draft';
}
