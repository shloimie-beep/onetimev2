import React from 'react';
import type {
  CreateSupportConversationInput,
  SupportRequesterView,
} from '../../../../../../../packages/contracts/src/support/v21.ts';
import {
  V21AppShell,
  V21StatePanel,
} from '../../../../../../../packages/brand-system/src/react-v21.tsx';

export function StudentSupportCenter(props: {
  technicalTickets: readonly SupportRequesterView[];
  rabbiQuestions: readonly SupportRequesterView[];
  onNavigate: (href: string) => void;
  idempotencyKeyFor: (kind: CreateSupportConversationInput['kind']) => string;
  onSubmit: (input: CreateSupportConversationInput) => void;
}) {
  return (
    <V21AppShell
      role="student"
      title="Help and questions"
      navigation={[
        { id: 'today', label: 'Today', href: '/app/student', current: false },
        { id: 'support', label: 'Help and questions', href: '/app/student/support', current: true },
      ]}
      onNavigate={props.onNavigate}
    >
      <p>
        Technical help and Torah/class questions are separate private conversations. Parents cannot
        read a Student conversation.
      </p>
      <section aria-labelledby="technical-support-heading">
        <h2 id="technical-support-heading">Technical support</h2>
        <p>Use this for access, technical, or system help. It stays inside One Time.</p>
        <ConversationForm
          kind="technical_support"
          idempotencyKey={props.idempotencyKeyFor('technical_support')}
          onSubmit={props.onSubmit}
        />
        <ConversationList
          emptyTitle="No technical requests"
          conversations={props.technicalTickets}
        />
      </section>
      <section aria-labelledby="rabbi-question-heading">
        <h2 id="rabbi-question-heading">Ask Rabbi Eli</h2>
        <p>Use this for a private Torah or class question. It routes only to the Rabbi queue.</p>
        <ConversationForm
          kind="rabbi_question"
          idempotencyKey={props.idempotencyKeyFor('rabbi_question')}
          onSubmit={props.onSubmit}
        />
        <ConversationList emptyTitle="No Rabbi questions" conversations={props.rabbiQuestions} />
      </section>
    </V21AppShell>
  );
}

function ConversationForm(props: {
  kind: CreateSupportConversationInput['kind'];
  idempotencyKey: string;
  onSubmit: (input: CreateSupportConversationInput) => void;
}) {
  const technical = props.kind === 'technical_support';
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        props.onSubmit({
          kind: props.kind,
          category: technical ? 'technical' : 'torah_question',
          subject: String(data.get('subject') ?? ''),
          body: String(data.get('body') ?? ''),
          idempotencyKey: String(data.get('idempotency_key') ?? ''),
        });
      }}
    >
      <label>
        Subject
        <input name="subject" required minLength={5} maxLength={120} />
      </label>
      <label>
        {technical ? 'What needs technical help?' : 'Your private question'}
        <textarea name="body" required minLength={20} maxLength={6000} />
      </label>
      <input name="idempotency_key" type="hidden" value={props.idempotencyKey} />
      <button type="submit">
        {technical ? 'Submit technical request' : 'Submit Rabbi question'}
      </button>
    </form>
  );
}

function ConversationList(props: {
  emptyTitle: string;
  conversations: readonly SupportRequesterView[];
}) {
  if (props.conversations.length === 0) {
    return (
      <V21StatePanel kind="empty" title={props.emptyTitle}>
        <p>Your submitted conversations and in-app replies will appear here.</p>
      </V21StatePanel>
    );
  }
  return (
    <ol>
      {props.conversations.map((conversation) => (
        <li key={conversation.ticketId}>
          <a href={`/app/student/support/${conversation.ticketId}`}>{conversation.subject}</a>{' '}
          <span>{conversation.status.replaceAll('_', ' ')}</span>
        </li>
      ))}
    </ol>
  );
}
