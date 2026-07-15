import { campaign } from './content.ts';

export function campaignTicker(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: campaign.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(now);
  if (today >= campaign.deadlineDate) {
    return null;
  }

  const todayMidnight = new Date(`${today}T00:00:00+03:00`);
  const deadline = new Date(`${campaign.deadlineDate}T00:00:00+03:00`);
  const days = Math.max(0, Math.ceil((deadline.getTime() - todayMidnight.getTime()) / 86_400_000));
  const dayLabel = days === 1 ? 'DAY' : 'DAYS';

  return `${campaign.label} — ${days} ${dayLabel} TO ROSH HASHANAH`;
}
