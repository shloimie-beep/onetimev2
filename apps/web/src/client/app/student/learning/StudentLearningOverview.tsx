import type {
  LearningAnnouncement,
  LearningBadgeAward,
  LearningLeaderboard,
  LearningQuestion,
} from '../../../../../../../packages/contracts/src/learning/index.ts';

export function StudentLearningOverview(props: {
  questions: readonly LearningQuestion[];
  announcements: readonly { announcement: LearningAnnouncement; read: boolean }[];
  badges: readonly LearningBadgeAward[];
  leaderboard: LearningLeaderboard | null;
}) {
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
            caption="Questions answered or approved"
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
          <tr key={entry.studentId}>
            <td>{entry.rank}</td>
            <td>{entry.displayName}</td>
            <td>{entry.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
