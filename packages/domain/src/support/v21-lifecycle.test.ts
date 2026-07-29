import { describe, expect, it } from 'vitest';
import type {
  SupportPrincipal,
  SupportTelegramNotificationIntent,
} from '../../../contracts/src/support/v21.ts';
import { createMemorySupportRepository } from '../../../db/src/support/v21-index.ts';
import { createSupportLifecycleService } from './v21-lifecycle.ts';

const parent: SupportPrincipal = {
  product: 'one_time_mishnayos',
  actorId: 'parent_one',
  role: 'parent',
  householdId: 'household_one',
  studentId: null,
  adminCapabilities: [],
};
const student: SupportPrincipal = {
  product: 'one_time_mishnayos',
  actorId: 'student_actor_one',
  role: 'student',
  householdId: 'household_one',
  studentId: 'student_one',
  adminCapabilities: [],
};
const sibling: SupportPrincipal = {
  ...student,
  actorId: 'student_actor_two',
  studentId: 'student_two',
};
const supportAdmin: SupportPrincipal = {
  product: 'one_time_mishnayos',
  actorId: 'admin_shloimie',
  role: 'admin',
  householdId: null,
  studentId: null,
  adminCapabilities: ['support_operator'],
};
const rabbiAdmin: SupportPrincipal = {
  ...supportAdmin,
  actorId: 'admin_rabbi_eli',
  adminCapabilities: ['rabbi_operator'],
};

function harness() {
  const intents: SupportTelegramNotificationIntent[] = [];
  return {
    intents,
    service: createSupportLifecycleService({
      repository: createMemorySupportRepository(),
      notificationIntents: {
        async record(intent) {
          const prior = intents.find((value) => value.idempotencyKey === intent.idempotencyKey);
          if (!prior) intents.push(intent);
        },
      },
      now: () => new Date('2026-07-29T13:10:00.000Z'),
    }),
  };
}

function technical(idempotencyKey = 'technical-request-one') {
  return {
    kind: 'technical_support' as const,
    category: 'technical' as const,
    subject: 'Cannot open the class page',
    body: 'The signed-in class page stays unavailable after I refresh it.',
    idempotencyKey,
  };
}

function question(idempotencyKey = 'rabbi-question-one') {
  return {
    kind: 'rabbi_question' as const,
    category: 'torah_question' as const,
    subject: 'Question about today’s Mishnah',
    body: 'Could Rabbi Eli explain the final phrase from today’s Mishnah?',
    idempotencyKey,
  };
}

