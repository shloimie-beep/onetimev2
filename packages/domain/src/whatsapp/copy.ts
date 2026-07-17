export const W12_06_WHATSAPP_ASSISTANT_COPY_VERSION = 'w12-06-public-assistant-v1';

export const WHATSAPP_ASSISTANT_COPY = {
  version: W12_06_WHATSAPP_ASSISTANT_COPY_VERSION,
  displayName: "Rabbi Scheller's digital assistant",
  defaultPrefill: 'Shalom, I would like to learn more about One Time Mishnayos.',
  openingQuestion:
    "Shalom, I'm Rabbi Scheller's digital assistant. Are you hoping to help your son enjoy Torah learning more, or are you asking for a school?",
  audienceQuestion: 'Are you reaching out for a Family or for a School?',
  guardianNameQuestion: 'Please send the parent or guardian name for this Family interest.',
  schoolContactNameQuestion: 'Please send the school contact name for this School interest.',
  contactPreferenceQuestion:
    'How should a person follow up: WhatsApp, phone, email, or human follow-up here?',
  reminderConsentQuestion:
    'Do you want separate WhatsApp reminder consent recorded for Family class reminders? Reply yes or no.',
  familyAck:
    'Thank you. Your Family interest was saved for human follow-up. This did not create portal access or send a class link. Public signup remains available at https://join.onetimeonetime.com/signup.',
  schoolAck:
    'Thank you. Your School inquiry was saved for human follow-up only. This did not create household, subscriber, portal, class access, reminder, or class-link records.',
  humanHandoffAck:
    'A human follow-up request was recorded. No private account, student, billing, class-link, or support-ticket information is shared in WhatsApp.',
  safeStatusResponse:
    'This chat has a short verified safe-status grant. For any account, student, billing, ticket, or class-link details, use the signed-in portal.',
  privateDataBlocked:
    'I cannot share private account, child, billing, class-link, CRM, or support-ticket information in WhatsApp.',
  technicalHelpRedirect:
    'Technical support tickets are handled in the signed-in product flow for entitled subscribers. I can record that you want human follow-up, but I cannot create or expose support-ticket details here.',
  unknownFallback:
    'I can collect Family or School interest, answer approved public program questions, or request a human follow-up.',
  rateLimited:
    'I need to slow this chat down for safety. Please wait a little, then send one clear Family, School, public-question, or human-follow-up message.',
  abuseSuppressed:
    'This public assistant conversation is paused for safety. A human can review if follow-up is needed.',
} as const;
