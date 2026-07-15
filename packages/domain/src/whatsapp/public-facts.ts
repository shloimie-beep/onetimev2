export type PublicProgramFact = {
  factKey: string;
  tags: readonly string[];
  answer: string;
  source: string;
};

export const OT85_PUBLIC_FACTS: readonly PublicProgramFact[] = [
  {
    factKey: 'public.onetime.audience',
    tags: ['family', 'school', 'program', 'signup', 'interest'],
    answer:
      'One Time can receive interest from both families and schools. I can collect the right public follow-up details here, and a person can follow up after that.',
    source: 'OT-85 packet SOURCE-SPEC public WhatsApp assistant scope',
  },
  {
    factKey: 'public.onetime.whatsapp_scope',
    tags: ['whatsapp', 'assistant', 'help', 'human'],
    answer:
      'This WhatsApp assistant can answer approved public program questions, collect Family or School interest, and request a human follow-up. It cannot share private account, student, billing, class-link, CRM, or support-ticket information.',
    source: 'OT-85 packet 01-DIRECT-CODEX-PROMPT.md safety scope',
  },
];

export function answerPublicProgramQuestion(text: string) {
  const normalized = text.toLowerCase();
  const fact = OT85_PUBLIC_FACTS.find((candidate) =>
    candidate.tags.some((tag) => normalized.includes(tag)),
  );
  return fact ?? null;
}
