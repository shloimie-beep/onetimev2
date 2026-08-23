import React, { useRef, useState } from 'react';
import type {
  AttendanceRecord,
  LearningAnnouncement,
  LearningQuestion,
} from '../../../../../../../packages/contracts/src/learning/index.ts';

export function AdminLearningWorkspace(props: {
  mode: 'questions' | 'attendance';
  questions: readonly LearningQuestion[];
  announcements: readonly LearningAnnouncement[];
  attendance: readonly AttendanceRecord[];
  onTransitionQuestion?: (input: AdminQuestionTransitionInput) => Promise<void>;
  onCorrectAttendance?: (input: AdminAttendanceCorrectionInput) => Promise<void>;
}) {
  if (props.mode === 'attendance') return <AttendanceWorkspace {...props} />;
  return (
    <main aria-labelledby="admin-learning-title">
      <h1 id="admin-learning-title">Question moderation</h1>
      <section aria-labelledby="admin-question-title">
        <h2 id="admin-question-title">Private Student questions</h2>
        <table>
          <caption>Questions requiring Rabbi or Admin review</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Class</th>
              <th scope="col">State</th>
              <th scope="col">Moderation</th>
            </tr>
          </thead>
          <tbody>
            {props.questions.map((question) => (
              <tr key={question.id}>
                <td>{question.body}</td>
                <td>{question.classId}</td>
                <td>{question.state.replaceAll('_', ' ')}</td>
                <td>
                  <QuestionModerationForm
                    question={question}
                    {...(props.onTransitionQuestion
                      ? { onTransition: props.onTransitionQuestion }
                      : {})}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="admin-announcement-title">
        <h2 id="admin-announcement-title">Announcements</h2>
        <p>Publish separately to the program, a class, one Parent household, or one Student.</p>
        <ul>
          {props.announcements.map((announcement) => (
            <li key={announcement.id}>
              {announcement.title} — {announcement.audience.kind}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export type AdminQuestionTransitionInput = {
  questionId: string;
  to: Exclude<LearningQuestion['state'], 'submitted'>;
  answer?: string;
  reason?: string;
  expectedVersion: number;
  idempotencyKey: string;
  auditRef: string;
};

type ModerationTarget = AdminQuestionTransitionInput['to'];

export function questionModerationOptions(
  state: LearningQuestion['state'],
): readonly { value: ModerationTarget; label: string }[] {
  if (state === 'submitted') {
    return [
      { value: 'answered_private', label: 'Answer privately' },
      { value: 'approved_for_class', label: 'Approve for class' },
      { value: 'closed', label: 'Close' },
      { value: 'declined', label: 'Decline' },
    ];
  }
  if (state === 'answered_private') {
    return [
      { value: 'approved_for_class', label: 'Approve for class' },
      { value: 'closed', label: 'Close' },
      { value: 'declined', label: 'Decline' },
    ];
  }
  if (state === 'approved_for_class') {
    return [
      { value: 'answered_private', label: 'Return to private answer' },
      { value: 'published', label: 'Publish to class' },
      { value: 'closed', label: 'Close' },
      { value: 'declined', label: 'Decline' },
    ];
  }
  if (state === 'published') {
    return [
      { value: 'approved_for_class', label: 'Unpublish to review' },
      { value: 'closed', label: 'Close' },
    ];
  }
  return [];
}

function QuestionModerationForm({
  question,
  onTransition,
}: {
  question: LearningQuestion;
  onTransition?: (input: AdminQuestionTransitionInput) => Promise<void>;
}) {
  const options = questionModerationOptions(question.state);
  const [selectedTarget, setSelectedTarget] = useState<ModerationTarget | ''>(
    options[0]?.value ?? '',
  );
  const [answer, setAnswer] = useState(question.answer ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const target = options.some(({ value }) => value === selectedTarget)
    ? selectedTarget
    : (options[0]?.value ?? '');

  if (options.length === 0) return <span>No further moderation actions.</span>;
  if (!onTransition) return <span>Moderation is unavailable on this view.</span>;

  const needsAnswer = target === 'answered_private' && !question.answer;
  const needsReason = target === 'closed' || target === 'declined';
  return (
    <form
      className="contact-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setNotice(null);
        if (!target) return;
        if (needsAnswer && !answer.trim()) {
          setNotice({ kind: 'error', message: 'A private answer is required.' });
          return;
        }
        if (needsReason && reason.trim().length < 3) {
          setNotice({ kind: 'error', message: 'A moderation reason is required.' });
          return;
        }
        setSaving(true);
        try {
          await onTransition({
            questionId: question.id,
            to: target,
            ...(answer.trim() ? { answer: answer.trim() } : {}),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
            expectedVersion: question.version,
            idempotencyKey: idempotencyKey.current,
            auditRef: `admin-question:${question.id}:${idempotencyKey.current}`,
          });
          idempotencyKey.current = crypto.randomUUID();
          setReason('');
          setNotice({ kind: 'success', message: 'Question moderation saved.' });
        } catch (error) {
          setNotice({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Question moderation failed.',
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <label>
        <span>Action</span>
        <select
          value={target}
          onChange={(event) => setSelectedTarget(event.currentTarget.value as ModerationTarget)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Private answer</span>
        <textarea
          rows={3}
          maxLength={4000}
          required={needsAnswer}
          value={answer}
          onChange={(event) => setAnswer(event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Reason {needsReason ? '(required)' : '(optional)'}</span>
        <textarea
          rows={2}
          minLength={needsReason ? 3 : undefined}
          maxLength={1000}
          required={needsReason}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />
      </label>
      <button type="submit" className="button-primary" disabled={saving}>
        {saving ? 'Saving moderation…' : 'Save moderation'}
      </button>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}</p>}
    </form>
  );
}

export type AdminAttendanceCorrectionInput = {
  studentId: string;
  occurrenceId: string;
  joinedAt: string;
  leftAt: string;
  reason: string;
  idempotencyKey: string;
};

function AttendanceWorkspace(props: {
  attendance: readonly AttendanceRecord[];
  onCorrectAttendance?: (input: AdminAttendanceCorrectionInput) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState('');
  const [occurrenceId, setOccurrenceId] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [leftAt, setLeftAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  return (
    <main aria-labelledby="admin-attendance-title">
      <h1 id="admin-attendance-title">Attendance</h1>
      <section aria-labelledby="admin-attendance-correction-title">
        <h2 id="admin-attendance-correction-title">Record an audited correction</h2>
        <p>
          Corrections use the current One Time roster and append evidence; they do not call Zoom or
          another provider.
        </p>
        <form
          className="contact-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setNotice(null);
            const joined = new Date(joinedAt);
            const left = new Date(leftAt);
            if (Number.isNaN(joined.valueOf()) || Number.isNaN(left.valueOf()) || left <= joined) {
              setNotice({ kind: 'error', message: 'Left at must be after joined at.' });
              return;
            }
            if (!props.onCorrectAttendance) {
              setNotice({ kind: 'error', message: 'Attendance correction is unavailable.' });
              return;
            }
            setSaving(true);
            try {
              await props.onCorrectAttendance({
                studentId: studentId.trim(),
                occurrenceId: occurrenceId.trim(),
                joinedAt: joined.toISOString(),
                leftAt: left.toISOString(),
                reason: reason.trim(),
                idempotencyKey: idempotencyKey.current,
              });
              idempotencyKey.current = crypto.randomUUID();
              setReason('');
              setNotice({ kind: 'success', message: 'Audited attendance correction recorded.' });
            } catch (error) {
              setNotice({
                kind: 'error',
                message: error instanceof Error ? error.message : 'Attendance correction failed.',
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            <span>Student ID</span>
            <input
              required
              value={studentId}
              onChange={(event) => setStudentId(event.currentTarget.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Occurrence ID</span>
            <input
              required
              value={occurrenceId}
              onChange={(event) => setOccurrenceId(event.currentTarget.value)}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Joined at</span>
            <input
              required
              type="datetime-local"
              value={joinedAt}
              onChange={(event) => setJoinedAt(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Left at</span>
            <input
              required
              type="datetime-local"
              value={leftAt}
              onChange={(event) => setLeftAt(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Correction reason</span>
            <textarea
              required
              minLength={3}
              maxLength={1000}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
            />
          </label>
          <button type="submit" className="button-primary" disabled={saving}>
            {saving ? 'Recording correction…' : 'Record audited correction'}
          </button>
        </form>
        {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.message}</p>}
      </section>
      <section aria-labelledby="admin-attendance-records-title">
        <h2 id="admin-attendance-records-title">Attendance records</h2>
        <table>
          <caption>Student attendance and audited corrections</caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Occurrence</th>
              <th scope="col">Minutes</th>
              <th scope="col">Correction</th>
            </tr>
          </thead>
          <tbody>
            {props.attendance.map((record) => (
              <tr key={`${record.occurrenceId}:${record.studentId}`}>
                <td>{record.studentId}</td>
                <td>{record.occurrenceId}</td>
                <td>{record.minutes}</td>
                <td>{record.correctionReason ?? 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
