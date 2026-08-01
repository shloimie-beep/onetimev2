import React from 'react';
import type {
  LearningAnnouncement,
  LearningLeaderboard,
  LearningQuestion,
  PublicLearningBadge,
  PublishedClassQuestion,
} from '../../../../../../../packages/contracts/src/learning/index.ts';

export function StudentLearningOverview(props: {
  questions: readonly LearningQuestion[];
  publishedQuestions: readonly PublishedClassQuestion[];
  announcements: readonly { announcement: LearningAnnouncement; read: boolean }[];
  badges: readonly PublicLearningBadge[];
  leaderboard: LearningLeaderboard | null;
  onSubmitQuestion?: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState('');
  const [submitState, setSubmitState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  return (
    <main aria-labelledby="student-learning-title">
      <h1 id="student-learning-title">My learning</h1>

      <section aria-labelledby="student-question-title">
        <h2 id="student-question-title">Questions for Rabbi Eli</h2>
        <p>Your questions and private answers are not shown in Parent views.</p>
        {props.questions.length === 0 ? (
          <p>No questions yet.</p>
        ) : (
          <ol>
            {props.questions.map((question) => (
              <li key={question.id}>
                <p>{question.body}</p>
                <p>Status: {question.state.replaceAll('_', ' ')}</p>
                {question.answer ? <p>Rabbi Eli’s answer: {question.answer}</p> : null}
              </li>
            ))}
          </ol>
        )}
        {props.onSubmitQuestion ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const body = draft.trim();
              if (body.length < 3 || submitState === 'saving') return;
              setSubmitState('saving');
              void props
                .onSubmitQuestion?.(body)
                .then(() => {
                  setDraft('');
                  setSubmitState('saved');
                })
                .catch(() => setSubmitState('error'));
            }}
          >
            <label htmlFor="p22-student-question">Ask a private question</label>
            <textarea
              id="p22-student-question"
              minLength={3}
              maxLength={2_000}
              required
              value={draft}
              onChange={(event) => {
                setDraft(event.currentTarget.value);
                setSubmitState('idle');
              }}
            />
            <button type="submit" disabled={submitState === 'saving' || draft.trim().length < 3}>
              {submitState === 'saving' ? 'Sending' : 'Send question'}
            </button>
            {submitState === 'saved' ? <p role="status">Question sent.</p> : null}
            {submitState === 'error' ? (
              <p role="alert">Question could not be sent. Try again.</p>
            ) : null}
          </form>
        ) : null}
      </section>

      <section aria-labelledby="student-published-question-title">
        <h2 id="student-published-question-title">Published class questions</h2>
        {props.publishedQuestions.length === 0 ? (
          <p>No moderated class questions yet.</p>
        ) : (
          <ol>
            {props.publishedQuestions.map((question) => (
              <li key={question.questionId} data-author-entry-key={question.authorEntryKey}>
                <p>{question.question}</p>
                {question.answer ? <p>{question.answer}</p> : null}
                <p>Asked by {question.authorDisplayName}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="student-updates-title">
        <h2 id="student-updates-title">Updates</h2>
        {props.announcements.length === 0 ? (
          <p>No current updates.</p>
        ) : (
          <ul>
            {props.announcements.map(({ announcement, read }) => (
              <li key={announcement.id}>
                <article aria-label={`${announcement.title}${read ? '' : ', unread'}`}>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="student-badges-title">
        <h2 id="student-badges-title">Badges</h2>
        <ul>
          {props.badges.map((badge) => (
            <li key={badge.key}>
              {badge.family.replaceAll('_', ' ')} {badge.level}
            </li>
          ))}
        </ul>
        <p>Badges are recognition only. They cannot be redeemed.</p>
      </section>

      {props.leaderboard ? (
        <section aria-labelledby="student-board-title">
          <h2 id="student-board-title">Class recognition — last 30 days</h2>
          <LeaderboardTable
            caption="Classes attended"
            entries={props.leaderboard.categories.attendanceCount}
          />
          <LeaderboardTable
            caption="Current attendance streak"
            entries={props.leaderboard.categories.currentAttendanceStreak}
          />
          <LeaderboardTable
            caption="Questions approved or published"
            entries={props.leaderboard.categories.approvedQuestionCount}
          />
        </section>
      ) : null}
    </main>
  );
}

function LeaderboardTable(props: {
  caption: string;
  entries: LearningLeaderboard['categories']['attendanceCount'];
}) {
  return (
    <table>
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Student</th>
          <th scope="col">Count</th>
        </tr>
      </thead>
      <tbody>
        {props.entries.map((entry) => (
          <tr key={entry.entryKey}>
            <td>{entry.rank}</td>
            <td>{entry.displayName}</td>
            <td>{entry.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
