import { campaign } from './content.ts';

export function campaignTicker(now = new Date(), freeAccessExpiresAt?: string) {
  if (!freeAccessExpiresAt) return null;
  const deadline = Date.parse(freeAccessExpiresAt);
  if (!Number.isFinite(deadline) || now.getTime() >= deadline) return null;
  const days = Math.max(0, Math.ceil((deadline - now.getTime()) / 86_400_000));
  const dayLabel = days === 1 ? 'DAY' : 'DAYS';

  return `${campaign.label} — ${days} ${dayLabel} REMAINING`;
}
