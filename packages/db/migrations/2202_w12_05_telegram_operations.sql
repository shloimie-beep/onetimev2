ALTER TABLE onetime.telegram_command_executions
  DROP CONSTRAINT IF EXISTS telegram_command_executions_capability_ot101r_check;

ALTER TABLE onetime.telegram_command_executions
  ADD CONSTRAINT telegram_command_executions_capability_w12_05_check CHECK (
    capability IN (
      'gateway.help',
      'gateway.status.read',
      'gateway.identity.read_self',
      'gateway.scope.read',
      'app.link.open',
      'crm.lead.list',
      'crm.lead.read',
      'crm.signup.recent',
      'crm.lead.create',
      'crm.contact.read_redacted',
      'crm.lead_tag.list',
      'crm.lead_tag.add',
      'crm.lead_tag.remove',
      'class.schedule.read',
      'class.status.read',
      'class.status.update',
      'content.pipeline.read',
      'content.item.read',
      'content.knowledge.read',
      'content.item.retry',
      'task.list',
      'task.read',
      'task.create',
      'task.update',
      'support.ticket.list',
      'support.ticket.read_redacted',
      'support.ticket.decision_needed',
      'support.ticket.assign_self',
      'support.ticket.status.update',
      'class.question.list',
      'class.question.read_redacted',
      'class.question.select',
      'class.question.resolve',
      'social.draft.list',
      'social.draft.read',
      'social.draft.approval_link',
      'delivery.status.read',
      'delivery.retry',
      'telegram.audit.read_recent'
    )
  );

ALTER TABLE onetime.telegram_confirmations
  DROP CONSTRAINT IF EXISTS telegram_confirmations_capability_ot101r_check;

ALTER TABLE onetime.telegram_confirmations
  ADD CONSTRAINT telegram_confirmations_capability_w12_05_check CHECK (
    capability IN (
      'crm.lead.create',
      'crm.lead_tag.add',
      'crm.lead_tag.remove',
      'class.status.update',
      'content.item.retry',
      'task.create',
      'task.update',
      'support.ticket.assign_self',
      'support.ticket.status.update',
      'class.question.select',
      'class.question.resolve',
      'delivery.retry'
    )
  );