describe('P24 support lifecycle', () => {
  it('OTV2-TICKETS-147 routes OT technical categories to Shloimie as bounded redacted intents', async () => {
    const { service, intents } = harness();
    const privateBody = 'My private error details must stay inside One Time.';
    await service.create(parent, { ...technical(), body: privateBody });
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      transport: 'telegram',
      namespace: 'OT',
      destination: 'shloimie_support',
      event: 'ticket_created',
      containsPrivateBody: false,
      containsStudentIdentity: false,
      providerIsSourceOfTruth: false,
    });
    expect(JSON.stringify(intents[0])).not.toContain(privateBody);
    expect(JSON.stringify(intents[0])).not.toContain(parent.actorId);
  });

  it('OTV2-TICKETS-148 routes private Student Torah/class questions only to Rabbi operators', async () => {
    const { service, intents } = harness();
    const ticket = await service.create(student, question());
    expect(intents[0]?.destination).toBe('rabbi_questions');
    await expect(service.readAdmin(supportAdmin, ticket.ticketId)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(service.readAdmin(rabbiAdmin, ticket.ticketId)).resolves.toMatchObject({
      ticketId: ticket.ticketId,
    });
    await expect(
      service.create(student, { ...question('invalid-question-kind'), category: 'technical' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      service.create(parent, question('parent-question-forbidden')),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('OTV2-TICKETS-149 fails closed across BNA product scope and foreign actors', async () => {
    const { service } = harness();
    const ticket = await service.create(parent, technical());
    await expect(
      service.read({ ...parent, product: 'bna' as 'one_time_mishnayos' }, ticket.ticketId),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      service.read({ ...parent, actorId: 'parent_other' }, ticket.ticketId),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('OTV2-TICKETS-150 permits exactly one idempotent adult GHL conversation link', async () => {
    const { service } = harness();
    const originalCreate = technical();
    const created = await service.create(parent, originalCreate);
    expect(created).toMatchObject({ ghlConversationLinked: false });
    expect(created).not.toHaveProperty('ghlConversationId');
    const linked = await service.linkAdultGhlConversation({
      principal: supportAdmin,
      ticketId: created.ticketId,
      ghlConversationId: 'ghl_conversation_one',
      expectedVersion: created.version,
    });
    await expect(
      service.linkAdultGhlConversation({
        principal: supportAdmin,
        ticketId: created.ticketId,
        ghlConversationId: 'ghl_conversation_one',
        expectedVersion: linked.version,
      }),
    ).resolves.toMatchObject({ version: linked.version });
    await expect(
      service.linkAdultGhlConversation({
        principal: supportAdmin,
        ticketId: created.ticketId,
        ghlConversationId: 'ghl_conversation_two',
        expectedVersion: linked.version,
      }),
    ).rejects.toMatchObject({ code: 'conversation_link_conflict' });
    const requesterView = await service.read(parent, created.ticketId);
    expect(requesterView).toMatchObject({ ghlConversationLinked: true });
    expect(requesterView).not.toHaveProperty('ghlConversationId');
    const createReplayAfterLink = await service.create(parent, originalCreate);
    expect(createReplayAfterLink).toMatchObject({
      ticketId: created.ticketId,
      version: linked.version,
      ghlConversationLinked: true,
    });
    expect(createReplayAfterLink).not.toHaveProperty('ghlConversationId');
  });

  it('OTV2-TICKETS-151 never creates or links a Student GHL identity or conversation', async () => {
    const { service } = harness();
    const created = await service.create(student, technical());
    expect(created).toMatchObject({
      requesterRole: 'student',
      ghlConversationLinked: false,
    });
    expect(created).not.toHaveProperty('ghlConversationId');
    await expect(
      service.linkAdultGhlConversation({
        principal: supportAdmin,
        ticketId: created.ticketId,
        ghlConversationId: 'ghl_child_forbidden',
        expectedVersion: created.version,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('OTV2-TICKETS-152 supports Admin list, assignment, status, reply, audit, and stale denial', async () => {
    const { service, intents } = harness();
    const created = await service.create(parent, technical());
    expect(await service.listForAdmin(supportAdmin)).toHaveLength(1);
    const assigned = await service.assign({
      principal: supportAdmin,
      ticketId: created.ticketId,
      assigneeAdminId: supportAdmin.actorId,
      expectedVersion: created.version,
    });
    const active = await service.transition({
      principal: supportAdmin,
      ticketId: created.ticketId,
      to: 'in_progress',
      expectedVersion: assigned.version,
    });
    const replied = await service.reply({
      principal: supportAdmin,
      ticketId: created.ticketId,
      body: 'Please sign out, sign back in, and try the class page once more.',
      idempotencyKey: 'admin-reply-one',
      expectedVersion: active.version,
    });
    const replay = await service.reply({
      principal: supportAdmin,
      ticketId: created.ticketId,
      body: 'Please sign out, sign back in, and try the class page once more.',
      idempotencyKey: 'admin-reply-one',
      expectedVersion: active.version,
    });
    expect(replay.version).toBe(replied.version);
    expect(replied.messages).toHaveLength(2);
    expect(replied.audit.map((event) => event.action)).toEqual([
      'created',
      'assigned',
      'status_changed',
      'admin_replied',
    ]);
    expect(new Set(intents.map((intent) => intent.idempotencyKey)).size).toBe(intents.length);
    await expect(
      service.transition({
        principal: supportAdmin,
        ticketId: created.ticketId,
        to: 'resolved',
        expectedVersion: assigned.version,
      }),
    ).rejects.toMatchObject({ code: 'version_conflict' });
  });

  it('OTV2-TICKETS-186 keeps Student technical support separate from Rabbi questions and Parent access', async () => {
    const { service } = harness();
    const technicalTicket = await service.create(student, technical());
    const rabbiTicket = await service.create(student, question());
    const own = await service.listForRequester(student);
    expect(own.map((ticket) => ticket.kind)).toEqual(['technical_support', 'rabbi_question']);
    await expect(service.read(parent, technicalTicket.ticketId)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(service.read(sibling, rabbiTicket.ticketId)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(own.every((ticket) => ticket.ghlConversationLinked === false)).toBe(true);
  });

  it('rejects changed idempotent requests and wrong-role operational access', async () => {
    const { service } = harness();
    const created = await service.create(student, technical());
    await expect(
      service.create(student, {
        ...technical(),
        subject: 'Different technical request',
      }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    await expect(service.listForAdmin(parent)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(service.readAdmin(rabbiAdmin, created.ticketId)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
