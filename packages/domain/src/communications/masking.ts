import type { CommunicationsChannel } from '../../../contracts/src/communications/index.ts';

export function maskCommunicationsRecipient(input: {
  channel: CommunicationsChannel;
  email?: string | null | undefined;
  phone?: string | null | undefined;
}) {
  if (input.channel === 'internal_email') return 'Internal owner';
  if (input.channel === 'email') {
    return input.email ? 'Email recipient' : 'Recipient unavailable';
  }
  if (input.channel === 'whatsapp') {
    const digits = String(input.phone ?? '').replace(/\D/g, '');
    if (!digits) return 'Recipient unavailable';
    return `WhatsApp recipient ending ${digits.slice(-4).padStart(Math.min(4, digits.length), '*')}`;
  }
  return 'Recipient unavailable';
}
