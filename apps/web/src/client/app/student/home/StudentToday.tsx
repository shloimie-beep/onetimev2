import React from 'react';
import type {
  StudentSelfProfile,
  StudentTodaySnapshot,
} from '../../../../../../../packages/contracts/src/portals/student/index.ts';

export function StudentToday({
  profile,
  today,
  onNavigate,
}: {
  profile: StudentSelfProfile;
  today: StudentTodaySnapshot;
  onNavigate: (href: string) => void;
}) {
  const join = today.join;
  const joinable = join?.state === 'join' || join?.state === 'reconnect';
  const occurrenceId = joinable ? join.occurrenceId : null;
  return (
    <section aria-labelledby="ot-student-today-title">
      <h2 id="ot-student-today-title">
        Hi, <span dir="auto">{profile.displayName}</span>
      </h2>
      <div className="ot-student-card-grid">
        <article className="ot-student-card">
          <h3>Next class</h3>
          {today.nextClassLabel ? (
            <>
              <p>
                {today.nextClassLabel}
                {today.nextClassTimeLabel ? ` · ${today.nextClassTimeLabel}` : ''}
              </p>
              {joinable && occurrenceId && (
                <a
                  className="ot-student-card__join"
                  href={`/app/student/class/${encodeURIComponent(occurrenceId)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(event.currentTarget.getAttribute('href') ?? '/app/student');
                  }}
                >
                  {today.join?.state === 'reconnect' ? 'Reconnect' : 'Join Class'}
                </a>
              )}
              {today.join?.state === 'preparing' && <p>Class is being prepared.</p>}
              {today.join?.state === 'second_device_denied' && (
                <p>Class is already open on another device. Ask your account owner for help.</p>
              )}
            </>
          ) : (
            <p>No class is scheduled yet.</p>
          )}
        </article>

        <article className="ot-student-card">
          <h3>Latest lesson</h3>
          {today.latestLessonTitle && today.latestLessonContentId ? (
            <a
              href={`/app/student/library/${encodeURIComponent(today.latestLessonContentId)}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(event.currentTarget.getAttribute('href') ?? '/app/student/library');
              }}
            >
              {today.latestLessonTitle}
            </a>
          ) : (
            <p>No lesson is ready yet.</p>
          )}
        </article>

        <article className="ot-student-card">
          <h3>Questions</h3>
          <p>
            {today.questionStatus === 'answered'
              ? 'Your question has an answer.'
              : today.questionStatus === 'submitted'
                ? 'Your question was sent.'
                : 'You have no open questions.'}
          </p>
          <a
            href="/app/student/questions"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('/app/student/questions');
            }}
          >
            Open Questions
          </a>
        </article>

        <article className="ot-student-card">
          <h3>Updates and progress</h3>
          <p>
            {today.unreadNoticeCount} unread {today.unreadNoticeCount === 1 ? 'notice' : 'notices'}.
          </p>
          {today.nextBadgeLabel && today.nextBadgeProgressPercent !== null && (
            <>
              <label htmlFor="ot-student-badge-progress">{today.nextBadgeLabel}</label>
              <progress
                id="ot-student-badge-progress"
                max={100}
                value={today.nextBadgeProgressPercent}
              />
            </>
          )}
        </article>
      </div>
    </section>
  );
}
